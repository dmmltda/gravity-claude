import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { withTenantIsolation } from '@tenant/middleware/tenant-isolation.js'
import { AppError } from '@tenant/errors/AppError.js'
import type { TenantRequest } from '@tenant/middleware/types.js'
import { calcElapsedSeconds, type ActiveTimer } from './calc-elapsed.js'

const prisma = new PrismaClient()
export const timersRouter = Router()

timersRouter.use(withTenantIsolation)

async function autoStopPreviousTimer(
  tenantId: string,
  userId: string,
  activityId: string
): Promise<void> {
  const existing = await prisma.timerActive.findFirst({
    where: { tenant_id: tenantId, user_id: userId },
  })
  if (!existing || existing.activity_id === activityId) return

  const elapsed = calcElapsedSeconds(existing as ActiveTimer)
  if (elapsed >= 60) {
    await prisma.timerSession.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        activity_id: existing.activity_id,
        started_at: existing.started_at,
        ended_at: new Date(),
        duration_minutes: Math.floor(elapsed / 60),
        is_manual: false,
      },
    })
  }
  await prisma.timerActive.delete({ where: { id: existing.id } })
}

// ─── GET /active ─────────────────────────────────────────────────────────────

timersRouter.get('/active', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const active = await prisma.timerActive.findFirst({
      where: { tenant_id: tenantId, user_id: userId },
    })
    if (!active) {
      res.json({ timer: null, elapsed_seconds: 0 })
      return
    }
    res.json({ timer: active, elapsed_seconds: calcElapsedSeconds(active as ActiveTimer) })
  } catch (err) {
    next(err)
  }
})

// ─── GET /report ──────────────────────────────────────────────────────────────

const reportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  user_id: z.string().optional(),
})

timersRouter.get('/report', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = reportQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros de consulta inválidos')
    }
    const { from, to, user_id } = parsed.data

    const sessions = await prisma.timerSession.findMany({
      where: {
        tenant_id: tenantId,
        ...(user_id ? { user_id } : {}),
        ...((from ?? to)
          ? {
              started_at: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      select: {
        user_id: true,
        activity_id: true,
        duration_minutes: true,
        started_at: true,
        is_manual: true,
      },
      orderBy: { started_at: 'desc' },
    })

    const totalByUser = sessions.reduce<Record<string, number>>((acc, s) => {
      acc[s.user_id] = (acc[s.user_id] ?? 0) + (s.duration_minutes ?? 0)
      return acc
    }, {})

    res.json({
      sessions_count: sessions.length,
      total_minutes: Object.values(totalByUser).reduce((a, b) => a + b, 0),
      total_by_user: totalByUser,
      sessions,
    })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /sessions/:id ──────────────────────────────────────────────────────

const patchSessionSchema = z.object({
  subject: z.string().max(500).optional(),
  linked_type: z.enum(['nf', 'meeting', 'process', 'custom']).nullable().optional(),
  linked_id: z.string().max(200).optional(),
  linked_label: z.string().max(300).optional(),
})

timersRouter.patch('/sessions/:id', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const parsed = patchSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
    }

    const session = await prisma.timerSession.findFirst({
      where: { id: req.params['id'], tenant_id: tenantId, user_id: userId },
    })
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Sessão não encontrada')

    const updated = await prisma.timerSession.update({
      where: { id: req.params['id'] },
      data: parsed.data,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /sessions/:id ─────────────────────────────────────────────────────

timersRouter.delete('/sessions/:id', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest

    const session = await prisma.timerSession.findFirst({
      where: { id: req.params['id'], tenant_id: tenantId, user_id: userId },
    })
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Sessão não encontrada')

    await prisma.timerSession.delete({ where: { id: req.params['id'] } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ─── GET /:activity_id ────────────────────────────────────────────────────────

const activityParamSchema = z.object({
  activity_id: z.string().min(1),
})

timersRouter.get('/:activity_id', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const parsed = activityParamSchema.safeParse(req.params)
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'activity_id inválido')

    const sessions = await prisma.timerSession.findMany({
      where: {
        tenant_id: tenantId,
        user_id: userId,
        activity_id: parsed.data.activity_id,
      },
      orderBy: { started_at: 'desc' },
    })

    const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0)
    res.json({ sessions, total_minutes: totalMinutes })
  } catch (err) {
    next(err)
  }
})

// ─── POST /:activity_id/start ─────────────────────────────────────────────────

timersRouter.post('/:activity_id/start', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const parsed = activityParamSchema.safeParse(req.params)
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'activity_id inválido')
    const activityId = parsed.data.activity_id

    // Se existe timer para ESTA atividade pausado → retomar
    const existing = await prisma.timerActive.findFirst({
      where: { tenant_id: tenantId, user_id: userId },
    })

    if (existing?.activity_id === activityId) {
      if (!existing.paused_at) {
        throw new AppError(409, 'CONFLICT', 'Timer já está em execução para esta atividade')
      }
      const resumed = await prisma.timerActive.update({
        where: { id: existing.id },
        data: { started_at: new Date(), paused_at: null },
      })
      res.json({ timer: resumed, resumed: true })
      return
    }

    // Auto-para timer de outra atividade (salva se >= 60s)
    await autoStopPreviousTimer(tenantId, userId, activityId)

    const timer = await prisma.timerActive.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        activity_id: activityId,
        started_at: new Date(),
        accumulated_seconds: 0,
      },
    })
    res.status(201).json({ timer, resumed: false })
  } catch (err) {
    next(err)
  }
})

// ─── POST /:activity_id/pause ─────────────────────────────────────────────────

timersRouter.post('/:activity_id/pause', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const parsed = activityParamSchema.safeParse(req.params)
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'activity_id inválido')

    const active = await prisma.timerActive.findFirst({
      where: { tenant_id: tenantId, user_id: userId, activity_id: parsed.data.activity_id },
    })
    if (!active) throw new AppError(404, 'NOT_FOUND', 'Nenhum timer ativo para esta atividade')
    if (active.paused_at) throw new AppError(409, 'CONFLICT', 'Timer já está pausado')

    const nowMs = Date.now()
    const elapsedSinceResume = Math.floor((nowMs - active.started_at.getTime()) / 1000)
    const accumulated = active.accumulated_seconds + elapsedSinceResume

    const updated = await prisma.timerActive.update({
      where: { id: active.id },
      data: { paused_at: new Date(), accumulated_seconds: accumulated },
    })
    res.json({ timer: updated, elapsed_seconds: accumulated })
  } catch (err) {
    next(err)
  }
})

// ─── POST /:activity_id/stop ──────────────────────────────────────────────────

timersRouter.post('/:activity_id/stop', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const parsed = activityParamSchema.safeParse(req.params)
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'activity_id inválido')

    const active = await prisma.timerActive.findFirst({
      where: { tenant_id: tenantId, user_id: userId, activity_id: parsed.data.activity_id },
    })
    if (!active) throw new AppError(404, 'NOT_FOUND', 'Nenhum timer ativo para esta atividade')

    const elapsed = calcElapsedSeconds(active as ActiveTimer)
    await prisma.timerActive.delete({ where: { id: active.id } })

    // Sessões < 1 minuto são descartadas
    if (elapsed < 60) {
      res.json({ session: null, discarded: true, elapsed_seconds: elapsed })
      return
    }

    const session = await prisma.timerSession.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        activity_id: parsed.data.activity_id,
        started_at: active.started_at,
        ended_at: new Date(),
        duration_minutes: Math.floor(elapsed / 60),
        is_manual: false,
      },
    })
    res.json({ session, discarded: false, elapsed_seconds: elapsed })
  } catch (err) {
    next(err)
  }
})

// ─── POST /:activity_id/manual ────────────────────────────────────────────────

const manualSchema = z.object({
  minutes: z.number().int().positive('Informe um valor positivo em minutos'),
  subject: z.string().min(1, 'Assunto é obrigatório para lançamentos manuais').max(500),
  linked_type: z.enum(['nf', 'meeting', 'process', 'custom']).optional(),
  linked_id: z.string().max(200).optional(),
  linked_label: z.string().max(300).optional(),
})

timersRouter.post('/:activity_id/manual', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const paramParsed = activityParamSchema.safeParse(req.params)
    if (!paramParsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'activity_id inválido')

    const parsed = manualSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
    }

    const { minutes, subject, linked_type, linked_id, linked_label } = parsed.data
    const now = new Date()
    const startedAt = new Date(now.getTime() - minutes * 60 * 1000)

    const session = await prisma.timerSession.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        activity_id: paramParsed.data.activity_id,
        started_at: startedAt,
        ended_at: now,
        duration_minutes: minutes,
        is_manual: true,
        subject,
        linked_type: linked_type ?? null,
        linked_id: linked_id ?? null,
        linked_label: linked_label ?? null,
      },
    })
    res.status(201).json(session)
  } catch (err) {
    next(err)
  }
})

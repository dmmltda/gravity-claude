import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { withTenantIsolation } from '@tenant/middleware/tenant-isolation.js'
import { AppError } from '@tenant/errors/AppError.js'
import type { TenantRequest } from '@tenant/middleware/types.js'
import {
  createActivitySchema as createSchema,
  updateActivitySchema as updateSchema,
  listActivitiesQuerySchema as listQuerySchema,
} from './schemas.js'

const prisma = new PrismaClient()
export const activitiesRouter = Router()

activitiesRouter.use(withTenantIsolation)

// ─── GET / — listar com filtros ────────────────────────────────────────────────

activitiesRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros de consulta inválidos')
    }
    const { status, user_id, product_id, due_date_from, due_date_to } = parsed.data

    const activities = await prisma.activity.findMany({
      where: {
        tenant_id: tenantId,
        ...(status ? { status } : {}),
        ...(user_id ? { user_id } : {}),
        ...(product_id ? { product_id } : {}),
        ...((due_date_from ?? due_date_to)
          ? {
              due_date: {
                ...(due_date_from ? { gte: new Date(due_date_from) } : {}),
                ...(due_date_to ? { lte: new Date(due_date_to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { created_at: 'desc' },
    })

    res.json({ activities, count: activities.length })
  } catch (err) {
    next(err)
  }
})

// ─── GET /mine — atividades do usuário autenticado ────────────────────────────
// Registrado ANTES de /:id para evitar conflito de rota

activitiesRouter.get('/mine', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest

    const activities = await prisma.activity.findMany({
      where: {
        tenant_id: tenantId,
        user_id: userId,
      },
      orderBy: [{ status: 'asc' }, { due_date: 'asc' }],
    })

    res.json({ activities, count: activities.length })
  } catch (err) {
    next(err)
  }
})

// ─── GET /stats — contagem por status para o dashboard ───────────────────────
// Registrado ANTES de /:id para evitar conflito de rota

activitiesRouter.get('/stats', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const productId = typeof req.query['product_id'] === 'string'
      ? req.query['product_id']
      : undefined

    const counts = await prisma.activity.groupBy({
      by: ['status'],
      where: {
        tenant_id: tenantId,
        ...(productId ? { product_id: productId } : {}),
      },
      _count: { status: true },
    })

    const stats = {
      pending: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
      total: 0,
    } as Record<string, number>

    for (const row of counts) {
      stats[row.status] = row._count.status
      stats['total'] += row._count.status
    }

    res.json(stats)
  } catch (err) {
    next(err)
  }
})

// ─── POST / — criar atividade ─────────────────────────────────────────────────

activitiesRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
    }

    const { due_date, reminder_at, next_step_date, ...rest } = parsed.data

    const activity = await prisma.activity.create({
      data: {
        ...rest,
        tenant_id: tenantId,
        ...(due_date ? { due_date: new Date(due_date) } : {}),
        ...(reminder_at ? { reminder_at: new Date(reminder_at) } : {}),
        ...(next_step_date ? { next_step_date: new Date(next_step_date) } : {}),
      },
    })

    res.status(201).json(activity)
  } catch (err) {
    next(err)
  }
})

// ─── GET /:id — buscar por id ──────────────────────────────────────────────────

activitiesRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest

    const activity = await prisma.activity.findFirst({
      where: { id: req.params['id'], tenant_id: tenantId },
    })
    if (!activity) throw new AppError(404, 'NOT_FOUND', 'Atividade não encontrada')

    res.json(activity)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /:id — atualizar ─────────────────────────────────────────────────────

activitiesRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
    }

    const existing = await prisma.activity.findFirst({
      where: { id: req.params['id'], tenant_id: tenantId },
    })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Atividade não encontrada')

    const { due_date, reminder_at, next_step_date, ...rest } = parsed.data

    const activity = await prisma.activity.update({
      where: { id: req.params['id'] },
      data: {
        ...rest,
        ...(due_date !== undefined ? { due_date: due_date ? new Date(due_date) : null } : {}),
        ...(reminder_at !== undefined ? { reminder_at: reminder_at ? new Date(reminder_at) : null } : {}),
        ...(next_step_date !== undefined ? { next_step_date: next_step_date ? new Date(next_step_date) : null } : {}),
      },
    })

    res.json(activity)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /:id — deletar ────────────────────────────────────────────────────

activitiesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest

    const existing = await prisma.activity.findFirst({
      where: { id: req.params['id'], tenant_id: tenantId },
    })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Atividade não encontrada')

    await prisma.activity.delete({ where: { id: req.params['id'] } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

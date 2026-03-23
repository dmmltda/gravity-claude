import { Router, type Request, type Response, type NextFunction } from 'express'
import { prisma } from './prisma.js'
import { enqueueNotification } from './job-queue.js'
import { addSseClient, removeSseClient } from './sse-registry.js'
import { AppError } from '../../../../../servicos-global/tenant/errors/AppError.js'
import { withTenantIsolation } from '../../../../../servicos-global/tenant/middleware/tenant-isolation.js'
import type { TenantRequest } from '../../../../../servicos-global/tenant/middleware/types.js'

import { testQuerySchema } from './schemas.js'

export const notificacoesRouter = Router()
notificacoesRouter.use(withTenantIsolation)

function tenantReq(req: Request): TenantRequest {
  return req as TenantRequest
}

// ─── GET /api/v1/notificacoes — 50 mais recentes, não-lidas primeiro ──────────

notificacoesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, userId } = tenantReq(req)

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { tenant_id: tenantId, user_id: userId },
        orderBy: [{ read: 'asc' }, { created_at: 'desc' }],
        take: 50,
      }),
      prisma.notification.count({
        where: { tenant_id: tenantId, user_id: userId, read: false },
      }),
    ])

    res.json({ notifications, unread_count: unreadCount })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/notificacoes/stream — SSE com heartbeat 30s ─────────────────

notificacoesRouter.get('/stream', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, userId } = tenantReq(req)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Desativa buffer no Nginx/Railway
    res.flushHeaders()

    addSseClient(tenantId, userId, res)

    // Heartbeat a cada 30s para manter a conexão viva
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 30_000)

    req.on('close', () => {
      clearInterval(heartbeat)
      removeSseClient(tenantId, userId, res)
    })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/v1/notificacoes/read-all — marcar todas como lidas ──────────────

notificacoesRouter.put('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, userId } = tenantReq(req)

    await prisma.notification.updateMany({
      where: { tenant_id: tenantId, user_id: userId, read: false },
      data: { read: true },
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/v1/notificacoes/:id/read — marcar uma como lida ────────────────

const readParamsSchema = z.object({ id: z.string().min(1) })

notificacoesRouter.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = readParamsSchema.safeParse(req.params)
    if (!params.success) throw new AppError(400, 'VALIDATION_ERROR', 'ID inválido')

    const { tenantId, userId } = tenantReq(req)

    const notification = await prisma.notification.findFirst({
      where: { id: params.data.id, tenant_id: tenantId, user_id: userId },
    })
    if (!notification) throw new AppError(404, 'NOT_FOUND', 'Notificação não encontrada')

    const updated = await prisma.notification.update({
      where: { id: params.data.id },
      data: { read: true },
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/v1/notificacoes/:id — dispensar ─────────────────────────────

const deleteParamsSchema = z.object({ id: z.string().min(1) })

notificacoesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = deleteParamsSchema.safeParse(req.params)
    if (!params.success) throw new AppError(400, 'VALIDATION_ERROR', 'ID inválido')

    const { tenantId, userId } = tenantReq(req)

    const notification = await prisma.notification.findFirst({
      where: { id: params.data.id, tenant_id: tenantId, user_id: userId },
    })
    if (!notification) throw new AppError(404, 'NOT_FOUND', 'Notificação não encontrada')

    await prisma.notification.delete({ where: { id: params.data.id } })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/notificacoes/test — inserir notificações de teste (dev only) ─

notificacoesRouter.get('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'FORBIDDEN', 'Rota disponível apenas em desenvolvimento')
    }

    const query = testQuerySchema.safeParse(req.query)
    if (!query.success) throw new AppError(400, 'VALIDATION_ERROR', 'Tipo inválido')

    const { tenantId, userId } = tenantReq(req)

    await enqueueNotification(
      {
        type: query.data.type,
        activityId: null,
        userId,
        tenantId,
        extra: { mencionadoPor: 'Teste' },
      },
      `test-${query.data.type}-${userId}-${Date.now()}`,
    )

    res.json({ ok: true, queued: query.data.type })
  } catch (err) {
    next(err)
  }
})

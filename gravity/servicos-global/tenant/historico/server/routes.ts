// servicos-global/tenant/historico/server/routes.ts
import { Router } from 'express'
import { AppError } from '../../errors/AppError.js'
import type { Request, Response, NextFunction } from 'express'
import type { PrismaClient } from '@prisma/client'
import { listHistoricoSchema as listSchema, statsHistoricoSchema as statsSchema } from './schemas.js'

type TenantRequest = Request & { tenantId: string; prisma: PrismaClient }

const router = Router()

// ─── GET /api/v1/historico — listar com filtros e paginação ─────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = listSchema.safeParse(req.query)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos'))
    }

    const { tenantId, prisma } = req as TenantRequest
    const { from, to, action, actor_type, actor_id, entity, product_id, search, page, limit } =
      parsed.data

    const skip = (page - 1) * limit

    const where = {
      tenant_id:  tenantId,
      created_at: { gte: new Date(from), lte: new Date(to) },
      ...(action     && { action }),
      ...(actor_type && { actor_type }),
      ...(actor_id   && { actor_id }),
      ...(entity     && { entity }),
      ...(product_id && { product_id }),
      ...(search     && {
        OR: [
          { description:  { contains: search, mode: 'insensitive' as const } },
          { actor_name:   { contains: search, mode: 'insensitive' as const } },
          { entity_label: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        select: {
          id:           true,
          actor_type:   true,
          actor_name:   true,
          action:       true,
          entity:       true,
          entity_label: true,
          entity_id:    true,
          description:  true,
          product_id:   true,
          created_at:   true,
          // diff omitido na listagem — só no detalhe (:id)
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ])

    res.json({
      data:       logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/historico/stats — contagem por tipo de ação e período ───────
// IMPORTANTE: esta rota deve ser registrada ANTES de /:id para não conflitar

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = statsSchema.safeParse(req.query)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos'))
    }

    const { tenantId, prisma } = req as TenantRequest
    const { from, to, product_id } = parsed.data

    const where = {
      tenant_id:  tenantId,
      created_at: { gte: new Date(from), lte: new Date(to) },
      ...(product_id && { product_id }),
    }

    const grouped = await prisma.auditLog.groupBy({
      by:      ['action'],
      where,
      _count:  { action: true },
      orderBy: { _count: { action: 'desc' } },
    })

    const total = await prisma.auditLog.count({ where })

    res.json({
      total,
      by_action: grouped.map((g) => ({
        action: g.action,
        count:  g._count.action,
      })),
      period: { from, to },
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/historico/:id — log específico com diff completo ─────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, prisma } = req as TenantRequest
    const { id } = req.params

    if (!id) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'ID inválido'))
    }

    const log = await prisma.auditLog.findFirst({
      where: { id, tenant_id: tenantId },
    })

    if (!log) {
      return next(new AppError(404, 'NOT_FOUND', 'Log não encontrado'))
    }

    res.json(log)
  } catch (err) {
    next(err)
  }
})

export { router as historicoRoutes }

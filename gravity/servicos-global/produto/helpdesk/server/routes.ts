import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppError } from '@nucleo/utils/errors'
import { calcSlaStatus } from './sla-utils.js'

const router = Router()

// ─── Schemas de validação ───────────────────────────────────────────────────

const createTicketSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.string().optional(),
  assigned_to: z.string().optional(),
  sla_deadline: z.string().datetime().optional(),
})

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: z.string().nullable().optional(),
  category: z.string().optional(),
  sla_deadline: z.string().datetime().optional(),
  sla_breached: z.boolean().optional(),
})

const listTicketsSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

const createMessageSchema = z.object({
  content: z.string().min(1),
  is_internal: z.boolean().default(false),
  attachments: z.array(z.unknown()).default([]),
})

const createQueueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sla_hours: z.number().int().positive().default(24),
  auto_assign: z.boolean().default(false),
  agents: z.array(z.string()).default([]),
})

const updateQueueSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  sla_hours: z.number().int().positive().optional(),
  auto_assign: z.boolean().optional(),
  agents: z.array(z.string()).optional(),
  active: z.boolean().optional(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTenantContext(req: Request): { tenantId: string; productId: string; userId: string } {
  const tenantId = req.headers['x-tenant-id'] as string
  const productId = req.headers['x-product-id'] as string
  const userId = (req as Request & { auth?: { userId: string } }).auth?.userId ?? ''

  if (!tenantId) throw new AppError('tenant_id ausente', 400, 'MISSING_TENANT')
  if (!productId) throw new AppError('product_id ausente', 400, 'MISSING_PRODUCT')
  if (!userId) throw new AppError('user_id ausente', 401, 'UNAUTHORIZED')

  return { tenantId, productId, userId }
}

// ─── GET /api/v1/helpdesk/tickets ─────────────────────────────────────────────

router.get('/tickets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId } = getTenantContext(req)

    const parsed = listTicketsSchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parâmetros inválidos', details: parsed.error.flatten() }
      })
    }

    const { status, priority, assigned_to, category, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const where = {
      tenant_id: tenantId,
      product_id: productId,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigned_to && { assigned_to }),
      ...(category && { category }),
    }

    const [tickets, total] = await Promise.all([
      prisma.helpdeskTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { messages: true } } },
      }),
      prisma.helpdeskTicket.count({ where }),
    ])

    const ticketsWithSla = tickets.map((t) => ({
      ...t,
      sla_status: calcSlaStatus(t.sla_deadline, t.sla_breached),
    }))

    res.json({ data: ticketsWithSla, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/helpdesk/tickets ────────────────────────────────────────────

router.post('/tickets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId, userId } = getTenantContext(req)

    const parsed = createTicketSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: parsed.error.flatten() }
      })
    }

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const ticket = await prisma.helpdeskTicket.create({
      data: {
        tenant_id: tenantId,
        product_id: productId,
        user_id: userId,
        ...parsed.data,
        sla_deadline: parsed.data.sla_deadline ? new Date(parsed.data.sla_deadline) : undefined,
      },
    })

    res.status(201).json(ticket)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/helpdesk/tickets/:id ─────────────────────────────────────────

router.get('/tickets/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId } = getTenantContext(req)

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const ticket = await prisma.helpdeskTicket.findFirst({
      where: { id: req.params.id, tenant_id: tenantId, product_id: productId },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    })

    if (!ticket) throw new AppError('Ticket não encontrado', 404, 'NOT_FOUND')

    res.json({ ...ticket, sla_status: calcSlaStatus(ticket.sla_deadline, ticket.sla_breached) })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/v1/helpdesk/tickets/:id ─────────────────────────────────────────

router.put('/tickets/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId } = getTenantContext(req)

    const parsed = updateTicketSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: parsed.error.flatten() }
      })
    }

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const existing = await prisma.helpdeskTicket.findFirst({
      where: { id: req.params.id, tenant_id: tenantId, product_id: productId },
    })
    if (!existing) throw new AppError('Ticket não encontrado', 404, 'NOT_FOUND')

    const now = new Date()
    const updateData: Record<string, unknown> = { ...parsed.data }

    if (parsed.data.status === 'resolved' && existing.status !== 'resolved') {
      updateData['resolved_at'] = now
    }
    if (parsed.data.status === 'closed' && existing.status !== 'closed') {
      updateData['closed_at'] = now
    }

    const updated = await prisma.helpdeskTicket.update({
      where: { id: req.params.id },
      data: updateData,
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/helpdesk/tickets/:id/messages ───────────────────────────────

router.post('/tickets/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId, userId } = getTenantContext(req)

    const parsed = createMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: parsed.error.flatten() }
      })
    }

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const ticket = await prisma.helpdeskTicket.findFirst({
      where: { id: req.params.id, tenant_id: tenantId, product_id: productId },
    })
    if (!ticket) throw new AppError('Ticket não encontrado', 404, 'NOT_FOUND')

    const message = await prisma.helpdeskMessage.create({
      data: {
        ticket_id: req.params.id,
        tenant_id: tenantId,
        user_id: userId,
        content: parsed.data.content,
        is_internal: parsed.data.is_internal,
        attachments: parsed.data.attachments,
      },
    })

    // Se o usuário final responde, mover para in_progress caso esteja waiting
    if (!parsed.data.is_internal && ticket.status === 'waiting') {
      await prisma.helpdeskTicket.update({
        where: { id: ticket.id },
        data: { status: 'in_progress' },
      })
    }

    res.status(201).json(message)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/helpdesk/queues ──────────────────────────────────────────────

router.get('/queues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId } = getTenantContext(req)

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const queues = await prisma.helpdeskQueue.findMany({
      where: { tenant_id: tenantId, product_id: productId },
      orderBy: { created_at: 'asc' },
    })

    res.json(queues)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/helpdesk/queues ─────────────────────────────────────────────

router.post('/queues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId } = getTenantContext(req)

    const parsed = createQueueSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: parsed.error.flatten() }
      })
    }

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const queue = await prisma.helpdeskQueue.create({
      data: {
        tenant_id: tenantId,
        product_id: productId,
        ...parsed.data,
      },
    })

    res.status(201).json(queue)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/v1/helpdesk/queues/:id ──────────────────────────────────────────

router.put('/queues/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId } = getTenantContext(req)

    const parsed = updateQueueSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: parsed.error.flatten() }
      })
    }

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const existing = await prisma.helpdeskQueue.findFirst({
      where: { id: req.params.id, tenant_id: tenantId, product_id: productId },
    })
    if (!existing) throw new AppError('Fila não encontrada', 404, 'NOT_FOUND')

    const updated = await prisma.helpdeskQueue.update({
      where: { id: req.params.id },
      data: parsed.data,
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/helpdesk/stats ───────────────────────────────────────────────

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, productId } = getTenantContext(req)

    const prisma = (req as Request & { prisma: import('@prisma/client').PrismaClient }).prisma

    const base = { tenant_id: tenantId, product_id: productId }

    const [
      openCount,
      resolvedTickets,
      totalClosed,
      slaPending,
      slaBreached,
    ] = await Promise.all([
      prisma.helpdeskTicket.count({
        where: { ...base, status: { in: ['open', 'in_progress', 'waiting'] } },
      }),
      prisma.helpdeskTicket.findMany({
        where: { ...base, status: 'resolved', resolved_at: { not: null } },
        select: { created_at: true, resolved_at: true },
      }),
      prisma.helpdeskTicket.count({ where: { ...base, status: 'closed' } }),
      prisma.helpdeskTicket.count({
        where: { ...base, sla_deadline: { not: null }, sla_breached: false },
      }),
      prisma.helpdeskTicket.count({ where: { ...base, sla_breached: true } }),
    ])

    const avgResolutionMs =
      resolvedTickets.length === 0
        ? 0
        : resolvedTickets.reduce((acc, t) => {
            const diff = (t.resolved_at!.getTime() - t.created_at.getTime())
            return acc + diff
          }, 0) / resolvedTickets.length

    const avgResolutionHours = Math.round(avgResolutionMs / (1000 * 60 * 60) * 10) / 10

    const totalWithSla = slaPending + slaBreached
    const slaCompliancePercent =
      totalWithSla === 0 ? 100 : Math.round((slaPending / totalWithSla) * 100)

    res.json({
      open_tickets: openCount,
      closed_tickets: totalClosed,
      avg_resolution_hours: avgResolutionHours,
      sla_compliance_percent: slaCompliancePercent,
      sla_breached_count: slaBreached,
    })
  } catch (err) {
    next(err)
  }
})

export { router as helpdeskRoutes }

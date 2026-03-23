import { Router } from 'express'
import { z } from 'zod'
import { prisma } from './prisma.js'
import { AppError } from '../../../errors/AppError.js'
import { withTenantIsolation } from '../../../middleware/tenant-isolation.js'
import type { TenantRequest } from '../../../middleware/types.js'
import { computeFreeSlots, buildStartOfDay, buildEndOfDay } from './agenda-utils.js'

export const calendarRoutes = Router()
calendarRoutes.use(withTenantIsolation)

// ─── Schemas Zod ───────────────────────────────────────────────────────────

const eventTypeEnum = z.enum(['meeting', 'task', 'reminder', 'deadline', 'custom'])

const attendeeSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  status: z.enum(['pending', 'accepted', 'declined']).default('pending'),
})

const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).default(1),
  until: z.string().datetime().optional(),
})

const createEventSchema = z.object({
  user_id: z.string().min(1),
  product_id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  all_day: z.boolean().default(false),
  type: eventTypeEnum,
  linked_activity_id: z.string().optional(),
  recurrence: recurrenceSchema.optional(),
  attendees: z.array(attendeeSchema).default([]),
  location: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

const updateEventSchema = createEventSchema.partial()

const listEventsQuerySchema = z.object({
  user_id: z.string().optional(),
  product_id: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: eventTypeEnum.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const availabilityQuerySchema = z.object({
  user_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
  slot_minutes: z.coerce.number().int().min(15).max(480).default(30),
})

// ─── Helpers ───────────────────────────────────────────────────────────────

function toDate(value: string): Date {
  return new Date(value)
}

// ─── GET /api/v1/calendar/events ──────────────────────────────────────────

calendarRoutes.get('/', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = listEventsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten())))
    }

    const { user_id, product_id, from, to, type, limit, offset } = parsed.data

    const events = await prisma.calendarEvent.findMany({
      where: {
        tenant_id: tenantId,
        ...(user_id ? { user_id } : {}),
        ...(product_id ? { product_id } : {}),
        ...(type ? { type } : {}),
        ...(from || to
          ? {
              starts_at: {
                ...(from ? { gte: toDate(from) } : {}),
                ...(to ? { lte: toDate(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { starts_at: 'asc' },
      take: limit,
      skip: offset,
    })

    res.json({ data: events, total: events.length, offset, limit })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/calendar/events ─────────────────────────────────────────

calendarRoutes.post('/', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = createEventSchema.safeParse(req.body)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten())))
    }

    const data = parsed.data

    if (toDate(data.ends_at) <= toDate(data.starts_at)) {
      return next(new AppError(400, 'INVALID_DATE_RANGE', 'ends_at deve ser posterior a starts_at'))
    }

    const event = await prisma.calendarEvent.create({
      data: {
        tenant_id: tenantId,
        user_id: data.user_id,
        product_id: data.product_id ?? null,
        title: data.title,
        description: data.description ?? null,
        starts_at: toDate(data.starts_at),
        ends_at: toDate(data.ends_at),
        all_day: data.all_day,
        type: data.type,
        linked_activity_id: data.linked_activity_id ?? null,
        recurrence: data.recurrence ?? null,
        attendees: data.attendees,
        location: data.location ?? null,
        color: data.color ?? null,
      },
    })

    res.status(201).json(event)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/calendar/events/today ────────────────────────────────────
// Deve vir ANTES de /:id para não ser capturado como id

calendarRoutes.get('/today', async (req, res, next) => {
  try {
    const { tenantId, userId } = req as TenantRequest
    const todayStr = new Date().toISOString().slice(0, 10)

    const events = await prisma.calendarEvent.findMany({
      where: {
        tenant_id: tenantId,
        user_id: userId,
        starts_at: {
          gte: buildStartOfDay(todayStr),
          lte: buildEndOfDay(todayStr),
        },
      },
      orderBy: { starts_at: 'asc' },
    })

    res.json({ data: events, date: todayStr })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/calendar/availability ────────────────────────────────────
// Deve vir ANTES de /:id para não ser capturado como id

calendarRoutes.get('/availability', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = availabilityQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten())))
    }

    const { user_id, date, slot_minutes } = parsed.data

    const busyEvents = await prisma.calendarEvent.findMany({
      where: {
        tenant_id: tenantId,
        user_id,
        all_day: false,
        starts_at: { gte: buildStartOfDay(date) },
        ends_at: { lte: buildEndOfDay(date) },
      },
      select: { starts_at: true, ends_at: true },
    })

    // Horário de trabalho padrão: 08:00–18:00 UTC
    const workStart = new Date(`${date}T08:00:00.000Z`)
    const workEnd = new Date(`${date}T18:00:00.000Z`)

    const freeSlots = computeFreeSlots(busyEvents, workStart, workEnd, slot_minutes)

    res.json({ user_id, date, slot_minutes, free_slots: freeSlots })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/calendar/events/:id ──────────────────────────────────────

calendarRoutes.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest

    const event = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, tenant_id: tenantId },
    })

    if (!event) throw new AppError(404, 'NOT_FOUND', 'Evento não encontrado')

    res.json(event)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/v1/calendar/events/:id ──────────────────────────────────────

calendarRoutes.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest
    const parsed = updateEventSchema.safeParse(req.body)
    if (!parsed.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten())))
    }

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, tenant_id: tenantId },
    })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Evento não encontrado')

    const data = parsed.data

    const startsAt = data.starts_at ? toDate(data.starts_at) : existing.starts_at
    const endsAt = data.ends_at ? toDate(data.ends_at) : existing.ends_at

    if (endsAt <= startsAt) {
      return next(new AppError(400, 'INVALID_DATE_RANGE', 'ends_at deve ser posterior a starts_at'))
    }

    const updated = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        ...(data.user_id !== undefined ? { user_id: data.user_id } : {}),
        ...(data.product_id !== undefined ? { product_id: data.product_id } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        starts_at: startsAt,
        ends_at: endsAt,
        ...(data.all_day !== undefined ? { all_day: data.all_day } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.linked_activity_id !== undefined ? { linked_activity_id: data.linked_activity_id } : {}),
        ...(data.recurrence !== undefined ? { recurrence: data.recurrence } : {}),
        ...(data.attendees !== undefined ? { attendees: data.attendees } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/v1/calendar/events/:id ───────────────────────────────────

calendarRoutes.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req as TenantRequest

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, tenant_id: tenantId },
    })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Evento não encontrado')

    await prisma.calendarEvent.delete({ where: { id: req.params.id } })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

import { z } from 'zod'

export const statusEnum = z.enum(['pending', 'in_progress', 'done', 'cancelled'])

export const createActivitySchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  user_id: z.string().min(1),
  product_id: z.string().optional(),
  status: statusEnum.default('pending'),
  due_date: z.string().datetime().optional(),
  reminder_at: z.string().datetime().optional(),
  reminder_whatsapp: z.boolean().optional(),
  next_step: z.string().max(1000).optional(),
  next_step_date: z.string().datetime().optional(),
  send_invite_whatsapp: z.boolean().optional(),
  send_summary_whatsapp: z.boolean().optional(),
  send_recording_whatsapp: z.boolean().optional(),
  recording_url: z.string().url().optional(),
})

export const updateActivitySchema = createActivitySchema.partial()

export const listActivitiesQuerySchema = z.object({
  status: statusEnum.optional(),
  user_id: z.string().optional(),
  product_id: z.string().optional(),
  due_date_from: z.string().datetime().optional(),
  due_date_to: z.string().datetime().optional(),
})

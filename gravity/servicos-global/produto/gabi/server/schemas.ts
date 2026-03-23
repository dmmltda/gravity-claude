import { z } from 'zod'

export const chatSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória').max(8000),
  conversation_id: z.string().cuid().nullable().optional(),
  product_id: z.string().min(1, 'product_id é obrigatório'),
})

export const uploadSchema = z.object({
  product_id: z.string().min(1),
  conversation_id: z.string().cuid().nullable().optional(),
})

export const settingsSchema = z.object({
  product_id: z.string().min(1),
  monthly_limit_usd: z.number().positive().max(10000).optional(),
  alert_at_80_sent: z.boolean().optional(),
  alert_at_100_sent: z.boolean().optional(),
})

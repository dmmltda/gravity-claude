import { z } from 'zod'

export const listHistoricoSchema = z.object({
  from: z.string().datetime({ message: 'from é obrigatório e deve ser ISO 8601' }),
  to:   z.string().datetime({ message: 'to é obrigatório e deve ser ISO 8601' }),
  action:     z.string().optional(),
  actor_type: z.enum(['user', 'gabi', 'system']).optional(),
  actor_id:   z.string().optional(),
  entity:     z.string().optional(),
  product_id: z.string().optional(),
  search:     z.string().optional(),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

export const statsHistoricoSchema = z.object({
  from: z.string().datetime({ message: 'from é obrigatório e deve ser ISO 8601' }),
  to:   z.string().datetime({ message: 'to é obrigatório e deve ser ISO 8601' }),
  product_id: z.string().optional(),
})

import { z } from 'zod'

export const temperaturasEnum = z.enum(['critico', 'negativo', 'neutro', 'positivo', 'encantado'])

export const listConversationsSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  temperatura: temperaturasEnum.optional(),
  vinculado: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const sendMessageSchema = z.object({
  text: z.string().min(1).max(4096),
})

export const closeConversationSchema = z.object({
  temperatura: temperaturasEnum.optional(),
  temperatura_score: z.number().int().min(1).max(5).optional(),
  resumo: z.string().max(1000).optional(),
  acoes_sugeridas: z.array(z.string()).optional(),
})

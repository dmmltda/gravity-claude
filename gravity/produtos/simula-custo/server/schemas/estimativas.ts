import { z } from 'zod'

export const criarEstimativaSchema = z.object({
  descricao: z.string().min(1).max(500),
  ncm: z.string().regex(/^\d{8}$/, 'NCM deve ter 8 dígitos'),
  incoterm: z.string().min(3).max(10),
  moeda: z.string().length(3),
  valor_produto: z.number().positive(),
  valor_frete: z.number().min(0),
  valor_seguro: z.number().min(0),
  ptax_utilizado: z.number().positive(),
  taxas: z
    .array(
      z.object({
        tipo: z.enum(['origem', 'destino']),
        nome: z.string().min(1).max(200),
        moeda: z.string().length(3),
        valor: z.number().min(0),
      })
    )
    .optional()
    .default([]),
})

export const atualizarEstimativaSchema = z.object({
  descricao: z.string().min(1).max(500).optional(),
  ncm: z.string().regex(/^\d{8}$/, 'NCM deve ter 8 dígitos').optional(),
  incoterm: z.string().min(3).max(10).optional(),
  moeda: z.string().length(3).optional(),
  valor_produto: z.number().positive().optional(),
  valor_frete: z.number().min(0).optional(),
  valor_seguro: z.number().min(0).optional(),
  ptax_utilizado: z.number().positive().optional(),
})

export const listarEstimativasQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['rascunho', 'criada', 'arquivada']).optional(),
})

export const idParamSchema = z.object({
  id: z.string().min(1),
})

export type CriarEstimativaInput = z.infer<typeof criarEstimativaSchema>
export type AtualizarEstimativaInput = z.infer<typeof atualizarEstimativaSchema>

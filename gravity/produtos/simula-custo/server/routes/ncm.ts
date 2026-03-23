import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../errors/AppError.js'

const prisma = new PrismaClient()
export const ncmRouter = Router()

const FALLBACK_ALIQUOTAS = {
  aliquota_ii: 0.14,
  aliquota_ipi: 0.05,
  aliquota_pis: 0.021,
  aliquota_cofins: 0.0965,
}

const ncmParamSchema = z.object({
  ncm: z.string().regex(/^\d{8}$/, 'NCM deve ter 8 dígitos'),
})

// ─── GET /api/v1/ncm/:ncm/aliquotas ──────────────────────────────────────────

ncmRouter.get('/:ncm/aliquotas', async (req, res, next) => {
  try {
    const parsed = ncmParamSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'NCM inválido — deve ter 8 dígitos')
    }

    const cache = await prisma.cacheAliquota.findUnique({
      where: { ncm: parsed.data.ncm },
    })

    if (cache) {
      res.json({
        ncm: cache.ncm,
        aliquota_ii: cache.aliquota_ii,
        aliquota_ipi: cache.aliquota_ipi,
        aliquota_pis: cache.aliquota_pis,
        aliquota_cofins: cache.aliquota_cofins,
        fonte: cache.fonte,
        updated_at: cache.updated_at,
        fallback: false,
      })
      return
    }

    res.json({
      ncm: parsed.data.ncm,
      ...FALLBACK_ALIQUOTAS,
      fonte: 'fallback',
      updated_at: null,
      fallback: true,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/ncm/:ncm/atualizar ─────────────────────────────────────────

ncmRouter.post('/:ncm/atualizar', async (req, res, next) => {
  try {
    if (process.env['NODE_ENV'] === 'production') {
      throw new AppError(403, 'FORBIDDEN', 'Operação não disponível em produção')
    }

    const parsed = ncmParamSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'NCM inválido — deve ter 8 dígitos')
    }

    const bodySchema = z.object({
      aliquota_ii: z.number().min(0).max(1),
      aliquota_ipi: z.number().min(0).max(1),
      aliquota_pis: z.number().min(0).max(1),
      aliquota_cofins: z.number().min(0).max(1),
      fonte: z.string().min(1).default('manual'),
    })

    const bodyParsed = bodySchema.safeParse(req.body)
    if (!bodyParsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados de alíquota inválidos')
    }

    const cache = await prisma.cacheAliquota.upsert({
      where: { ncm: parsed.data.ncm },
      create: {
        ncm: parsed.data.ncm,
        ...bodyParsed.data,
      },
      update: bodyParsed.data,
    })

    res.json(cache)
  } catch (err) {
    next(err)
  }
})

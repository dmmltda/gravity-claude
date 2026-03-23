import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import type { TenantRequest } from '../middleware/require-auth.js'
import { calcLandedCost } from '../calc-engine.js'
import {
  criarEstimativaSchema,
  atualizarEstimativaSchema,
  listarEstimativasQuerySchema,
  idParamSchema,
} from '../schemas/estimativas.js'

const prisma = new PrismaClient()
export const estimativasRouter = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTenantContext(req: TenantRequest): { tenantId: string; userId: string } {
  const tenantId = req.tenantId
  const userId = req.auth?.userId
  if (!tenantId || !userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Contexto de tenant ausente')
  }
  return { tenantId, userId }
}

async function gerarNumeroSequencial(tenantId: string): Promise<string> {
  const ano = new Date().getFullYear()
  const prefixo = `EST-${ano}-`

  const ultima = await prisma.estimativa.findFirst({
    where: {
      tenant_id: tenantId,
      numero_sequencial: { startsWith: prefixo },
    },
    orderBy: { numero_sequencial: 'desc' },
    select: { numero_sequencial: true },
  })

  let proximo = 1
  if (ultima) {
    const partes = ultima.numero_sequencial.split('-')
    const seq = parseInt(partes[partes.length - 1] ?? '0', 10)
    proximo = seq + 1
  }

  return `${prefixo}${String(proximo).padStart(5, '0')}`
}

// ─── GET /api/v1/estimativas ──────────────────────────────────────────────────

estimativasRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getTenantContext(req as TenantRequest)

    const parsed = listarEstimativasQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros de consulta inválidos')
    }

    const { page, limit, status } = parsed.data
    const skip = (page - 1) * limit

    const where = {
      tenant_id: tenantId,
      ...(status ? { status } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.estimativa.findMany({
        where,
        include: { taxas: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.estimativa.count({ where }),
    ])

    res.json({
      data,
      meta: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/estimativas ─────────────────────────────────────────────────

estimativasRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantContext(req as TenantRequest)

    const parsed = criarEstimativaSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Dados inválidos')
    }

    const { taxas, ...campos } = parsed.data
    const numero_sequencial = await gerarNumeroSequencial(tenantId)

    const estimativa = await prisma.estimativa.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        numero_sequencial,
        ...campos,
        valor_aduaneiro: 0,
        ii: 0,
        ipi: 0,
        pis: 0,
        cofins: 0,
        icms: 0,
        fcp: 0,
        taxa_siscomex: 0,
        landed_cost_brl: 0,
        status: 'rascunho',
        taxas: {
          create: taxas.map((t) => ({
            tipo: t.tipo as 'origem' | 'destino',
            nome: t.nome,
            moeda: t.moeda,
            valor: t.valor,
          })),
        },
      },
      include: { taxas: true },
    })

    res.status(201).json(estimativa)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/estimativas/:id ─────────────────────────────────────────────

estimativasRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getTenantContext(req as TenantRequest)

    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ID inválido')
    }

    const estimativa = await prisma.estimativa.findFirst({
      where: { id: parsed.data.id, tenant_id: tenantId },
      include: { taxas: true },
    })

    if (!estimativa) {
      throw new AppError(404, 'NOT_FOUND', 'Estimativa não encontrada')
    }

    res.json(estimativa)
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/v1/estimativas/:id ─────────────────────────────────────────────

estimativasRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getTenantContext(req as TenantRequest)

    const paramParsed = idParamSchema.safeParse(req.params)
    if (!paramParsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ID inválido')
    }

    const estimativa = await prisma.estimativa.findFirst({
      where: { id: paramParsed.data.id, tenant_id: tenantId },
    })

    if (!estimativa) {
      throw new AppError(404, 'NOT_FOUND', 'Estimativa não encontrada')
    }

    if (estimativa.status === 'arquivada') {
      throw new AppError(409, 'CONFLICT', 'Estimativas arquivadas não podem ser alteradas')
    }

    const parsed = atualizarEstimativaSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Dados inválidos')
    }

    const atualizada = await prisma.estimativa.update({
      where: { id: paramParsed.data.id },
      data: parsed.data,
      include: { taxas: true },
    })

    res.json(atualizada)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/estimativas/:id/calcular ────────────────────────────────────

estimativasRouter.post('/:id/calcular', async (req, res, next) => {
  try {
    const { tenantId } = getTenantContext(req as TenantRequest)

    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ID inválido')
    }

    const estimativa = await prisma.estimativa.findFirst({
      where: { id: parsed.data.id, tenant_id: tenantId },
      include: { taxas: true },
    })

    if (!estimativa) {
      throw new AppError(404, 'NOT_FOUND', 'Estimativa não encontrada')
    }

    // Buscar alíquotas do cache ou usar fallback
    const cacheAliquota = await prisma.cacheAliquota.findUnique({
      where: { ncm: estimativa.ncm },
    })

    const aliquotaII = cacheAliquota?.aliquota_ii ?? 0.14
    const aliquotaIPI = cacheAliquota?.aliquota_ipi ?? 0.05
    const aliquotaPIS = cacheAliquota?.aliquota_pis ?? 0.021
    const aliquotaCOFINS = cacheAliquota?.aliquota_cofins ?? 0.0965

    // Separar taxas de origem e destino
    const taxasOrigem = estimativa.taxas
      .filter((t) => t.tipo === 'origem')
      .reduce((acc, t) => acc + t.valor, 0)

    const taxasDestino = estimativa.taxas
      .filter((t) => t.tipo === 'destino')
      .reduce((acc, t) => acc + t.valor, 0)

    const resultado = calcLandedCost({
      valorProduto: estimativa.valor_produto,
      valorFrete: estimativa.valor_frete,
      valorSeguro: estimativa.valor_seguro,
      taxasOrigem,
      taxasDestino,
      ptaxVenda: estimativa.ptax_utilizado,
      aliquotaII,
      aliquotaIPI,
      aliquotaPIS,
      aliquotaCOFINS,
      aliquotaICMS: 0.17, // padrão SP — idealmente vem do perfil do tenant
    })

    const atualizada = await prisma.estimativa.update({
      where: { id: parsed.data.id },
      data: {
        valor_aduaneiro: resultado.valorAduaneiro,
        ii: resultado.ii,
        ipi: resultado.ipi,
        pis: resultado.pis,
        cofins: resultado.cofins,
        icms: resultado.icms,
        fcp: resultado.fcp,
        taxa_siscomex: resultado.taxaSiscomex,
        landed_cost_brl: resultado.landedCostBRL,
        status: 'criada',
      },
      include: { taxas: true },
    })

    res.json(atualizada)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/v1/estimativas/:id ──────────────────────────────────────────

estimativasRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getTenantContext(req as TenantRequest)

    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ID inválido')
    }

    const estimativa = await prisma.estimativa.findFirst({
      where: { id: parsed.data.id, tenant_id: tenantId },
    })

    if (!estimativa) {
      throw new AppError(404, 'NOT_FOUND', 'Estimativa não encontrada')
    }

    await prisma.estimativa.update({
      where: { id: parsed.data.id },
      data: { status: 'arquivada' },
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

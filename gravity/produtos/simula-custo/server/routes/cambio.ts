import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../errors/AppError.js'

const prisma = new PrismaClient()
export const cambioRouter = Router()

const FALLBACK_CAMBIO: Record<string, { ptax_venda: number; ptax_compra: number }> = {
  USD: { ptax_venda: 6.0, ptax_compra: 5.98 },
  EUR: { ptax_venda: 6.5, ptax_compra: 6.48 },
  CNY: { ptax_venda: 0.85, ptax_compra: 0.84 },
}

const moedaParamSchema = z.object({
  moeda: z.string().length(3).transform((v) => v.toUpperCase()),
})

// ─── GET /api/v1/cambio/:moeda ────────────────────────────────────────────────

cambioRouter.get('/:moeda', async (req, res, next) => {
  try {
    const parsed = moedaParamSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Código de moeda inválido — use 3 letras (ex: USD)')
    }

    const moeda = parsed.data.moeda
    const cache = await prisma.cacheCambio.findUnique({ where: { moeda } })

    if (cache) {
      res.json({
        moeda: cache.moeda,
        ptax_venda: cache.ptax_venda,
        ptax_compra: cache.ptax_compra,
        data_cotacao: cache.data_cotacao,
        fallback: false,
      })
      return
    }

    const fallback = FALLBACK_CAMBIO[moeda]
    if (!fallback) {
      throw new AppError(404, 'NOT_FOUND', `Cotação não encontrada para moeda: ${moeda}`)
    }

    res.json({
      moeda,
      ...fallback,
      data_cotacao: null,
      fallback: true,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/cambio/atualizar ───────────────────────────────────────────

cambioRouter.post('/atualizar', async (req, res, next) => {
  try {
    const MOEDAS_SYNC = ['USD', 'EUR']
    const hoje = new Date().toISOString().split('T')[0]

    const resultados: Array<{ moeda: string; ptax_venda: number; ptax_compra: number }> = []

    for (const moeda of MOEDAS_SYNC) {
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${moeda}'&@dataCotacao='${hoje}'&$top=1&$format=json`

      const response = await fetch(url)
      if (!response.ok) {
        throw new AppError(502, 'EXTERNAL_SERVICE_ERROR', `Falha ao consultar BACEN para ${moeda}`)
      }

      type BacenResponse = {
        value: Array<{
          cotacaoCompra: number
          cotacaoVenda: number
          dataHoraCotacao: string
        }>
      }
      const data = (await response.json()) as BacenResponse

      const cotacao = data.value[0]
      if (!cotacao) {
        throw new AppError(404, 'NOT_FOUND', `Cotação BACEN não disponível para ${moeda} em ${hoje}`)
      }

      const cache = await prisma.cacheCambio.upsert({
        where: { moeda },
        create: {
          moeda,
          ptax_venda: cotacao.cotacaoVenda,
          ptax_compra: cotacao.cotacaoCompra,
          data_cotacao: new Date(cotacao.dataHoraCotacao),
        },
        update: {
          ptax_venda: cotacao.cotacaoVenda,
          ptax_compra: cotacao.cotacaoCompra,
          data_cotacao: new Date(cotacao.dataHoraCotacao),
        },
      })

      resultados.push({ moeda, ptax_venda: cache.ptax_venda, ptax_compra: cache.ptax_compra })
    }

    res.json({ sincronizado: resultados })
  } catch (err) {
    next(err)
  }
})

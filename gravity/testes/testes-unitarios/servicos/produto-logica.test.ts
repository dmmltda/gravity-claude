/**
 * Testes de lógica pura dos serviços de produto:
 * - helpdesk: calcSlaStatus
 * - conector-erp: buildFallbackQuery (fallback COMEX sem OpenAI)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { calcSlaStatus } from '../../../servicos-global/produto/helpdesk/server/sla-utils.js'
import { buildFallbackQuery } from '../../../servicos-global/produto/conector-erp/server/query-builder.js'

// ─── helpdesk: calcSlaStatus ──────────────────────────────────────────────────

describe('calcSlaStatus', () => {
  it('retorna "breached" quando flag breached=true, independente do deadline', () => {
    const futureDeadline = new Date(Date.now() + 10 * 60 * 60 * 1000) // 10h no futuro
    expect(calcSlaStatus(futureDeadline, true)).toBe('breached')
  })

  it('retorna "ok" quando deadline é null e breached=false', () => {
    expect(calcSlaStatus(null, false)).toBe('ok')
  })

  it('retorna "breached" quando deadline já passou e breached=false', () => {
    const pastDeadline = new Date(Date.now() - 1000) // 1s atrás
    expect(calcSlaStatus(pastDeadline, false)).toBe('breached')
  })

  it('retorna "warning" quando deadline é em menos de 2h', () => {
    const soonDeadline = new Date(Date.now() + 60 * 60 * 1000) // 1h no futuro
    expect(calcSlaStatus(soonDeadline, false)).toBe('warning')
  })

  it('retorna "ok" quando deadline é em mais de 2h', () => {
    const farDeadline = new Date(Date.now() + 5 * 60 * 60 * 1000) // 5h no futuro
    expect(calcSlaStatus(farDeadline, false)).toBe('ok')
  })

  it('retorna "warning" no limiar exato de 2h (1ms dentro)', () => {
    const twoHoursMs = 2 * 60 * 60 * 1000
    const deadline = new Date(Date.now() + twoHoursMs - 1)
    expect(calcSlaStatus(deadline, false)).toBe('warning')
  })
})

// ─── conector-erp: buildFallbackQuery ────────────────────────────────────────

describe('buildFallbackQuery', () => {
  it('detecta consulta sobre LI vencendo e retorna entity LicencaImportacao', () => {
    const result = buildFallbackQuery('mostre LIs que estão vencendo')
    expect(result.queryType).toBe('odata')
    expect(result.odata?.entity).toBe('LicencaImportacao/LicencaSet')
    expect(result.odata?.orderby).toBe('Validade asc')
  })

  it('detecta consulta sobre LI expirando (variação "expir")', () => {
    const result = buildFallbackQuery('quais LI estão para expirar?')
    expect(result.queryType).toBe('odata')
    expect(result.odata?.entity).toBe('LicencaImportacao/LicencaSet')
  })

  it('detecta consulta sobre DI atrasada', () => {
    const result = buildFallbackQuery('DI que estão atrasadas no despacho')
    expect(result.queryType).toBe('odata')
    expect(result.odata?.entity).toBe('DeclaracaoImportacao/DeclaracaoSet')
    expect(result.odata?.filter).toBe(`Status eq 'PENDENTE'`)
  })

  it('detecta consulta sobre movimentações de material', () => {
    const result = buildFallbackQuery('listar movimentações de material recentes')
    expect(result.queryType).toBe('odata')
    expect(result.odata?.entity).toBe('MM_GOODSMVT_SRV/GoodsMovementSet')
  })

  it('usa fallback genérico para consultas desconhecidas', () => {
    const result = buildFallbackQuery('qualquer coisa aleatória sem keywords')
    expect(result.queryType).toBe('odata')
    expect(result.odata?.entity).toBe('MM_GOODSMVT_SRV/GoodsMovementSet')
    expect(result.odata?.top).toBe(50)
    expect(result.humanReadable).toContain('qualquer coisa aleatória')
  })

  it('todas as respostas têm humanReadable preenchido', () => {
    const queries = [
      'li vencendo',
      'di atrasada',
      'movimentação de material',
      'consulta desconhecida',
    ]
    for (const q of queries) {
      const result = buildFallbackQuery(q)
      expect(result.humanReadable).toBeTruthy()
      expect(result.humanReadable.length).toBeGreaterThan(0)
    }
  })

  it('retorna $select com campos limitados em todas as respostas (boas práticas OData)', () => {
    const queries = ['li vencendo', 'di atrasada', 'material', 'generico']
    for (const q of queries) {
      const result = buildFallbackQuery(q)
      expect(result.odata?.select).toBeDefined()
      expect(result.odata!.select!.length).toBeGreaterThan(0)
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  calcLandedCost,
  TAX_SISCOMEX_FIXO,
  type CalcInput,
} from '../../../produtos/simula-custo/server/calc-engine.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    valorProduto: 1000,    // 1000 USD
    valorFrete: 100,       // 100 USD
    valorSeguro: 10,       // 10 USD
    taxasOrigem: 0,
    taxasDestino: 0,
    ptaxVenda: 6.0,        // 1 USD = R$ 6,00
    aliquotaII: 0.14,      // 14%
    aliquotaIPI: 0.05,     // 5%
    aliquotaPIS: 0.021,    // 2.1%
    aliquotaCOFINS: 0.0965, // 9.65%
    aliquotaICMS: 0.17,    // 17%
    ...overrides,
  }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('calcLandedCost', () => {
  it('calcula valor aduaneiro corretamente (CIF * ptax)', () => {
    const input = makeInput({
      valorProduto: 1000,
      valorFrete: 100,
      valorSeguro: 10,
      taxasOrigem: 0,
      ptaxVenda: 6.0,
    })
    const result = calcLandedCost(input)
    // (1000 + 100 + 10 + 0) * 6 = 6660
    expect(result.valorAduaneiro).toBeCloseTo(6660, 2)
  })

  it('calcula II corretamente sobre valor aduaneiro', () => {
    const input = makeInput({ aliquotaII: 0.14 })
    const result = calcLandedCost(input)
    // valorAduaneiro = (1000+100+10)*6 = 6660; ii = 6660 * 0.14 = 932.40
    expect(result.ii).toBeCloseTo(6660 * 0.14, 2)
  })

  it('calcula IPI sobre base (valorAduaneiro + II)', () => {
    const input = makeInput({ aliquotaII: 0.14, aliquotaIPI: 0.05 })
    const result = calcLandedCost(input)
    const va = 6660
    const ii = va * 0.14
    const ipi = (va + ii) * 0.05
    expect(result.ipi).toBeCloseTo(ipi, 2)
  })

  it('ICMS por dentro com aliquota 17% usa divisão por (1 - 0.17)', () => {
    // Apenas ICMS, sem outros impostos
    const input = makeInput({
      aliquotaII: 0,
      aliquotaIPI: 0,
      aliquotaPIS: 0,
      aliquotaCOFINS: 0,
      taxasDestino: 0,
      aliquotaICMS: 0.17,
    })
    const result = calcLandedCost(input)
    const va = (1000 + 100 + 10 + 0) * 6.0 // 6660
    const numerador = va + TAX_SISCOMEX_FIXO
    const esperado = numerador / (1 - 0.17)
    expect(result.landedCostBRL).toBeCloseTo(esperado, 2)
  })

  it('benefício fiscal reduz a alíquota efetiva do ICMS', () => {
    const inputSem = makeInput({ aliquotaICMS: 0.17, beneficioFiscalICMS: undefined })
    const inputCom = makeInput({ aliquotaICMS: 0.17, beneficioFiscalICMS: 0.05 })

    const resultSem = calcLandedCost(inputSem)
    const resultCom = calcLandedCost(inputCom)

    // Com benefício, o ICMS deve ser menor
    expect(resultCom.icms).toBeLessThan(resultSem.icms)
    // E o landed cost total deve ser menor também
    expect(resultCom.landedCostBRL).toBeLessThan(resultSem.landedCostBRL)
  })

  it('FCP adiciona à alíquota efetiva e gera componente separado', () => {
    const inputSem = makeInput({ aliquotaICMS: 0.17, aliquotaFCP: undefined })
    const inputCom = makeInput({ aliquotaICMS: 0.17, aliquotaFCP: 0.02 })

    const resultSem = calcLandedCost(inputSem)
    const resultCom = calcLandedCost(inputCom)

    // Com FCP, o landed cost deve ser maior
    expect(resultCom.landedCostBRL).toBeGreaterThan(resultSem.landedCostBRL)
    // FCP separado deve ser positivo
    expect(resultCom.fcp).toBeGreaterThan(0)
    // Sem FCP, o componente deve ser zero
    expect(resultSem.fcp).toBe(0)
  })

  it('acordo comercial com II reduzido (ex: 0%) reduz cascata de impostos', () => {
    const inputII14 = makeInput({ aliquotaII: 0.14 })
    const inputII0 = makeInput({ aliquotaII: 0 })

    const resultII14 = calcLandedCost(inputII14)
    const resultII0 = calcLandedCost(inputII0)

    // Com II menor, o IPI também cai (base = valorAduaneiro + ii)
    expect(resultII0.ii).toBe(0)
    expect(resultII0.ipi).toBeLessThan(resultII14.ipi)
    // Landed cost total deve ser menor
    expect(resultII0.landedCostBRL).toBeLessThan(resultII14.landedCostBRL)
  })

  it('todos os campos do CalcResult estão presentes e são não-negativos', () => {
    const result = calcLandedCost(makeInput())
    expect(result.valorAduaneiro).toBeGreaterThan(0)
    expect(result.ii).toBeGreaterThan(0)
    expect(result.ipi).toBeGreaterThan(0)
    expect(result.pis).toBeGreaterThan(0)
    expect(result.cofins).toBeGreaterThan(0)
    expect(result.taxaSiscomex).toBe(TAX_SISCOMEX_FIXO)
    expect(result.icms).toBeGreaterThan(0)
    expect(result.fcp).toBe(0)               // sem FCP no makeInput()
    expect(result.landedCostBRL).toBeGreaterThan(0)
  })

  it('taxaSiscomex é sempre igual à constante TAX_SISCOMEX_FIXO', () => {
    const result = calcLandedCost(makeInput())
    expect(result.taxaSiscomex).toBe(185.00)
    expect(result.taxaSiscomex).toBe(TAX_SISCOMEX_FIXO)
  })

  it('com taxasOrigem e taxasDestino os valores entram corretamente na base', () => {
    const inputSem = makeInput({ taxasOrigem: 0, taxasDestino: 0 })
    const inputCom = makeInput({ taxasOrigem: 50, taxasDestino: 200 })

    const resultSem = calcLandedCost(inputSem)
    const resultCom = calcLandedCost(inputCom)

    // taxasOrigem aumentam o valorAduaneiro (entram no CIF)
    expect(resultCom.valorAduaneiro).toBeGreaterThan(resultSem.valorAduaneiro)
    // taxasDestino entram no numerador do ICMS → landed cost maior
    expect(resultCom.landedCostBRL).toBeGreaterThan(resultSem.landedCostBRL)
  })

  it('resultado com benefício fiscal e FCP: icms + fcp = baseICMS * icmsEfetivo', () => {
    const aliquotaICMS = 0.17
    const beneficio = 0.03
    const fcp = 0.02
    const input = makeInput({ aliquotaICMS, beneficioFiscalICMS: beneficio, aliquotaFCP: fcp })
    const result = calcLandedCost(input)

    const icmsEfetivo = aliquotaICMS - beneficio + fcp // 0.16
    const baseICMS = result.landedCostBRL             // grossUp
    const componente = baseICMS * icmsEfetivo

    expect(result.icms + result.fcp).toBeCloseTo(componente, 2)
  })
})

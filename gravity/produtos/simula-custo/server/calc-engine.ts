export interface CalcInput {
  valorProduto: number     // em moeda estrangeira
  valorFrete: number
  valorSeguro: number
  taxasOrigem: number      // soma das taxas de origem em moeda estrangeira
  taxasDestino: number     // soma das taxas de destino em BRL
  ptaxVenda: number        // cotação do BACEN
  aliquotaII: number       // ex: 0.14 para 14%
  aliquotaIPI: number
  aliquotaPIS: number
  aliquotaCOFINS: number
  aliquotaICMS: number
  beneficioFiscalICMS?: number  // redutor opcional, ex: 0.05 para 5%
  aliquotaFCP?: number          // Fundo de Combate à Pobreza
}

export interface CalcResult {
  valorAduaneiro: number
  ii: number
  ipi: number
  pis: number
  cofins: number
  taxaSiscomex: number
  icms: number
  fcp: number
  landedCostBRL: number
}

export const TAX_SISCOMEX_FIXO = 185.00

export function calcLandedCost(input: CalcInput): CalcResult {
  const {
    valorProduto,
    valorFrete,
    valorSeguro,
    taxasOrigem,
    taxasDestino,
    ptaxVenda,
    aliquotaII,
    aliquotaIPI,
    aliquotaPIS,
    aliquotaCOFINS,
    aliquotaICMS,
    beneficioFiscalICMS,
    aliquotaFCP,
  } = input

  // 1. Valor aduaneiro (CIF convertido para BRL)
  const valorAduaneiro = (valorProduto + valorFrete + valorSeguro + taxasOrigem) * ptaxVenda

  // 2. II — Imposto de Importação
  const ii = valorAduaneiro * aliquotaII

  // 3. IPI — base é valorAduaneiro + II
  const ipi = (valorAduaneiro + ii) * aliquotaIPI

  // 4. PIS
  const pis = valorAduaneiro * aliquotaPIS

  // 5. COFINS
  const cofins = valorAduaneiro * aliquotaCOFINS

  // 6. Taxa Siscomex — valor fixo
  const taxaSiscomex = TAX_SISCOMEX_FIXO

  // 7. ICMS "por dentro" com benefício fiscal e FCP
  //    Alíquota efetiva = aliquotaICMS - benefício + FCP
  const icmsEfetivo = aliquotaICMS - (beneficioFiscalICMS ?? 0) + (aliquotaFCP ?? 0)

  //    Base de cálculo do ICMS (gross-up)
  const numerador = valorAduaneiro + ii + ipi + pis + cofins + taxaSiscomex + taxasDestino
  const baseICMS = numerador / (1 - icmsEfetivo)

  //    Componente ICMS puro (sem FCP)
  const icms = baseICMS * (aliquotaICMS - (beneficioFiscalICMS ?? 0))

  //    Componente FCP
  const fcp = baseICMS * (aliquotaFCP ?? 0)

  // 8. Landed cost = base bruta (ICMS já está dentro)
  const landedCostBRL = baseICMS

  return {
    valorAduaneiro,
    ii,
    ipi,
    pis,
    cofins,
    taxaSiscomex,
    icms,
    fcp,
    landedCostBRL,
  }
}

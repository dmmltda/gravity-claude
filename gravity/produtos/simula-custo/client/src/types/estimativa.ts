export interface TaxaEstimativa {
  id:           string
  estimativa_id: string
  tipo:         'origem' | 'destino'
  nome:         string
  moeda:        string
  valor:        number
}

export interface Estimativa {
  id:               string
  tenant_id:        string
  user_id:          string
  numero_sequencial: string
  descricao:        string
  ncm:              string
  incoterm:         string
  moeda:            string
  valor_produto:    number
  valor_frete:      number
  valor_seguro:     number
  ptax_utilizado:   number
  valor_aduaneiro:  number
  ii:               number
  ipi:              number
  pis:              number
  cofins:           number
  icms:             number
  fcp:              number
  taxa_siscomex:    number
  landed_cost_brl:  number
  status:           'rascunho' | 'criada' | 'arquivada'
  created_at:       string
  updated_at:       string
  taxas:            TaxaEstimativa[]
}

export interface CriarEstimativaInput {
  descricao:     string
  ncm:           string
  incoterm:      string
  moeda:         string
  valor_produto: number
  valor_frete:   number
  valor_seguro:  number
  ptax_utilizado: number
  taxas: Array<{
    tipo:  'origem' | 'destino'
    nome:  string
    moeda: string
    valor: number
  }>
}

export interface Aliquotas {
  ncm:           string
  aliquota_ii:   number
  aliquota_ipi:  number
  aliquota_pis:  number
  aliquota_cofins: number
  fonte:         string
  updated_at:    string | null
  fallback:      boolean
}

export interface Cambio {
  moeda:       string
  ptax_venda:  number
  ptax_compra: number
  data_cotacao: string | null
  fallback:    boolean
}

export interface KpisMes {
  total_estimado_brl: number
  quantidade:         number
  top_ncms:           Array<{ ncm: string; count: number }>
}

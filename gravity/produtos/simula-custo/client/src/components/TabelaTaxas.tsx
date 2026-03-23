import type { TaxaEstimativa } from '../types/estimativa.js'

interface TaxaRow {
  tipo:  'origem' | 'destino'
  nome:  string
  moeda: string
  valor: number
}

interface TabelaTaxasProps {
  tipo:     'origem' | 'destino'
  taxas:    TaxaRow[]
  onChange: (taxas: TaxaRow[]) => void
}

const NOMES_ORIGEM  = ['Inspeção', 'Fumigação', 'Pick-up', 'Outras']
const NOMES_DESTINO = ['Capatazia', 'Armazenagem', 'Despacho', 'SDA', 'Outras']
const MOEDAS = ['USD', 'EUR', 'CNY', 'BRL']

function linhaTaxa(tipo: 'origem' | 'destino'): TaxaRow {
  return { tipo, nome: '', moeda: tipo === 'destino' ? 'BRL' : 'USD', valor: 0 }
}

export function TabelaTaxas({ tipo, taxas, onChange }: TabelaTaxasProps) {
  const nomes = tipo === 'origem' ? NOMES_ORIGEM : NOMES_DESTINO

  function add() {
    onChange([...taxas, linhaTaxa(tipo)])
  }

  function remove(idx: number) {
    onChange(taxas.filter((_, i) => i !== idx))
  }

  function update<K extends keyof TaxaRow>(idx: number, key: K, val: TaxaRow[K]) {
    onChange(taxas.map((t, i) => (i === idx ? { ...t, [key]: val } : t)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {taxas.map((taxa, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 36px', gap: '0.5rem', alignItems: 'end' }}>
          <div className="field">
            {idx === 0 && <label className="label">Nome</label>}
            <select
              className="input"
              value={taxa.nome}
              onChange={(e) => update(idx, 'nome', e.target.value)}
            >
              <option value="">Selecionar...</option>
              {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="field">
            {idx === 0 && <label className="label">Moeda</label>}
            <select
              className="input"
              value={taxa.moeda}
              onChange={(e) => update(idx, 'moeda', e.target.value)}
            >
              {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="field">
            {idx === 0 && <label className="label">Valor</label>}
            <input
              type="number"
              className="input"
              min={0}
              step={0.01}
              value={taxa.valor}
              onChange={(e) => update(idx, 'valor', parseFloat(e.target.value) || 0)}
            />
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.5rem', height: '38px', marginTop: idx === 0 ? '1.375rem' : undefined }}
            onClick={() => remove(idx)}
            title="Remover taxa"
          >
            ✕
          </button>
        </div>
      ))}

      <button type="button" className="btn btn-ghost" onClick={add} style={{ alignSelf: 'flex-start' }}>
        + Adicionar taxa
      </button>
    </div>
  )
}

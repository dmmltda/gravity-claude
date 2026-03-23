import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { estimativasApi } from '../api/estimativas.js'
import { ncmApi } from '../api/ncm.js'
import { cambioApi } from '../api/cambio.js'
import { TabelaTaxas } from '../components/TabelaTaxas.js'
import type { CriarEstimativaInput } from '../types/estimativa.js'

type Aba = 'dados' | 'produto' | 'frete' | 'seguro' | 'taxas-origem' | 'taxas-destino'
const ABAS: Array<{ id: Aba; label: string }> = [
  { id: 'dados',         label: '1. Dados' },
  { id: 'produto',       label: '2. Produto' },
  { id: 'frete',         label: '3. Frete' },
  { id: 'seguro',        label: '4. Seguro' },
  { id: 'taxas-origem',  label: '5. Taxas Origem' },
  { id: 'taxas-destino', label: '6. Taxas Destino' },
]

const INCOTERMS  = ['FOB', 'CIF', 'FCA', 'EXW', 'DDP', 'DAP', 'CFR', 'CPT', 'CIP']
const MOEDAS     = ['USD', 'EUR', 'CNY', 'GBP', 'BRL']

interface TaxaRow { tipo: 'origem' | 'destino'; nome: string; moeda: string; valor: number }

interface FormState {
  descricao:      string
  ncm:            string
  incoterm:       string
  moeda:          string
  valor_produto:  string
  valor_frete:    string
  moeda_frete:    string
  valor_seguro:   string
  moeda_seguro:   string
  ptax_utilizado: string
  taxas_origem:   TaxaRow[]
  taxas_destino:  TaxaRow[]
}

const init: FormState = {
  descricao:      '',
  ncm:            '',
  incoterm:       'FOB',
  moeda:          'USD',
  valor_produto:  '',
  valor_frete:    '',
  moeda_frete:    'USD',
  valor_seguro:   '',
  moeda_seguro:   'USD',
  ptax_utilizado: '',
  taxas_origem:   [],
  taxas_destino:  [],
}

export function NovaEstimativa() {
  const navigate    = useNavigate()
  const [aba, setAba]         = useState<Aba>('dados')
  const [form, setForm]       = useState<FormState>(init)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState<string | null>(null)
  const [ptaxInfo, setPtaxInfo] = useState<string | null>(null)

  // Auto-busca PTAX ao selecionar moeda do produto
  useEffect(() => {
    if (!form.moeda) return
    cambioApi.cotacao(form.moeda)
      .then((c) => {
        setForm((f) => ({ ...f, ptax_utilizado: String(c.ptax_venda) }))
        setPtaxInfo(
          c.fallback
            ? `PTAX fallback: ${c.ptax_venda}`
            : `PTAX BACEN ${c.data_cotacao?.slice(0, 10) ?? ''}: ${c.ptax_venda}`
        )
      })
      .catch(() => setPtaxInfo(null))
  }, [form.moeda])

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function buscarAliquotas() {
    if (form.ncm.length !== 8) return
    try {
      const a = await ncmApi.aliquotas(form.ncm)
      const info = `II ${(a.aliquota_ii * 100).toFixed(1)}% · IPI ${(a.aliquota_ipi * 100).toFixed(1)}% · PIS ${(a.aliquota_pis * 100).toFixed(2)}% · COFINS ${(a.aliquota_cofins * 100).toFixed(2)}%`
      alert(`Alíquotas ${a.fallback ? '(fallback)' : '(SISCOMEX)'} para NCM ${form.ncm}:\n${info}`)
    } catch {
      alert('Não foi possível buscar alíquotas para este NCM.')
    }
  }

  async function salvarECalcular() {
    setErro(null)
    setSalvando(true)
    try {
      const body: CriarEstimativaInput = {
        descricao:      form.descricao,
        ncm:            form.ncm,
        incoterm:       form.incoterm,
        moeda:          form.moeda,
        valor_produto:  parseFloat(form.valor_produto) || 0,
        valor_frete:    parseFloat(form.valor_frete) || 0,
        valor_seguro:   parseFloat(form.valor_seguro) || 0,
        ptax_utilizado: parseFloat(form.ptax_utilizado) || 0,
        taxas: [
          ...form.taxas_origem,
          ...form.taxas_destino,
        ],
      }

      const est = await estimativasApi.criar(body)
      const calculada = await estimativasApi.calcular(est.id)
      navigate(`/estimativas/${calculada.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarRascunho() {
    setErro(null)
    setSalvando(true)
    try {
      const body: CriarEstimativaInput = {
        descricao:      form.descricao,
        ncm:            form.ncm,
        incoterm:       form.incoterm,
        moeda:          form.moeda,
        valor_produto:  parseFloat(form.valor_produto) || 0,
        valor_frete:    parseFloat(form.valor_frete) || 0,
        valor_seguro:   parseFloat(form.valor_seguro) || 0,
        ptax_utilizado: parseFloat(form.ptax_utilizado) || 0,
        taxas: [...form.taxas_origem, ...form.taxas_destino],
      }
      const est = await estimativasApi.criar(body)
      navigate(`/estimativas/${est.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: '0.375rem 0.75rem' }}>
          ← Voltar
        </button>
        <h1 style={{ fontSize: 'var(--text-heading)', fontWeight: 700 }}>Nova Estimativa</h1>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--color-border)', marginBottom: '2rem' }}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            className="btn btn-ghost"
            onClick={() => setAba(a.id)}
            style={{
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              borderBottom: aba === a.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: aba === a.id ? 'var(--color-accent)' : undefined,
              padding: '0.5rem 1rem',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="card">
        {/* ABA 1 — Dados */}
        {aba === 'dados' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="field">
              <label className="label">Descrição / Referência</label>
              <input className="input" type="text" placeholder="Ex: Importação Componentes China Q1/2026" value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
            </div>
          </div>
        )}

        {/* ABA 2 — Produto */}
        {aba === 'produto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div className="field">
                <label className="label">NCM (8 dígitos)</label>
                <input
                  className="input"
                  type="text"
                  maxLength={8}
                  placeholder="12345678"
                  value={form.ncm}
                  onChange={(e) => set('ncm', e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={buscarAliquotas}
                disabled={form.ncm.length !== 8}
                style={{ whiteSpace: 'nowrap' }}
              >
                Consultar alíquotas
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="field">
                <label className="label">Incoterm</label>
                <select className="input" value={form.incoterm} onChange={(e) => set('incoterm', e.target.value)}>
                  {INCOTERMS.map((i) => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Moeda do Produto</label>
                <select className="input" value={form.moeda} onChange={(e) => set('moeda', e.target.value)}>
                  {MOEDAS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="field">
                <label className="label">Valor Total do Produto ({form.moeda})</label>
                <input className="input" type="number" min={0} step={0.01} placeholder="0.00" value={form.valor_produto} onChange={(e) => set('valor_produto', e.target.value)} />
              </div>
              <div className="field">
                <label className="label">PTAX Venda (BRL/{form.moeda})</label>
                <input className="input" type="number" min={0} step={0.0001} placeholder="0.0000" value={form.ptax_utilizado} onChange={(e) => set('ptax_utilizado', e.target.value)} />
                {ptaxInfo && <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{ptaxInfo}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ABA 3 — Frete */}
        {aba === 'frete' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="field">
              <label className="label">Moeda do Frete</label>
              <select className="input" value={form.moeda_frete} onChange={(e) => set('moeda_frete', e.target.value)}>
                {MOEDAS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Valor do Frete Internacional ({form.moeda_frete})</label>
              <input className="input" type="number" min={0} step={0.01} placeholder="0.00" value={form.valor_frete} onChange={(e) => set('valor_frete', e.target.value)} />
            </div>
          </div>
        )}

        {/* ABA 4 — Seguro */}
        {aba === 'seguro' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="field">
              <label className="label">Moeda do Seguro</label>
              <select className="input" value={form.moeda_seguro} onChange={(e) => set('moeda_seguro', e.target.value)}>
                {MOEDAS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Valor do Seguro Internacional ({form.moeda_seguro})</label>
              <input className="input" type="number" min={0} step={0.01} placeholder="0.00" value={form.valor_seguro} onChange={(e) => set('valor_seguro', e.target.value)} />
            </div>
          </div>
        )}

        {/* ABA 5 — Taxas Origem */}
        {aba === 'taxas-origem' && (
          <TabelaTaxas
            tipo="origem"
            taxas={form.taxas_origem}
            onChange={(t) => set('taxas_origem', t)}
          />
        )}

        {/* ABA 6 — Taxas Destino */}
        {aba === 'taxas-destino' && (
          <TabelaTaxas
            tipo="destino"
            taxas={form.taxas_destino}
            onChange={(t) => set('taxas_destino', t)}
          />
        )}
      </div>

      {erro && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 'var(--text-small)' }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={salvarRascunho} disabled={salvando}>
          Salvar Rascunho
        </button>
        <button className="btn btn-primary" onClick={salvarECalcular} disabled={salvando || !form.descricao || !form.ncm || !form.valor_produto}>
          {salvando ? 'Calculando...' : 'Calcular Landed Cost →'}
        </button>
      </div>
    </div>
  )
}

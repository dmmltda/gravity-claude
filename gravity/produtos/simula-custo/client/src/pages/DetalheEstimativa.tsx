import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { estimativasApi } from '../api/estimativas.js'
import type { Estimativa } from '../types/estimativa.js'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const PCT = (v: number) => `${(v * 100).toFixed(2)}%`

interface LinhaImposto { label: string; valor: number; destaque?: boolean }

export function DetalheEstimativa() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [est, setEst]         = useState<Estimativa | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    estimativasApi.buscar(id)
      .then(setEst)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [id])

  async function recalcular() {
    if (!id) return
    setCalculando(true)
    try {
      const atualizada = await estimativasApi.calcular(id)
      setEst(atualizada)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao calcular')
    } finally {
      setCalculando(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
  }

  if (erro || !est) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-error)' }}>
        {erro ?? 'Estimativa não encontrada'}
        <br />
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>
          ← Voltar
        </button>
      </div>
    )
  }

  const impostos: LinhaImposto[] = [
    { label: 'Valor Aduaneiro (base CIF em BRL)', valor: est.valor_aduaneiro },
    { label: 'II — Imposto de Importação',         valor: est.ii },
    { label: 'IPI — Imposto s/ Produtos Industrializados', valor: est.ipi },
    { label: 'PIS',                                valor: est.pis },
    { label: 'COFINS',                             valor: est.cofins },
    { label: 'ICMS (por dentro)',                  valor: est.icms },
    { label: 'FCP — Fundo de Combate à Pobreza',   valor: est.fcp },
    { label: 'Taxa Siscomex',                      valor: est.taxa_siscomex },
    { label: 'Landed Cost Total',                  valor: est.landed_cost_brl, destaque: true },
  ]

  const taxasOrigem  = est.taxas.filter((t) => t.tipo === 'origem')
  const taxasDestino = est.taxas.filter((t) => t.tipo === 'destino')

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: '0.375rem 0.75rem' }}>
            ← Voltar
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ fontSize: 'var(--text-heading)', fontWeight: 700 }}>{est.numero_sequencial}</h1>
              <span className={`badge badge-${est.status}`}>{est.status}</span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{est.descricao}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            to={`/estimativas/${est.id}/editar`}
            className="btn btn-secondary"
          >
            Editar
          </Link>
          {est.status !== 'arquivada' && (
            <button className="btn btn-primary" onClick={recalcular} disabled={calculando}>
              {calculando ? 'Recalculando...' : 'Recalcular'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Dados da operação */}
        <div className="card">
          <h2 style={{ fontSize: 'var(--text-small)', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Dados da Operação
          </h2>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {[
              ['NCM',       est.ncm],
              ['Incoterm',  est.incoterm],
              ['Moeda',     est.moeda],
              ['PTAX',      `R$ ${est.ptax_utilizado.toFixed(4)}`],
              ['Vlr. Produto', `${est.moeda} ${est.valor_produto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
              ['Frete',     `${est.moeda} ${est.valor_frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
              ['Seguro',    `${est.moeda} ${est.valor_seguro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-small)' }}>
                <dt style={{ color: 'var(--color-text-muted)' }}>{k}</dt>
                <dd style={{ fontWeight: 600 }}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Taxas */}
        <div className="card">
          <h2 style={{ fontSize: 'var(--text-small)', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Taxas
          </h2>
          {taxasOrigem.length > 0 && (
            <>
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>ORIGEM</p>
              {taxasOrigem.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-small)', marginBottom: '0.375rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{t.nome}</span>
                  <span style={{ fontWeight: 600 }}>{t.moeda} {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </>
          )}
          {taxasDestino.length > 0 && (
            <>
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', margin: '0.75rem 0 0.5rem', fontWeight: 600 }}>DESTINO</p>
              {taxasDestino.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-small)', marginBottom: '0.375rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{t.nome}</span>
                  <span style={{ fontWeight: 600 }}>{t.moeda} {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </>
          )}
          {taxasOrigem.length === 0 && taxasDestino.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-small)' }}>Nenhuma taxa informada.</p>
          )}
        </div>
      </div>

      {/* Memória de Cálculo */}
      {est.status === 'criada' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: 'var(--text-small)', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Memória de Cálculo
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {impostos.map((linha) => (
                <tr
                  key={linha.label}
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    background: linha.destaque ? 'var(--color-bg-surface)' : undefined,
                  }}
                >
                  <td style={{ padding: '0.75rem 1rem', fontSize: 'var(--text-small)', color: linha.destaque ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: linha.destaque ? 700 : 400 }}>
                    {linha.label}
                  </td>
                  <td
                    data-testid={linha.destaque ? 'landed-cost' : undefined}
                    style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: 'var(--text-small)', fontWeight: 700, color: linha.destaque ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                  >
                    {BRL.format(linha.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {est.status === 'rascunho' && (
        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--color-warning)' }}>Rascunho — cálculo não realizado</p>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Preencha todos os campos e clique em Recalcular para obter o Landed Cost.</p>
          </div>
          <button className="btn btn-primary" onClick={recalcular} disabled={calculando}>
            {calculando ? 'Calculando...' : 'Calcular agora'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { estimativasApi, type ListEstimativasResponse } from '../api/estimativas.js'
import { KpiCard } from '../components/KpiCard.js'
import type { Estimativa } from '../types/estimativa.js'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function statusBadge(status: Estimativa['status']) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

export function Dashboard() {
  const navigate = useNavigate()
  const [data, setData]       = useState<ListEstimativasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState<string | null>(null)
  const [pagina, setPagina]   = useState(1)

  useEffect(() => {
    setLoading(true)
    estimativasApi
      .listar({ page: pagina, limit: 20 })
      .then(setData)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [pagina])

  // KPIs derivados da lista
  const totalBRL = data?.data
    .filter((e) => e.status === 'criada')
    .reduce((acc, e) => acc + e.landed_cost_brl, 0) ?? 0

  const quantidade = data?.meta.total ?? 0

  const topNcms = Object.entries(
    (data?.data ?? []).reduce<Record<string, number>>((acc, e) => {
      acc[e.ncm] = (acc[e.ncm] ?? 0) + 1
      return acc
    }, {})
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  async function arquivar(id: string) {
    if (!confirm('Arquivar esta estimativa?')) return
    await estimativasApi.arquivar(id)
    setData((prev) =>
      prev
        ? { ...prev, data: prev.data.filter((e) => e.id !== id) }
        : prev
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-heading)', fontWeight: 700 }}>SimulaCusto</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Simulador de Custo de Importação
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/estimativas/nova')}
        >
          + Nova Estimativa
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <KpiCard
          label="Total Estimado (mês)"
          value={BRL.format(totalBRL)}
          sub="estimativas com status criada"
          accent
          icon="💰"
        />
        <KpiCard
          label="Total de Estimativas"
          value={quantidade}
          sub="no período atual"
          icon="📋"
        />
        <KpiCard
          label="Top NCMs"
          value={topNcms.map(([ncm]) => ncm).join(' · ') || '—'}
          sub="NCMs mais simulados"
          icon="🔢"
        />
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 'var(--text-small)', fontWeight: 600 }}>Estimativas</h2>
        </div>

        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Carregando...
          </div>
        )}

        {erro && (
          <div style={{ padding: '2rem', color: 'var(--color-error)', textAlign: 'center' }}>
            {erro}
          </div>
        )}

        {!loading && !erro && data && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['ID', 'Descrição', 'NCM', 'Landed Cost (BRL)', 'Status', 'Ações'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.75rem 1.5rem',
                      textAlign: 'left',
                      fontSize: 'var(--text-micro)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((est) => (
                <tr
                  key={est.id}
                  style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '1rem 1.5rem', fontSize: 'var(--text-small)', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                    {est.numero_sequencial}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: 'var(--text-small)' }}>
                    {est.descricao}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: 'var(--text-small)', fontFamily: 'monospace' }}>
                    {est.ncm}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--color-accent)' }}>
                    {est.status === 'criada' ? BRL.format(est.landed_cost_brl) : '—'}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    {statusBadge(est.status)}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link
                        to={`/estimativas/${est.id}`}
                        className="btn btn-ghost"
                        style={{ padding: '0.375rem 0.75rem', fontSize: 'var(--text-small)' }}
                      >
                        Ver
                      </Link>
                      <Link
                        to={`/estimativas/${est.id}/editar`}
                        className="btn btn-secondary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: 'var(--text-small)' }}
                      >
                        Editar
                      </Link>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '0.375rem 0.75rem', fontSize: 'var(--text-small)', color: 'var(--color-error)' }}
                        onClick={() => arquivar(est.id)}
                      >
                        Arquivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {data.data.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhuma estimativa encontrada.{' '}
                    <button className="btn btn-ghost" onClick={() => navigate('/estimativas/nova')} style={{ display: 'inline' }}>
                      Criar a primeira
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Paginação */}
        {data && data.meta.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
            <button
              className="btn btn-ghost"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              ← Anterior
            </button>
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-small)' }}>
              {pagina} / {data.meta.pages}
            </span>
            <button
              className="btn btn-ghost"
              disabled={pagina === data.meta.pages}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

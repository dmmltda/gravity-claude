// servicos-global/tenant/historico/src/Historico.tsx
import React, { useState, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ActorType = 'user' | 'gabi' | 'system'

type ActionType =
  | 'CRIAÇÃO'
  | 'ALTERAÇÃO'
  | 'EXCLUSÃO'
  | 'ENVIO'
  | 'RECEBIMENTO'
  | 'EXPORTAÇÃO'
  | 'LOGIN'
  | 'CONFIGURAÇÃO'
  | 'IA'

interface DiffItem {
  field:  string
  label:  string
  before: string | null
  after:  string | null
}

interface AuditLogRow {
  id:           string
  actor_type:   ActorType
  actor_name:   string
  action:       ActionType
  entity:       string
  entity_label: string
  entity_id:    string | null
  description:  string
  product_id:   string | null
  created_at:   string
  // diff: só presente no detalhe (/:id), não na listagem
  diff?: DiffItem[]
}

interface Pagination {
  page:  number
  limit: number
  total: number
  pages: number
}

interface Filters {
  search:     string
  action:     string
  actor_type: string
  entity:     string
  from:       string
  to:         string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTION_BADGE: Record<ActionType, { label: string; bg: string; color: string }> = {
  'CRIAÇÃO':      { label: 'CRIAÇÃO',      bg: '#dcfce7', color: '#15803d' },
  'ALTERAÇÃO':    { label: 'ALTERAÇÃO',    bg: '#dbeafe', color: '#1d4ed8' },
  'EXCLUSÃO':     { label: 'EXCLUSÃO',     bg: '#fee2e2', color: '#dc2626' },
  'ENVIO':        { label: 'ENVIO',        bg: '#f3e8ff', color: '#7c3aed' },
  'RECEBIMENTO':  { label: 'RECEBIMENTO',  bg: '#fef3c7', color: '#d97706' },
  'EXPORTAÇÃO':   { label: 'EXPORTAÇÃO',   bg: '#f1f5f9', color: '#475569' },
  'LOGIN':        { label: 'LOGIN',        bg: '#ccfbf1', color: '#0f766e' },
  'CONFIGURAÇÃO': { label: 'CONFIGURAÇÃO', bg: '#ffedd5', color: '#c2410c' },
  'IA':           { label: 'IA',           bg: '#e0e7ff', color: '#4338ca' },
}

function actorIcon(actorType: ActorType): string {
  if (actorType === 'user')   return '👤'
  if (actorType === 'gabi')   return '🤖'
  return '⚙️'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 16)
}

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 16)
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: ActionType }) {
  const cfg = ACTION_BADGE[action] ?? { label: action, bg: '#f1f5f9', color: '#475569' }
  return (
    <span
      style={{
        backgroundColor: cfg.bg,
        color:            cfg.color,
        padding:          '2px 8px',
        borderRadius:     4,
        fontSize:         11,
        fontWeight:       700,
        letterSpacing:    0.5,
        whiteSpace:       'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}

function DiffTable({ diff }: { diff: DiffItem[] }) {
  if (!diff.length) {
    return <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>Sem diff registrado.</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {(['CAMPO', 'ANTES', 'DEPOIS'] as const).map((col) => (
            <th
              key={col}
              style={{
                textAlign:   'left',
                padding:     '4px 8px',
                borderBottom: '1px solid var(--color-border)',
                color:        'var(--color-muted)',
                fontWeight:   600,
                fontSize:     11,
              }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {diff.map((item) => (
          <tr key={item.field}>
            <td style={{ padding: '4px 8px', fontWeight: 500 }}>{item.label}</td>
            <td style={{ padding: '4px 8px', color: '#dc2626' }}>{item.before ?? '—'}</td>
            <td style={{ padding: '4px 8px', color: '#16a34a' }}>{item.after ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Historico() {
  const [filters, setFilters] = useState<Filters>({
    search:     '',
    action:     '',
    actor_type: '',
    entity:     '',
    from:       defaultFrom(),
    to:         defaultTo(),
  })

  const [logs, setLogs]               = useState<AuditLogRow[]>([])
  const [pagination, setPagination]   = useState<Pagination | null>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [expandedDiff, setExpandedDiff] = useState<DiffItem[] | null>(null)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const buildQuery = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        from:  new Date(filters.from).toISOString(),
        to:    new Date(filters.to).toISOString(),
        page:  String(p),
        limit: '30',
      })
      if (filters.search)     params.set('search', filters.search)
      if (filters.action)     params.set('action', filters.action)
      if (filters.actor_type) params.set('actor_type', filters.actor_type)
      if (filters.entity)     params.set('entity', filters.entity)
      return params.toString()
    },
    [filters]
  )

  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`/api/v1/historico?${buildQuery(p)}`)
        const json = await res.json() as { data: AuditLogRow[]; pagination: Pagination }
        setLogs(json.data)
        setPagination(json.pagination)
        setPage(p)
      } catch {
        setError('Erro ao carregar o histórico. Tente novamente.')
      } finally {
        setLoading(false)
      }
    },
    [buildQuery]
  )

  const toggleExpand = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null)
        setExpandedDiff(null)
        return
      }
      setExpandedId(id)
      setExpandedDiff(null)
      try {
        const res  = await fetch(`/api/v1/historico/${id}`)
        const json = await res.json() as AuditLogRow
        setExpandedDiff((json.diff as DiffItem[]) ?? [])
      } catch {
        setExpandedDiff([])
      }
    },
    [expandedId]
  )

  function handleFilterChange(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    void fetchLogs(1)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 700 }}>Histórico de Alterações</h2>

      {/* Filtros */}
      <form
        onSubmit={handleSearch}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
      >
        <input
          type="text"
          placeholder="🔍 Pesquisar..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          style={inputStyle}
        />

        <select
          value={filters.action}
          onChange={(e) => handleFilterChange('action', e.target.value)}
          style={inputStyle}
        >
          <option value="">Todas as ações</option>
          {(Object.keys(ACTION_BADGE) as ActionType[]).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filters.actor_type}
          onChange={(e) => handleFilterChange('actor_type', e.target.value)}
          style={inputStyle}
        >
          <option value="">Quem</option>
          <option value="user">👤 Usuário</option>
          <option value="gabi">🤖 Gabi AI</option>
          <option value="system">⚙️ Sistema</option>
        </select>

        <input
          type="text"
          placeholder="Módulo"
          value={filters.entity}
          onChange={(e) => handleFilterChange('entity', e.target.value)}
          style={{ ...inputStyle, maxWidth: 140 }}
        />

        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => handleFilterChange('from', e.target.value)}
          style={inputStyle}
        />

        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => handleFilterChange('to', e.target.value)}
          style={inputStyle}
        />

        <button type="submit" style={buttonStyle} disabled={loading}>
          {loading ? 'Carregando...' : 'Buscar'}
        </button>
      </form>

      {error && (
        <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>
      )}

      {/* Tabela */}
      {logs.length === 0 && !loading && (
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          Nenhum registro encontrado. Ajuste os filtros e clique em Buscar.
        </p>
      )}

      {logs.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)' }}>
                {['QUANDO', 'QUEM', 'AÇÃO', 'O QUE FOI FEITO', 'MÓDULO', ''].map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign:    'left',
                      padding:      '10px 12px',
                      borderBottom: '1px solid var(--color-border)',
                      fontWeight:   600,
                      fontSize:     11,
                      color:        'var(--color-muted)',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      cursor:       'pointer',
                    }}
                    onClick={() => void toggleExpand(log.id)}
                  >
                    <td style={cellStyle}>{formatDate(log.created_at)}</td>
                    <td style={cellStyle}>
                      {actorIcon(log.actor_type)} {log.actor_name}
                    </td>
                    <td style={cellStyle}>
                      <ActionBadge action={log.action} />
                    </td>
                    <td style={{ ...cellStyle, maxWidth: 320 }}>{log.description}</td>
                    <td style={cellStyle}>{log.entity_label}</td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      {expandedId === log.id ? '▲' : '▼'}
                    </td>
                  </tr>

                  {expandedId === log.id && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding:          '12px 24px 16px',
                          background:       'var(--color-surface)',
                          borderBottom:     '1px solid var(--color-border)',
                        }}
                      >
                        {expandedDiff === null ? (
                          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                            Carregando detalhes...
                          </p>
                        ) : (
                          <DiffTable diff={expandedDiff} />
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button
            style={buttonStyle}
            disabled={page <= 1 || loading}
            onClick={() => void fetchLogs(page - 1)}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 13 }}>
            Página {page} de {pagination.pages} ({pagination.total} registros)
          </span>
          <button
            style={buttonStyle}
            disabled={page >= pagination.pages || loading}
            onClick={() => void fetchLogs(page + 1)}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Estilos utilitários ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding:      '6px 10px',
  borderRadius:  4,
  border:       '1px solid var(--color-border)',
  fontSize:      13,
  background:   'var(--color-surface)',
  color:        'var(--color-text)',
  minWidth:      140,
}

const buttonStyle: React.CSSProperties = {
  padding:       '6px 14px',
  borderRadius:   4,
  border:        'none',
  background:    'var(--color-primary)',
  color:         '#fff',
  fontSize:       13,
  fontWeight:     600,
  cursor:        'pointer',
}

const cellStyle: React.CSSProperties = {
  padding:   '10px 12px',
  verticalAlign: 'middle',
}

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailStats {
  total_threads: number
  open_threads: number
  avg_sentiment: number
  gabi_replied: number
  escalated_to_human: number
}

interface EmailThread {
  id: string
  subject: string
  sentiment: number
  status: 'open' | 'archived' | 'resolved'
  created_at: string
  updated_at: string
  _count: { messages: number }
}

interface EmailMessage {
  id: string
  direction: 'inbound' | 'outbound'
  from: string
  to: string
  body: string
  sent_at: string
  gabi_response: string | null
  gabi_confidence: number | null
  gabi_analysis: Record<string, unknown> | null
}

interface ThreadDetail extends EmailThread {
  messages: EmailMessage[]
}

type FilterStatus = 'all' | 'open' | 'archived' | 'resolved'
type FilterSentiment = 'all' | 'positive' | 'neutral' | 'negative'

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
      {sub && <span style={styles.statSub}>{sub}</span>}
    </div>
  )
}

// ─── Sentiment Badge ──────────────────────────────────────────────────────────

function SentimentBadge({ score }: { score: number }) {
  const { emoji, color } =
    score > 0.5
      ? { emoji: '❤️', color: '#22c55e' }
      : score > 0.2
        ? { emoji: '✅', color: '#86efac' }
        : score > -0.2
          ? { emoji: '😐', color: '#94a3b8' }
          : score > -0.5
            ? { emoji: '⚠️', color: '#f59e0b' }
            : { emoji: '🔴', color: '#ef4444' }
  return (
    <span style={{ color, fontWeight: 600, fontSize: 14 }}>
      {emoji} {score.toFixed(2)}
    </span>
  )
}

// ─── Thread Modal ─────────────────────────────────────────────────────────────

interface ThreadModalProps {
  threadId: string
  onClose: () => void
  onStatusChange: (id: string, status: 'open' | 'archived' | 'resolved') => void
}

function ThreadModal({ threadId, onClose, onStatusChange }: ThreadModalProps) {
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [replyHtml, setReplyHtml] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadThread = useCallback(async () => {
    const res = await fetch(`/api/v1/email/threads/${threadId}`)
    if (!res.ok) return
    const data = await res.json() as ThreadDetail
    setThread(data)
  }, [threadId])

  useEffect(() => { void loadThread() }, [loadThread])

  const handleReply = async () => {
    if (!thread || !replyHtml.trim()) return
    setSending(true)
    setError(null)
    try {
      const last = thread.messages.findLast((m) => m.direction === 'inbound')
      const res = await fetch('/api/v1/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: last?.from ?? '',
          subject: `Re: ${thread.subject}`,
          html: replyHtml,
          thread_id: thread.id,
        }),
      })
      if (!res.ok) throw new Error('Falha ao enviar')
      setReplyHtml('')
      void loadThread()
    } catch {
      setError('Erro ao enviar resposta.')
    } finally {
      setSending(false)
    }
  }

  if (!thread) {
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modal}><p style={styles.loading}>Carregando thread…</p></div>
      </div>
    )
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>{thread.subject}</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
              <SentimentBadge score={thread.sentiment} />
              <span style={styles.statusBadge(thread.status)}>{thread.status}</span>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.messageList}>
          {thread.messages.map((msg) => (
            <div key={msg.id} style={styles.messageItem(msg.direction)}>
              <div style={styles.messageMeta}>
                <span>{msg.direction === 'inbound' ? `De: ${msg.from}` : `Para: ${msg.to}`}</span>
                <span>{new Date(msg.sent_at).toLocaleString('pt-BR')}</span>
              </div>
              <div
                style={styles.messageBody}
                dangerouslySetInnerHTML={{ __html: msg.body }}
              />
              {msg.gabi_response && (
                <div style={styles.gabiBox}>
                  <strong>Gabi:</strong> {msg.gabi_response}
                  {msg.gabi_confidence !== null && (
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>
                      (confiança: {(msg.gabi_confidence * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.replyArea}>
          <textarea
            value={replyHtml}
            onChange={(e) => setReplyHtml(e.target.value)}
            placeholder="Resposta (HTML ou texto)…"
            style={styles.textarea}
            rows={4}
          />
          {error && <p style={{ color: '#ef4444', margin: '4px 0' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={styles.btnPrimary} onClick={handleReply} disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar Resposta'}
            </button>
            <button style={styles.btnSecondary} onClick={() => onStatusChange(thread.id, 'resolved')}>
              Resolver
            </button>
            <button style={styles.btnSecondary} onClick={() => onStatusChange(thread.id, 'archived')}>
              Arquivar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Email() {
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterSentiment, setFilterSentiment] = useState<FilterSentiment>('all')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/v1/email/stats')
    if (res.ok) setStats(await res.json() as EmailStats)
  }, [])

  const fetchThreads = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (filterSentiment !== 'all') params.set('sentiment', filterSentiment)
    const res = await fetch(`/api/v1/email/threads?${params.toString()}`)
    if (!res.ok) return
    const data = await res.json() as { threads: EmailThread[]; total: number }
    setThreads(data.threads)
    setTotal(data.total)
  }, [filterStatus, filterSentiment, page])

  // Stats polling a cada 2 segundos
  useEffect(() => {
    void fetchStats()
    const interval = setInterval(() => { void fetchStats() }, 2000)
    return () => clearInterval(interval)
  }, [fetchStats])

  useEffect(() => { void fetchThreads() }, [fetchThreads])

  // Deep link: /email/thread/{uuid}
  useEffect(() => {
    const match = window.location.pathname.match(/\/email\/thread\/([0-9a-f-]{36})/)
    if (match) setSelectedThreadId(match[1])
  }, [])

  const handleStatusChange = async (id: string, status: 'open' | 'archived' | 'resolved') => {
    await fetch(`/api/v1/email/threads/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setSelectedThreadId(null)
    void fetchThreads()
    void fetchStats()
  }

  const sentimentLabel = (score: number) =>
    score > 0.2 ? 'Positivo' : score < -0.2 ? 'Negativo' : 'Neutro'

  return (
    <div style={styles.root}>
      <h1 style={styles.pageTitle}>Caixa de Emails</h1>

      {/* Stat Cards */}
      <div style={styles.statsRow}>
        <StatCard label="Total de Threads" value={stats?.total_threads ?? '—'} />
        <StatCard label="Em Aberto" value={stats?.open_threads ?? '—'} />
        <StatCard
          label="Sentimento Médio"
          value={stats ? sentimentLabel(stats.avg_sentiment) : '—'}
          sub={stats ? stats.avg_sentiment.toFixed(2) : undefined}
        />
        <StatCard label="Respostas Gabi" value={stats?.gabi_replied ?? '—'} />
        <StatCard label="Escalados p/ Humano" value={stats?.escalated_to_human ?? '—'} />
      </div>

      {/* Filtros */}
      <div style={styles.filterRow}>
        <label style={styles.filterLabel}>Status:</label>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as FilterStatus); setPage(1) }}
          style={styles.select}
        >
          <option value="all">Todos</option>
          <option value="open">Aberto</option>
          <option value="archived">Arquivado</option>
          <option value="resolved">Resolvido</option>
        </select>

        <label style={styles.filterLabel}>Sentimento:</label>
        <select
          value={filterSentiment}
          onChange={(e) => { setFilterSentiment(e.target.value as FilterSentiment); setPage(1) }}
          style={styles.select}
        >
          <option value="all">Todos</option>
          <option value="positive">Positivo</option>
          <option value="neutral">Neutro</option>
          <option value="negative">Negativo</option>
        </select>
      </div>

      {/* Thread List */}
      <table style={styles.table}>
        <thead>
          <tr>
            {['Assunto', 'Status', 'Sentimento', 'Mensagens', 'Última Atualização', ''].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {threads.map((t) => (
            <tr
              key={t.id}
              style={styles.tr}
              onClick={() => setSelectedThreadId(t.id)}
            >
              <td style={styles.td}>{t.subject}</td>
              <td style={styles.td}>
                <span style={styles.statusBadge(t.status)}>{t.status}</span>
              </td>
              <td style={styles.td}><SentimentBadge score={t.sentiment} /></td>
              <td style={styles.td}>{t._count.messages}</td>
              <td style={styles.td}>{new Date(t.updated_at).toLocaleString('pt-BR')}</td>
              <td style={styles.td}>
                <button
                  style={styles.btnLink}
                  onClick={(e) => {
                    e.stopPropagation()
                    window.history.pushState({}, '', `/email/thread/${t.id}`)
                    setSelectedThreadId(t.id)
                  }}
                >
                  Abrir
                </button>
              </td>
            </tr>
          ))}
          {threads.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...styles.td, textAlign: 'center', opacity: 0.5 }}>
                Nenhuma thread encontrada
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Paginação */}
      <div style={styles.pagination}>
        <button
          style={styles.btnSecondary}
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          ← Anterior
        </button>
        <span style={{ padding: '0 16px' }}>
          Página {page} · {total} threads
        </span>
        <button
          style={styles.btnSecondary}
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima →
        </button>
      </div>

      {/* Thread Modal */}
      {selectedThreadId && (
        <ThreadModal
          threadId={selectedThreadId}
          onClose={() => {
            setSelectedThreadId(null)
            window.history.pushState({}, '', '/email')
          }}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}

// ─── Styles (CSS-in-JS com tokens do Gravity Design System) ───────────────────

const styles = {
  root: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    background: 'var(--color-bg, #0f172a)',
    color: 'var(--color-text, #f1f5f9)',
    minHeight: '100vh',
    padding: '24px 32px',
  } as React.CSSProperties,

  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 20,
    color: 'var(--color-text-primary, #f8fafc)',
  } as React.CSSProperties,

  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 16,
    marginBottom: 24,
  } as React.CSSProperties,

  statCard: {
    background: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  } as React.CSSProperties,

  statValue: { fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary, #f8fafc)' },
  statLabel: { fontSize: 13, color: 'var(--color-text-muted, #94a3b8)' },
  statSub: { fontSize: 12, color: 'var(--color-text-muted, #64748b)' },

  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  } as React.CSSProperties,

  filterLabel: { fontSize: 14, color: 'var(--color-text-muted, #94a3b8)' } as React.CSSProperties,

  select: {
    background: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 8,
    color: 'var(--color-text, #f1f5f9)',
    padding: '6px 12px',
    fontSize: 14,
    cursor: 'pointer',
  } as React.CSSProperties,

  table: { width: '100%', borderCollapse: 'collapse' as const } as React.CSSProperties,

  th: {
    textAlign: 'left' as const,
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-muted, #94a3b8)',
    borderBottom: '1px solid var(--color-border, #334155)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,

  tr: {
    cursor: 'pointer',
    transition: 'background 0.15s',
    borderBottom: '1px solid var(--color-border, #1e293b)',
  } as React.CSSProperties,

  td: {
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--color-text, #e2e8f0)',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,

  statusBadge: (status: string) =>
    ({
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background:
        status === 'open'
          ? '#1d4ed8'
          : status === 'resolved'
            ? '#166534'
            : '#374151',
      color: '#fff',
    }) as React.CSSProperties,

  btnLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-primary, #3b82f6)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    padding: 0,
  } as React.CSSProperties,

  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    fontSize: 14,
  } as React.CSSProperties,

  // Modal
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,

  modal: {
    background: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 720,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  } as React.CSSProperties,

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--color-border, #334155)',
  } as React.CSSProperties,

  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--color-text-primary, #f8fafc)',
    margin: 0,
  } as React.CSSProperties,

  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted, #94a3b8)',
    fontSize: 20,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  } as React.CSSProperties,

  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  } as React.CSSProperties,

  messageItem: (direction: 'inbound' | 'outbound') =>
    ({
      background: direction === 'inbound' ? 'var(--color-bg, #0f172a)' : '#1d4ed820',
      border: `1px solid ${direction === 'inbound' ? '#334155' : '#1d4ed840'}`,
      borderRadius: 10,
      padding: '12px 16px',
    }) as React.CSSProperties,

  messageMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: 'var(--color-text-muted, #94a3b8)',
    marginBottom: 8,
  } as React.CSSProperties,

  messageBody: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--color-text, #e2e8f0)',
  } as React.CSSProperties,

  gabiBox: {
    marginTop: 8,
    padding: '8px 12px',
    background: '#0d9488',
    borderRadius: 8,
    fontSize: 13,
    color: '#fff',
  } as React.CSSProperties,

  replyArea: {
    padding: '16px 24px',
    borderTop: '1px solid var(--color-border, #334155)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,

  textarea: {
    background: 'var(--color-bg, #0f172a)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 8,
    color: 'var(--color-text, #f1f5f9)',
    fontSize: 14,
    padding: '10px 14px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,

  btnPrimary: {
    background: 'var(--color-primary, #3b82f6)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 20px',
  } as React.CSSProperties,

  btnSecondary: {
    background: 'var(--color-surface, #1e293b)',
    border: '1px solid var(--color-border, #334155)',
    borderRadius: 8,
    color: 'var(--color-text, #e2e8f0)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '8px 16px',
  } as React.CSSProperties,

  loading: { padding: 40, textAlign: 'center' as const, opacity: 0.5 } as React.CSSProperties,
}

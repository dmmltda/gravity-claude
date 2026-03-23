import React, { useState, useEffect, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
type SlaStatus = 'ok' | 'warning' | 'breached'

interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: string | null
  assigned_to: string | null
  user_id: string
  sla_deadline: string | null
  sla_breached: boolean
  sla_status: SlaStatus
  resolved_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  _count?: { messages: number }
}

interface HelpdeskMessage {
  id: string
  content: string
  user_id: string
  is_internal: boolean
  attachments: unknown[]
  created_at: string
}

interface TicketDetail extends Ticket {
  messages: HelpdeskMessage[]
}

interface Queue {
  id: string
  name: string
  description: string | null
  sla_hours: number
  agents: string[]
  active: boolean
}

interface Stats {
  open_tickets: number
  closed_tickets: number
  avg_resolution_hours: number
  sla_compliance_percent: number
  sla_breached_count: number
}

interface HelpdeskProps {
  apiBase: string
  currentUserId: string
  isAgent?: boolean
}

type FilterStatus = TicketStatus | 'all'
type FilterPriority = TicketPriority | 'all'

// ─── Helpers de estilo ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting: 'Aguardando',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'var(--color-slate-400)',
  medium: 'var(--color-blue-500)',
  high: 'var(--color-amber-500)',
  critical: 'var(--color-red-500)',
}

const SLA_COLORS: Record<SlaStatus, string> = {
  ok: 'var(--color-green-500)',
  warning: 'var(--color-amber-500)',
  breached: 'var(--color-red-500)',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function Helpdesk({ apiBase, currentUserId, isAgent = false }: HelpdeskProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [queues, setQueues] = useState<Queue[]>([])
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterPriority !== 'all') params.set('priority', filterPriority)
      if (filterAssignee) params.set('assigned_to', filterAssignee)

      const [ticketsRes, statsRes, queuesRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/helpdesk/tickets?${params}`),
        fetch(`${apiBase}/api/v1/helpdesk/stats`),
        fetch(`${apiBase}/api/v1/helpdesk/queues`),
      ])

      if (!ticketsRes.ok) throw new Error('Erro ao carregar tickets')
      const ticketsData = await ticketsRes.json() as { data: Ticket[] }

      if (!statsRes.ok) throw new Error('Erro ao carregar estatísticas')
      const statsData = await statsRes.json() as Stats

      if (!queuesRes.ok) throw new Error('Erro ao carregar filas')
      const queuesData = await queuesRes.json() as Queue[]

      setTickets(ticketsData.data)
      setStats(statsData)
      setQueues(queuesData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }, [apiBase, filterStatus, filterPriority, filterAssignee])

  useEffect(() => { void loadData() }, [loadData])

  const openTicket = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/helpdesk/tickets/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar ticket')
      const data = await res.json() as TicketDetail
      setSelectedTicket(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    }
  }, [apiBase])

  const updateTicketStatus = useCallback(async (id: string, status: TicketStatus) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/helpdesk/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar ticket')
      await loadData()
      if (selectedTicket?.id === id) await openTicket(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    }
  }, [apiBase, loadData, openTicket, selectedTicket])

  const assignTicket = useCallback(async (id: string, assigned_to: string | null) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/helpdesk/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to }),
      })
      if (!res.ok) throw new Error('Erro ao atribuir ticket')
      await loadData()
      if (selectedTicket?.id === id) await openTicket(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    }
  }, [apiBase, loadData, openTicket, selectedTicket])

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-slate-400)' }}>
        Carregando helpdesk...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-red-400)' }}>
        {error}
        <button onClick={() => void loadData()} style={{ marginLeft: '1rem' }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: '1rem', padding: '1rem' }}>
      {/* Painel esquerdo: lista + filtros */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        {stats && <StatsBar stats={stats} />}

        <FilterBar
          filterStatus={filterStatus}
          filterPriority={filterPriority}
          filterAssignee={filterAssignee}
          onStatusChange={setFilterStatus}
          onPriorityChange={setFilterPriority}
          onAssigneeChange={setFilterAssignee}
        />

        <TicketList
          tickets={tickets}
          selectedId={selectedTicket?.id}
          onSelect={(id) => void openTicket(id)}
        />
      </div>

      {/* Painel direito: detalhe do ticket */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          queues={queues}
          currentUserId={currentUserId}
          isAgent={isAgent}
          apiBase={apiBase}
          onStatusChange={(status) => void updateTicketStatus(selectedTicket.id, status)}
          onAssign={(assignee) => void assignTicket(selectedTicket.id, assignee)}
          onMessageSent={() => void openTicket(selectedTicket.id)}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  )
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <StatCard label="Abertos" value={stats.open_tickets} />
      <StatCard label="Fechados" value={stats.closed_tickets} />
      <StatCard label="Tempo médio (h)" value={stats.avg_resolution_hours} />
      <StatCard
        label="SLA cumprido"
        value={`${stats.sla_compliance_percent}%`}
        color={stats.sla_compliance_percent >= 90 ? 'var(--color-green-500)' : 'var(--color-amber-500)'}
      />
      <StatCard
        label="SLA vencidos"
        value={stats.sla_breached_count}
        color={stats.sla_breached_count > 0 ? 'var(--color-red-500)' : undefined}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: '0.75rem 1rem',
        background: 'var(--color-slate-800)',
        borderRadius: '8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? 'var(--color-slate-100)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  filterStatus: FilterStatus
  filterPriority: FilterPriority
  filterAssignee: string
  onStatusChange: (v: FilterStatus) => void
  onPriorityChange: (v: FilterPriority) => void
  onAssigneeChange: (v: string) => void
}

function FilterBar({
  filterStatus,
  filterPriority,
  filterAssignee,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
}: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <select
        value={filterStatus}
        onChange={(e) => onStatusChange(e.target.value as FilterStatus)}
        style={selectStyle}
      >
        <option value="all">Todos os status</option>
        {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      <select
        value={filterPriority}
        onChange={(e) => onPriorityChange(e.target.value as FilterPriority)}
        style={selectStyle}
      >
        <option value="all">Todas as prioridades</option>
        {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
          <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Filtrar por responsável..."
        value={filterAssignee}
        onChange={(e) => onAssigneeChange(e.target.value)}
        style={{ ...selectStyle, minWidth: '180px' }}
      />
    </div>
  )
}

// ─── TicketList ───────────────────────────────────────────────────────────────

function TicketList({
  tickets,
  selectedId,
  onSelect,
}: {
  tickets: Ticket[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  if (tickets.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-slate-400)' }}>
        Nenhum ticket encontrado.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
      {tickets.map((t) => (
        <TicketRow
          key={t.id}
          ticket={t}
          selected={t.id === selectedId}
          onClick={() => onSelect(t.id)}
        />
      ))}
    </div>
  )
}

function TicketRow({
  ticket,
  selected,
  onClick,
}: {
  ticket: Ticket
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        padding: '0.75rem 1rem',
        background: selected ? 'var(--color-slate-700)' : 'var(--color-slate-800)',
        borderRadius: '8px',
        cursor: 'pointer',
        border: selected ? '1px solid var(--color-slate-500)' : '1px solid transparent',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}
    >
      {/* Indicador SLA */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: SLA_COLORS[ticket.sla_status],
          marginTop: '6px',
          flexShrink: 0,
        }}
        title={`SLA: ${ticket.sla_status}`}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span
            style={{
              fontWeight: 600,
              color: 'var(--color-slate-100)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ticket.title}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: PRIORITY_COLORS[ticket.priority],
              flexShrink: 0,
            }}
          >
            {PRIORITY_LABELS[ticket.priority]}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
          <Badge label={STATUS_LABELS[ticket.status]} />
          {ticket.assigned_to && <Badge label={`Responsável: ${ticket.assigned_to}`} muted />}
          {ticket._count && <Badge label={`${ticket._count.messages} msg`} muted />}
        </div>
      </div>
    </div>
  )
}

// ─── TicketDetailPanel ────────────────────────────────────────────────────────

interface TicketDetailPanelProps {
  ticket: TicketDetail
  queues: Queue[]
  currentUserId: string
  isAgent: boolean
  apiBase: string
  onStatusChange: (s: TicketStatus) => void
  onAssign: (userId: string | null) => void
  onMessageSent: () => void
  onClose: () => void
}

function TicketDetailPanel({
  ticket,
  queues,
  currentUserId,
  isAgent,
  apiBase,
  onStatusChange,
  onAssign,
  onMessageSent,
  onClose,
}: TicketDetailPanelProps) {
  const [newMessage, setNewMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)

  const allAgents = queues.flatMap((q) => q.agents)
  const uniqueAgents = [...new Set(allAgents)]

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    setSending(true)
    try {
      const res = await fetch(`${apiBase}/api/v1/helpdesk/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage, is_internal: isInternal }),
      })
      if (!res.ok) throw new Error('Erro ao enviar mensagem')
      setNewMessage('')
      setIsInternal(false)
      onMessageSent()
    } catch (e) {
      console.error('[HELPDESK] send message error', e instanceof Error ? e.message : 'unknown')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{
        width: '480px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-slate-800)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-slate-700)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ margin: 0, color: 'var(--color-slate-100)', fontSize: '1rem' }}>
            {ticket.title}
          </h3>
          <button onClick={onClose} style={iconButtonStyle}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <SlaIndicator status={ticket.sla_status} deadline={ticket.sla_deadline} />
          <Badge label={STATUS_LABELS[ticket.status]} />
          <span style={{ fontSize: '0.75rem', color: PRIORITY_COLORS[ticket.priority] }}>
            {PRIORITY_LABELS[ticket.priority]}
          </span>
        </div>

        {/* Controles de agente */}
        {isAgent && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={ticket.status}
              onChange={(e) => onStatusChange(e.target.value as TicketStatus)}
              style={selectStyle}
            >
              {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>

            <select
              value={ticket.assigned_to ?? ''}
              onChange={(e) => onAssign(e.target.value || null)}
              style={selectStyle}
            >
              <option value="">Sem responsável</option>
              {uniqueAgents.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Descrição inicial */}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--color-slate-900)',
          fontSize: '0.875rem',
          color: 'var(--color-slate-300)',
          borderBottom: '1px solid var(--color-slate-700)',
        }}
      >
        {ticket.description}
      </div>

      {/* Conversa */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {ticket.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isSelf={msg.user_id === currentUserId}
            isAgent={isAgent}
          />
        ))}
      </div>

      {/* Caixa de resposta */}
      {ticket.status !== 'closed' && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-slate-700)' }}>
          {isAgent && (
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--color-slate-400)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
              />
              Nota interna (visível apenas para agentes)
            </label>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isInternal ? 'Nota interna...' : 'Sua mensagem...'}
              rows={3}
              style={{
                flex: 1,
                resize: 'vertical',
                background: isInternal ? 'var(--color-amber-950, #1c1407)' : 'var(--color-slate-700)',
                border: `1px solid ${isInternal ? 'var(--color-amber-700)' : 'var(--color-slate-600)'}`,
                borderRadius: '6px',
                color: 'var(--color-slate-100)',
                padding: '0.5rem',
                fontSize: '0.875rem',
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !newMessage.trim()}
              style={{
                padding: '0 1rem',
                background: 'var(--color-blue-600)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                opacity: sending || !newMessage.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isSelf,
  isAgent,
}: {
  message: HelpdeskMessage
  isSelf: boolean
  isAgent: boolean
}) {
  // Notas internas só são exibidas para agentes
  if (message.is_internal && !isAgent) return null

  return (
    <div style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '80%',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          background: message.is_internal
            ? 'var(--color-amber-900, #3d2b00)'
            : isSelf
              ? 'var(--color-blue-700)'
              : 'var(--color-slate-700)',
          color: 'var(--color-slate-100)',
          fontSize: '0.875rem',
          border: message.is_internal ? '1px dashed var(--color-amber-600)' : 'none',
        }}
      >
        {message.is_internal && (
          <div style={{ fontSize: '0.7rem', color: 'var(--color-amber-400)', marginBottom: '0.25rem' }}>
            Nota interna
          </div>
        )}
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', marginTop: '0.25rem', textAlign: 'right' }}>
          {new Date(message.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </div>
  )
}

// ─── SlaIndicator ─────────────────────────────────────────────────────────────

function SlaIndicator({ status, deadline }: { status: SlaStatus; deadline: string | null }) {
  const label = status === 'ok' ? 'SLA OK' : status === 'warning' ? 'SLA < 2h' : 'SLA VENCIDO'
  const deadlineFormatted = deadline
    ? new Date(deadline).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <span
      title={deadlineFormatted ? `Prazo: ${deadlineFormatted}` : 'Sem prazo definido'}
      style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: '4px',
        background: SLA_COLORS[status],
        color: '#fff',
      }}
    >
      {label}
    </span>
  )
}

// ─── Utilitários de UI ────────────────────────────────────────────────────────

function Badge({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      style={{
        fontSize: '0.7rem',
        padding: '2px 6px',
        borderRadius: '4px',
        background: muted ? 'var(--color-slate-700)' : 'var(--color-slate-600)',
        color: muted ? 'var(--color-slate-400)' : 'var(--color-slate-200)',
      }}
    >
      {label}
    </span>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  background: 'var(--color-slate-700)',
  border: '1px solid var(--color-slate-600)',
  borderRadius: '6px',
  color: 'var(--color-slate-200)',
  fontSize: '0.8rem',
  cursor: 'pointer',
}

const iconButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-slate-400)',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0.25rem',
  lineHeight: 1,
}

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { emit } from '@nucleo/shell'

// ─── Types ──────────────────────────────────────────────────────────────────

type EventType = 'meeting' | 'task' | 'reminder' | 'deadline' | 'custom'
type ViewMode = 'month' | 'week' | 'day' | 'list'
type AttendeeStatus = 'pending' | 'accepted' | 'declined'

interface Attendee {
  email: string
  name: string
  status: AttendeeStatus
}

interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  until?: string
}

interface CalendarEvent {
  id: string
  user_id: string
  product_id?: string
  title: string
  description?: string
  starts_at: string
  ends_at: string
  all_day: boolean
  type: EventType
  linked_activity_id?: string
  recurrence?: Recurrence
  attendees: Attendee[]
  location?: string
  color?: string
  created_at: string
  updated_at: string
}

interface ModalState {
  open: boolean
  event?: Partial<CalendarEvent>
  defaultDate?: string
}

interface AgendamentoProps {
  userId: string
  tenantId: string
  products?: Array<{ id: string; name: string }>
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<EventType, string> = {
  meeting: '#7c3aed',   // roxo
  task: '#16a34a',      // verde
  reminder: '#d97706',  // âmbar
  deadline: '#dc2626',  // vermelho
  custom: '#0891b2',    // ciano
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: 'Reunião',
  task: 'Tarefa',
  reminder: 'Lembrete',
  deadline: 'Prazo',
  custom: 'Personalizado',
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const BASE_URL = process.env.TENANT_SERVICES_URL ?? ''

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0)
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function eventColor(event: CalendarEvent): string {
  return event.color ?? EVENT_COLORS[event.type]
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── API ────────────────────────────────────────────────────────────────────

async function fetchEvents(params: {
  tenantId: string
  userId: string
  productId?: string
  from: string
  to: string
}): Promise<CalendarEvent[]> {
  const qs = new URLSearchParams({
    user_id: params.userId,
    from: `${params.from}T00:00:00.000Z`,
    to: `${params.to}T23:59:59.999Z`,
    limit: '500',
    ...(params.productId ? { product_id: params.productId } : {}),
  })

  const res = await fetch(`${BASE_URL}/api/v1/calendar/events?${qs.toString()}`, {
    headers: {
      'x-tenant-id': params.tenantId,
    },
  })

  if (!res.ok) throw new Error(`Falha ao buscar eventos: ${res.status}`)
  const json = await res.json() as { data: CalendarEvent[] }
  return json.data
}

async function saveEvent(
  payload: Partial<CalendarEvent> & { starts_at: string; ends_at: string; title: string; type: EventType; user_id: string },
  tenantId: string,
  id?: string
): Promise<CalendarEvent> {
  const url = id
    ? `${BASE_URL}/api/v1/calendar/events/${id}`
    : `${BASE_URL}/api/v1/calendar/events`

  const res = await fetch(url, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`Falha ao salvar evento: ${res.status}`)
  return res.json() as Promise<CalendarEvent>
}

async function deleteEvent(id: string, tenantId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/calendar/events/${id}`, {
    method: 'DELETE',
    headers: { 'x-tenant-id': tenantId },
  })
  if (!res.ok && res.status !== 204) throw new Error(`Falha ao deletar evento: ${res.status}`)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EventBadge({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{ backgroundColor: eventColor(event) }}
      className="event-badge"
      title={event.title}
    >
      {!event.all_day && <span className="event-time">{formatTime(event.starts_at)}</span>}
      <span className="event-title">{event.title}</span>
      {event.linked_activity_id && <span className="event-link-icon">↗</span>}
    </button>
  )
}

function MonthGrid({
  year,
  month,
  events,
  onDayClick,
  onEventClick,
}: {
  year: number
  month: number
  events: CalendarEvent[]
  onDayClick: (date: string) => void
  onEventClick: (event: CalendarEvent) => void
}) {
  const first = startOfMonth(year, month)
  const last = endOfMonth(year, month)
  const startDay = first.getDay()
  const cells: Array<Date | null> = []

  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))

  return (
    <div className="month-grid">
      {WEEK_DAYS.map((d) => <div key={d} className="month-header-cell">{d}</div>)}
      {cells.map((date, i) => {
        if (!date) return <div key={`empty-${i}`} className="month-cell empty" />
        const dateStr = isoDate(date)
        const dayEvents = events.filter((e) => e.starts_at.startsWith(dateStr))
        const isToday = dateStr === isoDate(new Date())
        return (
          <div
            key={dateStr}
            className={`month-cell${isToday ? ' today' : ''}`}
            onClick={() => onDayClick(dateStr)}
          >
            <span className="month-day-number">{date.getDate()}</span>
            <div className="month-events">
              {dayEvents.slice(0, 3).map((ev) => (
                <EventBadge key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
              ))}
              {dayEvents.length > 3 && (
                <span className="more-events">+{dayEvents.length - 3} mais</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekGrid({
  weekStart,
  events,
  onSlotClick,
  onEventClick,
  onEventDrop,
}: {
  weekStart: Date
  events: CalendarEvent[]
  onSlotClick: (date: string, hour: number) => void
  onEventClick: (event: CalendarEvent) => void
  onEventDrop: (eventId: string, newStartsAt: string) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const draggingRef = useRef<string | null>(null)

  function handleDragStart(eventId: string) {
    draggingRef.current = eventId
  }

  function handleDrop(dateStr: string, hour: number) {
    if (!draggingRef.current) return
    const newStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00.000Z`)
    onEventDrop(draggingRef.current, newStart.toISOString())
    draggingRef.current = null
  }

  return (
    <div className="week-grid">
      <div className="week-header">
        <div className="hour-gutter" />
        {days.map((d) => (
          <div key={isoDate(d)} className={`week-day-header${isoDate(d) === isoDate(new Date()) ? ' today' : ''}`}>
            <span>{WEEK_DAYS[d.getDay()]}</span>
            <strong>{d.getDate()}</strong>
          </div>
        ))}
      </div>
      <div className="week-body">
        {hours.map((hour) => (
          <div key={hour} className="week-row">
            <div className="hour-gutter">{`${String(hour).padStart(2, '0')}:00`}</div>
            {days.map((d) => {
              const dateStr = isoDate(d)
              const slotEvents = events.filter((e) => {
                const s = new Date(e.starts_at)
                return isoDate(s) === dateStr && s.getHours() === hour
              })
              return (
                <div
                  key={dateStr}
                  className="week-slot"
                  onClick={() => onSlotClick(dateStr, hour)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(dateStr, hour)}
                >
                  {slotEvents.map((ev) => (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={() => handleDragStart(ev.id)}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                    >
                      <EventBadge event={ev} onClick={() => onEventClick(ev)} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayGrid({
  date,
  events,
  onSlotClick,
  onEventClick,
  onEventDrop,
}: {
  date: Date
  events: CalendarEvent[]
  onSlotClick: (hour: number) => void
  onEventClick: (event: CalendarEvent) => void
  onEventDrop: (eventId: string, newStartsAt: string) => void
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const draggingRef = useRef<string | null>(null)
  const dateStr = isoDate(date)

  function handleDrop(hour: number) {
    if (!draggingRef.current) return
    const newStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00.000Z`)
    onEventDrop(draggingRef.current, newStart.toISOString())
    draggingRef.current = null
  }

  return (
    <div className="day-grid">
      {hours.map((hour) => {
        const slotEvents = events.filter((e) => {
          const s = new Date(e.starts_at)
          return isoDate(s) === dateStr && s.getHours() === hour
        })
        return (
          <div
            key={hour}
            className="day-slot"
            onClick={() => onSlotClick(hour)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(hour)}
          >
            <span className="hour-label">{`${String(hour).padStart(2, '0')}:00`}</span>
            {slotEvents.map((ev) => (
              <div
                key={ev.id}
                draggable
                onDragStart={() => { draggingRef.current = ev.id }}
                onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
              >
                <EventBadge event={ev} onClick={() => onEventClick(ev)} />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ListView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}) {
  if (events.length === 0) {
    return <div className="list-empty">Nenhum evento encontrado.</div>
  }

  return (
    <div className="list-view">
      {events.map((ev) => (
        <button key={ev.id} className="list-event-item" onClick={() => onEventClick(ev)}>
          <span className="list-color-dot" style={{ backgroundColor: eventColor(ev) }} />
          <div className="list-event-info">
            <strong>{ev.title}</strong>
            <span className="list-event-meta">
              {EVENT_TYPE_LABELS[ev.type]} ·{' '}
              {ev.all_day ? 'Dia inteiro' : `${formatTime(ev.starts_at)} – ${formatTime(ev.ends_at)}`}
              {ev.location ? ` · ${ev.location}` : ''}
            </span>
          </div>
          {ev.linked_activity_id && (
            <span className="list-activity-link" title="Ver atividade vinculada">↗</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Creation / Edit Modal ───────────────────────────────────────────────────

interface EventModalProps {
  modal: ModalState
  userId: string
  tenantId: string
  products: Array<{ id: string; name: string }>
  onClose: () => void
  onSaved: (event: CalendarEvent, isNew: boolean) => void
  onDeleted: (id: string) => void
}

function EventModal({ modal, userId, tenantId, products, onClose, onSaved, onDeleted }: EventModalProps) {
  const ev = modal.event ?? {}
  const isEditing = !!ev.id

  const [title, setTitle] = useState(ev.title ?? '')
  const [description, setDescription] = useState(ev.description ?? '')
  const [type, setType] = useState<EventType>(ev.type ?? 'meeting')
  const [startsAt, setStartsAt] = useState(ev.starts_at ?? `${modal.defaultDate ?? isoDate(new Date())}T09:00`)
  const [endsAt, setEndsAt] = useState(ev.ends_at ?? `${modal.defaultDate ?? isoDate(new Date())}T10:00`)
  const [allDay, setAllDay] = useState(ev.all_day ?? false)
  const [location, setLocation] = useState(ev.location ?? '')
  const [productId, setProductId] = useState(ev.product_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!title.trim()) { setError('Título obrigatório'); return }

    const starts = allDay ? `${startsAt.slice(0, 10)}T00:00:00.000Z` : new Date(startsAt).toISOString()
    const ends = allDay ? `${endsAt.slice(0, 10)}T23:59:59.999Z` : new Date(endsAt).toISOString()

    setSaving(true)
    setError(null)

    try {
      const payload = {
        user_id: userId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        starts_at: starts,
        ends_at: ends,
        all_day: allDay,
        location: location.trim() || undefined,
        product_id: productId || undefined,
        attendees: ev.attendees ?? [],
        linked_activity_id: ev.linked_activity_id,
      }

      const saved = await saveEvent(payload, tenantId, ev.id)
      onSaved(saved, !isEditing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!ev.id) return
    setSaving(true)
    try {
      await deleteEvent(ev.id, tenantId)
      onDeleted(ev.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{isEditing ? 'Editar Evento' : 'Novo Evento'}</h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </header>

        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          <label>
            Título *
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do evento" />
          </label>

          <label>
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value as EventType)}>
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>

          <label className="checkbox-label">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Dia inteiro
          </label>

          <label>
            Início
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? startsAt.slice(0, 10) : startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>

          <label>
            Fim
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? endsAt.slice(0, 10) : endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>

          <label>
            Descrição
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descrição opcional"
            />
          </label>

          <label>
            Local
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Local ou link" />
          </label>

          {products.length > 0 && (
            <label>
              Produto
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Todos os produtos</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}

          {ev.linked_activity_id && (
            <div className="modal-activity-link">
              <span>Vinculado à atividade:</span>
              <a href={`/atividades/${ev.linked_activity_id}`} target="_blank" rel="noreferrer">
                Ver atividade ↗
              </a>
            </div>
          )}
        </div>

        <footer className="modal-footer">
          {isEditing && (
            <button className="btn-danger" onClick={handleDelete} disabled={saving}>
              Excluir
            </button>
          )}
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function Agendamento({ userId, tenantId, products = [] }: AgendamentoProps) {
  const today = new Date()
  const [view, setView] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(today)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [filterProductId, setFilterProductId] = useState<string>('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Range de datas para busca baseado na visão atual
  function getRange(): { from: string; to: string } {
    if (view === 'month') {
      return {
        from: isoDate(startOfMonth(year, month)),
        to: isoDate(endOfMonth(year, month)),
      }
    }
    if (view === 'week') {
      const ws = startOfWeek(currentDate)
      return { from: isoDate(ws), to: isoDate(addDays(ws, 6)) }
    }
    return { from: isoDate(currentDate), to: isoDate(currentDate) }
  }

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { from, to } = getRange()
    try {
      const data = await fetchEvents({ tenantId, userId, productId: filterProductId || undefined, from, to })
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar eventos')
    } finally {
      setLoading(false)
    }
  }, [tenantId, userId, view, currentDate, filterProductId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadEvents() }, [loadEvents])

  function navigate(direction: -1 | 1) {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + direction)
    else if (view === 'week') d.setDate(d.getDate() + direction * 7)
    else d.setDate(d.getDate() + direction)
    setCurrentDate(d)
  }

  function openCreate(defaultDate?: string, defaultHour?: number) {
    const base = defaultDate ?? isoDate(today)
    const hour = String(defaultHour ?? 9).padStart(2, '0')
    setModal({
      open: true,
      event: { starts_at: `${base}T${hour}:00`, ends_at: `${base}T${String((defaultHour ?? 9) + 1).padStart(2, '0')}:00` },
      defaultDate: base,
    })
  }

  function openEdit(event: CalendarEvent) {
    setModal({ open: true, event })
  }

  function handleSaved(saved: CalendarEvent, isNew: boolean) {
    setEvents((prev) =>
      isNew ? [...prev, saved] : prev.map((e) => (e.id === saved.id ? saved : e))
    )
    setModal({ open: false })
    emit(isNew ? 'calendar:event-created' : 'calendar:event-updated', { event: saved })
  }

  function handleDeleted(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setModal({ open: false })
  }

  async function handleEventDrop(eventId: string, newStartsAt: string) {
    const ev = events.find((e) => e.id === eventId)
    if (!ev) return

    const durationMs = new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime()
    const newEndsAt = new Date(new Date(newStartsAt).getTime() + durationMs).toISOString()

    try {
      const updated = await saveEvent({ ...ev, starts_at: newStartsAt, ends_at: newEndsAt }, tenantId, eventId)
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)))
      emit('calendar:event-updated', { event: updated })
    } catch {
      void loadEvents() // Reverter em caso de erro
    }
  }

  function renderTitle(): string {
    if (view === 'month') return `${MONTH_NAMES[month]} ${year}`
    if (view === 'week') {
      const ws = startOfWeek(currentDate)
      return `${ws.getDate()} – ${addDays(ws, 6).getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`
    }
    return `${currentDate.getDate()} de ${MONTH_NAMES[month]} de ${year}`
  }

  return (
    <div className="agendamento">
      {/* Header */}
      <div className="agendamento-header">
        <div className="header-nav">
          <button onClick={() => navigate(-1)}>‹</button>
          <h1>{renderTitle()}</h1>
          <button onClick={() => navigate(1)}>›</button>
          <button className="btn-today" onClick={() => setCurrentDate(new Date())}>Hoje</button>
        </div>

        <div className="header-controls">
          {products.length > 0 && (
            <select
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="filter-product"
            >
              <option value="">Todos os produtos</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          <div className="view-tabs">
            {(['month', 'week', 'day', 'list'] as ViewMode[]).map((v) => (
              <button
                key={v}
                className={`view-tab${view === v ? ' active' : ''}`}
                onClick={() => setView(v)}
              >
                {{ month: 'Mês', week: 'Semana', day: 'Dia', list: 'Lista' }[v]}
              </button>
            ))}
          </div>

          <button className="btn-primary btn-new-event" onClick={() => openCreate()}>
            + Novo evento
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && <div className="agendamento-loading">Carregando…</div>}
      {error && <div className="agendamento-error">{error}</div>}

      {!loading && !error && (
        <>
          {view === 'month' && (
            <MonthGrid
              year={year}
              month={month}
              events={events}
              onDayClick={(date) => openCreate(date)}
              onEventClick={openEdit}
            />
          )}
          {view === 'week' && (
            <WeekGrid
              weekStart={startOfWeek(currentDate)}
              events={events}
              onSlotClick={(date, hour) => openCreate(date, hour)}
              onEventClick={openEdit}
              onEventDrop={handleEventDrop}
            />
          )}
          {view === 'day' && (
            <DayGrid
              date={currentDate}
              events={events}
              onSlotClick={(hour) => openCreate(isoDate(currentDate), hour)}
              onEventClick={openEdit}
              onEventDrop={handleEventDrop}
            />
          )}
          {view === 'list' && (
            <ListView events={events} onEventClick={openEdit} />
          )}
        </>
      )}

      {/* Modal */}
      {modal.open && (
        <EventModal
          modal={modal}
          userId={userId}
          tenantId={tenantId}
          products={products}
          onClose={() => setModal({ open: false })}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}

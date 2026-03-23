import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@nucleo/api-global'
import { useConfirmar } from '@nucleo/confirmar-global'
import { emit } from '@nucleo/shell'

// ─── Types ────────────────────────────────────────────────────────────────────

type LinkedType = 'nf' | 'meeting' | 'process' | 'custom'
type TimerState = 'idle' | 'running' | 'paused'

interface TimerSession {
  id: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  is_manual: boolean
  subject: string | null
  linked_type: LinkedType | null
  linked_id: string | null
  linked_label: string | null
}

interface TimerActiveData {
  id: string
  activity_id: string
  started_at: string
  paused_at: string | null
  accumulated_seconds: number
}

interface CronometroProps {
  activityId: string
}

interface LinkFormState {
  sessionId: string
  type: LinkedType | null
  id: string
  label: string
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function minutesToLabel(min: number): string {
  if (!min || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${h}h`
}

function calcElapsed(active: TimerActiveData): number {
  if (active.paused_at) return active.accumulated_seconds
  return (
    active.accumulated_seconds +
    Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000)
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const LINKED_TYPE_LABELS: Record<LinkedType, string> = {
  nf: 'Nota Fiscal',
  meeting: 'Reunião',
  process: 'Processo',
  custom: 'Item personalizado',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DisplayProps {
  seconds: number
  state: TimerState
  onStart: () => void
  onPause: () => void
  onStop: () => void
}

function CronometroDisplay({ seconds, state, onStart, onPause, onStop }: DisplayProps) {
  return (
    <div className="cronometro-display">
      <span className="cronometro-label">⏱ CRONÔMETRO</span>
      <span className="cronometro-sublabel">TEMPO TRABALHADO</span>
      <div className="cronometro-time">{formatSeconds(seconds)}</div>
      <div className="cronometro-actions">
        {state === 'idle' && (
          <button className="btn-primary" onClick={onStart}>
            ▶ Iniciar
          </button>
        )}
        {state === 'running' && (
          <>
            <button className="btn-secondary" onClick={onPause}>
              ⏸ Pausar
            </button>
            <button className="btn-danger" onClick={onStop}>
              ⏹ Parar e Salvar
            </button>
          </>
        )}
        {state === 'paused' && (
          <>
            <button className="btn-primary" onClick={onStart}>
              ▶ Retomar
            </button>
            <button className="btn-danger" onClick={onStop}>
              ⏹ Parar e Salvar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface ManualEntryProps {
  onAdd: (minutes: number, subject: string) => void
}

function ManualEntry({ onAdd }: ManualEntryProps) {
  const [minutes, setMinutes] = useState('')
  const [subject, setSubject] = useState('')

  function handleAdd() {
    const min = parseInt(minutes, 10)
    if (!min || min <= 0 || !subject.trim()) return
    onAdd(min, subject.trim())
    setMinutes('')
    setSubject('')
  }

  return (
    <div className="manual-entry">
      <span className="manual-entry-label">✏️ OU INFORME MANUALMENTE</span>
      <span className="manual-entry-hint">
        Tempo em minutos — ex: 90 = 1h30min
        {minutes && parseInt(minutes, 10) > 0 && (
          <strong> ({minutesToLabel(parseInt(minutes, 10))})</strong>
        )}
      </span>
      <input
        type="number"
        min={1}
        placeholder="ex: 90"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        className="input-number"
      />
      <input
        type="text"
        placeholder="Assunto (obrigatório)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="input-text"
        maxLength={500}
      />
      <button
        className="btn-secondary"
        onClick={handleAdd}
        disabled={!minutes || parseInt(minutes, 10) <= 0 || !subject.trim()}
      >
        + Adicionar sessão manual
      </button>
    </div>
  )
}

interface SubjectCellProps {
  session: TimerSession
  onSave: (id: string, subject: string) => void
}

function SubjectCell({ session, onSave }: SubjectCellProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(session.subject ?? '')

  function handleBlur() {
    setEditing(false)
    if (value !== session.subject) onSave(session.id, value)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={value}
        maxLength={500}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleBlur()
          if (e.key === 'Escape') {
            setValue(session.subject ?? '')
            setEditing(false)
          }
        }}
        className="input-inline"
      />
    )
  }

  return (
    <span
      className={`subject-cell ${!session.subject ? 'placeholder' : ''}`}
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {session.linked_label
        ? `[${LINKED_TYPE_LABELS[session.linked_type as LinkedType]}] ${session.linked_label}`
        : session.subject ?? 'Adicionar assunto...'}
    </span>
  )
}

interface LinkDropdownProps {
  session: TimerSession
  onSave: (id: string, type: LinkedType | null, linkedId: string, label: string) => void
}

function LinkDropdown({ session, onSave }: LinkDropdownProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LinkFormState>({
    sessionId: session.id,
    type: session.linked_type,
    id: session.linked_id ?? '',
    label: session.linked_label ?? '',
  })

  function handleSave() {
    if (!form.type) return
    onSave(session.id, form.type, form.id, form.label)
    setOpen(false)
  }

  return (
    <div className="link-dropdown">
      <button className="btn-icon" onClick={() => setOpen((o) => !o)} title="Vincular sessão">
        🔗
      </button>
      {open && (
        <div className="link-dropdown-panel">
          <select
            value={form.type ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, type: (e.target.value as LinkedType) || null }))
            }
          >
            <option value="">Selecione o tipo</option>
            {(Object.keys(LINKED_TYPE_LABELS) as LinkedType[]).map((t) => (
              <option key={t} value={t}>
                {LINKED_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {form.type && (
            <>
              <input
                type="text"
                placeholder="ID (opcional)"
                value={form.id}
                maxLength={200}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Label de exibição"
                value={form.label}
                maxLength={300}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
              <button className="btn-primary" onClick={handleSave} disabled={!form.label.trim()}>
                Salvar vínculo
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Cronometro({ activityId }: CronometroProps) {
  const { confirmar } = useConfirmar()

  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [activeTimer, setActiveTimer] = useState<TimerActiveData | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessions, setSessions] = useState<TimerSession[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load initial state
  useEffect(() => {
    void loadSessions()
    void loadActiveTimer()
  }, [activityId])

  // Tick every second when running
  useEffect(() => {
    if (timerState === 'running' && activeTimer) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(calcElapsed(activeTimer))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timerState, activeTimer])

  async function loadSessions() {
    const res = await apiClient.get<{ sessions: TimerSession[]; total_minutes: number }>(
      `/api/v1/timers/${activityId}`
    )
    setSessions(res.data.sessions)
  }

  async function loadActiveTimer() {
    const res = await apiClient.get<{ timer: TimerActiveData | null; elapsed_seconds: number }>(
      `/api/v1/timers/active`
    )
    const { timer, elapsed_seconds } = res.data

    if (timer && timer.activity_id === activityId) {
      setActiveTimer(timer)
      setElapsedSeconds(elapsed_seconds)
      setTimerState(timer.paused_at ? 'paused' : 'running')
    } else {
      setActiveTimer(null)
      setElapsedSeconds(0)
      setTimerState('idle')
    }
  }

  const handleStart = useCallback(async () => {
    const res = await apiClient.post<{ timer: TimerActiveData; resumed: boolean }>(
      `/api/v1/timers/${activityId}/start`
    )
    const { timer } = res.data
    setActiveTimer(timer)
    setElapsedSeconds(calcElapsed(timer))
    setTimerState('running')
    emit('timer:started', { activity_id: activityId })
  }, [activityId])

  const handlePause = useCallback(async () => {
    if (!activeTimer) return
    const res = await apiClient.post<{ timer: TimerActiveData; elapsed_seconds: number }>(
      `/api/v1/timers/${activityId}/pause`
    )
    setActiveTimer(res.data.timer)
    setElapsedSeconds(res.data.elapsed_seconds)
    setTimerState('paused')
    emit('timer:paused', { activity_id: activityId, duration: res.data.elapsed_seconds })
  }, [activityId, activeTimer])

  const handleStop = useCallback(async () => {
    if (!activeTimer) return
    const res = await apiClient.post<{ session: TimerSession | null; discarded: boolean }>(
      `/api/v1/timers/${activityId}/stop`
    )
    setActiveTimer(null)
    setElapsedSeconds(0)
    setTimerState('idle')

    if (res.data.session) {
      setSessions((prev) => [res.data.session!, ...prev])
      emit('timer:stopped', { activity_id: activityId, duration: res.data.session.duration_minutes })
    }
  }, [activityId, activeTimer])

  const handleManualAdd = useCallback(
    async (minutes: number, subject: string) => {
      const res = await apiClient.post<TimerSession>(`/api/v1/timers/${activityId}/manual`, {
        minutes,
        subject,
      })
      setSessions((prev) => [res.data, ...prev])
      emit('timer:stopped', { activity_id: activityId, duration: minutes })
    },
    [activityId]
  )

  const handleSubjectSave = useCallback(async (id: string, subject: string) => {
    await apiClient.patch(`/api/v1/timers/sessions/${id}`, { subject })
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, subject } : s))
    )
  }, [])

  const handleLinkSave = useCallback(
    async (id: string, type: LinkedType | null, linkedId: string, label: string) => {
      await apiClient.patch(`/api/v1/timers/sessions/${id}`, {
        linked_type: type,
        linked_id: linkedId,
        linked_label: label,
      })
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, linked_type: type, linked_id: linkedId, linked_label: label }
            : s
        )
      )
    },
    []
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await confirmar({
        titulo: 'Excluir sessão',
        mensagem: 'Tem certeza que deseja excluir esta sessão de tempo? Esta ação não pode ser desfeita.',
        confirmarLabel: 'Excluir',
        cancelarLabel: 'Cancelar',
      })
      if (!confirmed) return

      await apiClient.delete(`/api/v1/timers/sessions/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    },
    [confirmar]
  )

  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0)

  // Add running timer to total display
  const totalDisplay = timerState === 'running'
    ? totalMinutes + Math.floor(elapsedSeconds / 60)
    : totalMinutes

  return (
    <div className="cronometro">
      <CronometroDisplay
        seconds={elapsedSeconds}
        state={timerState}
        onStart={handleStart}
        onPause={handlePause}
        onStop={handleStop}
      />

      <div className="cronometro-total">
        Total acumulado:{' '}
        <strong>{formatDuration(totalDisplay)}</strong>
      </div>

      <ManualEntry onAdd={handleManualAdd} />

      <div className="sessoes-section">
        <span className="sessoes-label">SESSÕES REGISTRADAS</span>
        {sessions.length === 0 ? (
          <p className="sessoes-empty">Nenhuma sessão registrada ainda.</p>
        ) : (
          <table className="sessoes-table">
            <thead>
              <tr>
                <th>DATA</th>
                <th>HORA</th>
                <th>DURAÇÃO</th>
                <th>ASSUNTO</th>
                <th>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.started_at)}</td>
                  <td>{formatTime(s.started_at)}</td>
                  <td>
                    <span className="duration-badge">
                      ⏱ {s.duration_minutes != null ? formatDuration(s.duration_minutes) : '—'}
                    </span>
                    {s.is_manual && <span className="badge-manual">manual</span>}
                  </td>
                  <td>
                    <div className="subject-cell-wrapper">
                      <SubjectCell session={s} onSave={handleSubjectSave} />
                      <LinkDropdown session={s} onSave={handleLinkSave} />
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => handleDelete(s.id)}
                      title="Excluir sessão"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

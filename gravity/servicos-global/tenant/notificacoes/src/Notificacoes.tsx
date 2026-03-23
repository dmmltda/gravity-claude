import React, { useCallback, useEffect, useRef, useState } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  type: string
  title: string | null
  message: string
  read: boolean
  activity_id: string | null
  created_at: string
}

interface NotificacoesProps {
  userId: string
  tenantId: string
  onNavigate?: (activityId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgeLabel(count: number): string | null {
  if (count === 0) return null
  return count > 9 ? '9+' : String(count)
}

function iconClass(type: string): string {
  if (type === 'mentioned') return 'ph-at'
  if (type === 'next-step') return 'ph-arrow-right'
  return 'ph-bell'
}

function iconColor(type: string): string {
  if (type === 'mentioned') return '#818cf8'
  if (type === 'next-step') return '#10b981'
  return '#f59e0b'
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function Notificacoes({ userId, tenantId, onNavigate }: NotificacoesProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // ── Fetch da lista ──────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notificacoes', {
        headers: { 'x-tenant-id': tenantId },
      })
      if (!res.ok) return
      const data = await res.json() as { notifications: Notification[]; unread_count: number }
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      // falha silenciosa — não quebra o UI
    }
  }, [tenantId])

  // ── Polling de fallback (30s) ───────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    pollingRef.current = setInterval(() => {
      void fetchNotifications()
    }, 30_000)
  }, [fetchNotifications])

  // ── SSE como canal principal ────────────────────────────────────────────────

  useEffect(() => {
    void fetchNotifications()

    const es = new EventSource(`/api/v1/notificacoes/stream?userId=${userId}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; notification: Notification; unread_count: number }
      if (data.type === 'new_notification') {
        setNotifications((prev) => [data.notification, ...prev].slice(0, 50))
        setUnreadCount(data.unread_count)
      }
    }

    // SSE caiu — ativa polling como fallback
    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      startPolling()
    }

    // Polling de segurança — sempre ativo em paralelo
    startPolling()

    return () => {
      es.close()
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [userId, fetchNotifications, startPolling])

  // ── Fecha dropdown ao clicar fora ──────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // ── Ações ──────────────────────────────────────────────────────────────────

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))

    await fetch(`/api/v1/notificacoes/${id}/read`, { method: 'PUT' }).catch(() => null)
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)

    await fetch('/api/v1/notificacoes/read-all', { method: 'PUT' }).catch(() => null)
  }

  // Dispensa otimisticamente — remove antes de esperar a API
  async function dismiss(id: string) {
    const dismissed = notifications.find((n) => n.id === id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (dismissed && !dismissed.read) {
      setUnreadCount((c) => Math.max(0, c - 1))
    }

    await fetch(`/api/v1/notificacoes/${id}`, { method: 'DELETE' }).catch(() => null)
  }

  function handleItemClick(notification: Notification) {
    void markRead(notification.id)
    if (notification.activity_id && onNavigate) {
      onNavigate(notification.activity_id)
    }
    setOpen(false)
  }

  const badge = badgeLabel(unreadCount)

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Botão sino */}
      <button
        aria-label={`Notificações${badge ? ` — ${badge} não lidas` : ''}`}
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '8px',
          color: 'var(--color-text-primary, #f1f5f9)',
          fontSize: '20px',
        }}
      >
        <i className="ph-bell" />
        {badge && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: '#ef4444',
              color: '#fff',
              borderRadius: '9999px',
              fontSize: '10px',
              fontWeight: 700,
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}
          >
            {badge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '360px',
            maxHeight: '480px',
            overflowY: 'auto',
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
        >
          {/* Cabeçalho */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border, #334155)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Notificações</span>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--color-accent, #6366f1)',
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--color-text-muted, #94a3b8)',
                fontSize: '14px',
              }}
            >
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border, #334155)',
                  background: n.read ? 'transparent' : 'rgba(99,102,241,0.06)',
                  cursor: 'pointer',
                }}
                onClick={() => handleItemClick(n)}
              >
                {/* Ícone */}
                <div
                  style={{
                    flexShrink: 0,
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: `${iconColor(n.type)}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    color: iconColor(n.type),
                  }}
                >
                  <i className={iconClass(n.type)} />
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {n.title && (
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: n.read ? 400 : 600,
                        color: 'var(--color-text-primary, #f1f5f9)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.title}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-muted, #94a3b8)',
                      marginTop: '2px',
                    }}
                  >
                    {n.message}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)', marginTop: '4px' }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>

                {/* Botão dispensar */}
                <button
                  aria-label="Dispensar notificação"
                  onClick={(e) => {
                    e.stopPropagation()
                    void dismiss(n.id)
                  }}
                  style={{
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted, #94a3b8)',
                    fontSize: '16px',
                    padding: '2px',
                    lineHeight: 1,
                  }}
                >
                  ✓
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

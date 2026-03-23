import React, { useEffect } from 'react'
import { useShellStore } from '../state/store.js'
import type { Notification } from '../state/types.js'

interface ToastProps {
  notification: Notification
}

const baseStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSize: '0.875rem',
  lineHeight: '1.4',
  minWidth: '280px',
  maxWidth: '400px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
  wordBreak: 'break-word',
}

const typeStyles: Record<Notification['type'], React.CSSProperties> = {
  success: {
    background: 'rgba(34,197,94,0.15)',
    color: 'var(--success)',
  },
  error: {
    background: 'rgba(239,68,68,0.15)',
    color: 'var(--danger)',
  },
  warning: {
    background: 'rgba(245,158,11,0.15)',
    color: 'var(--warning)',
  },
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  opacity: 0.7,
  padding: 0,
  marginLeft: 'auto',
  fontSize: '1rem',
  lineHeight: 1,
  flexShrink: 0,
}

export function Toast({ notification }: ToastProps) {
  const removeNotification = useShellStore((s) => s.removeNotification)

  useEffect(() => {
    const timer = setTimeout(() => {
      removeNotification(notification.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [notification.id, removeNotification])

  return (
    <div
      role="alert"
      style={{ ...baseStyle, ...typeStyles[notification.type] }}
    >
      <span style={{ flex: 1 }}>{notification.message}</span>
      <button
        style={closeBtnStyle}
        onClick={() => removeNotification(notification.id)}
        aria-label="Fechar notificação"
      >
        &#x2715;
      </button>
    </div>
  )
}

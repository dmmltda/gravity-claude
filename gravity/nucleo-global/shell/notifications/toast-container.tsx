import React from 'react'
import { useShellStore } from '../state/store.js'
import { Toast } from './toast.js'

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '1.5rem',
  right: '1.5rem',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  pointerEvents: 'none',
}

const itemStyle: React.CSSProperties = {
  pointerEvents: 'auto',
}

export function ToastContainer() {
  const notifications = useShellStore((s) => s.notifications)

  if (notifications.length === 0) return null

  return (
    <div style={containerStyle} aria-live="polite" aria-atomic="false">
      {notifications.map((n) => (
        <div key={n.id} style={itemStyle}>
          <Toast notification={n} />
        </div>
      ))}
    </div>
  )
}

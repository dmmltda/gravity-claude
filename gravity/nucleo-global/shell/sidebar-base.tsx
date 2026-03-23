import React from 'react'
import { useShellStore } from './state/store.js'

interface SidebarBaseProps {
  children?: React.ReactNode
}

const styles = {
  sidebar: {
    background: 'var(--bg-base)',
    borderRight: '1px solid var(--bg-elevated)',
    minHeight: '100vh',
    transition: 'width 0.2s ease',
    flexShrink: 0 as const,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: '0.5rem',
    marginRight: '0.5rem',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden',
  },
}

export function SidebarBase({ children }: SidebarBaseProps) {
  const { sidebarOpen, toggleSidebar } = useShellStore()

  const sidebarStyle = {
    ...styles.sidebar,
    width: sidebarOpen ? '240px' : '56px',
  }

  return (
    <aside style={sidebarStyle} aria-expanded={sidebarOpen}>
      <button
        style={styles.toggleBtn}
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
        title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
      >
        {sidebarOpen ? (
          <span style={{ fontSize: '1.125rem' }}>&#x2190;</span>
        ) : (
          <span style={{ fontSize: '1.125rem' }}>&#x2192;</span>
        )}
      </button>
      <div style={styles.content}>{children}</div>
    </aside>
  )
}

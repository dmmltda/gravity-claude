import React from 'react'

interface HeaderBaseProps {
  children?: React.ReactNode
}

const headerStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  borderBottom: '1px solid var(--bg-elevated)',
  height: '56px',
  display: 'flex',
  alignItems: 'center',
  padding: '0 1.5rem',
  flexShrink: 0,
  gap: '1rem',
}

export function HeaderBase({ children }: HeaderBaseProps) {
  return (
    <header style={headerStyle}>
      {children}
    </header>
  )
}

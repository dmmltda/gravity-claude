import React from 'react'
import type { ColumnType } from './types.js'

interface CelulaProps {
  value: unknown
  type?: ColumnType
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.2rem 0.6rem',
  borderRadius: 'var(--radius-pill)',
  fontSize: '0.75rem',
  fontWeight: 600,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
}

const mutedStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
}

export function Celula({ value, type }: CelulaProps): React.ReactElement {
  if (value === null || value === undefined) {
    return <span style={mutedStyle}>—</span>
  }

  switch (type) {
    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value))
      const isValid = !isNaN(date.getTime())
      return <span>{isValid ? date.toLocaleDateString('pt-BR') : String(value)}</span>
    }

    case 'number': {
      const num = Number(value)
      return <span>{isNaN(num) ? String(value) : num.toLocaleString('pt-BR')}</span>
    }

    case 'badge': {
      return <span style={badgeStyle}>{String(value)}</span>
    }

    case 'actions': {
      return <span>{value as React.ReactNode}</span>
    }

    default: {
      return <span>{String(value)}</span>
    }
  }
}

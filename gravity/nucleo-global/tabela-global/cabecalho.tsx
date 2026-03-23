import React from 'react'
import type { SortConfig } from './types.js'

interface CabecalhoProps {
  label: string
  columnKey: string
  sortable?: boolean
  sortConfig: SortConfig | null
  onSort: (key: string) => void
  width?: string
}

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--bg-elevated)',
  background: 'var(--bg-surface)',
  userSelect: 'none',
}

const sortableStyle: React.CSSProperties = {
  ...thStyle,
  cursor: 'pointer',
}

const sortableHoverStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }): React.ReactElement {
  const color = direction ? 'var(--accent)' : 'var(--text-muted)'
  const opacity = direction ? 1 : 0.4

  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: '0.375rem',
        fontSize: '0.7rem',
        color,
        opacity,
        transition: 'all 0.15s',
      }}
      aria-hidden="true"
    >
      {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'}
    </span>
  )
}

export function Cabecalho({
  label,
  columnKey,
  sortable,
  sortConfig,
  onSort,
  width,
}: CabecalhoProps): React.ReactElement {
  const isActive = sortConfig?.key === columnKey
  const direction = isActive ? sortConfig!.direction : null

  const style: React.CSSProperties = {
    ...(sortable ? sortableStyle : thStyle),
    ...(width ? { width } : {}),
    ...(isActive ? sortableHoverStyle : {}),
  }

  if (!sortable) {
    return <th style={style}>{label}</th>
  }

  return (
    <th
      style={style}
      onClick={() => onSort(columnKey)}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    >
      {label}
      <SortIcon direction={direction} />
    </th>
  )
}

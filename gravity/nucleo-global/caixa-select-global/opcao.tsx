import React from 'react'
import type { SelectOption } from './types.js'

interface OpcaoProps {
  opcao: SelectOption
  selecionada: boolean
  focada: boolean
  onSelecionar: (value: string) => void
  onFocar: (index: number) => void
  index: number
}

const baseStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  cursor: 'pointer',
  fontSize: '0.875rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  transition: 'background 0.1s',
  color: 'var(--text-primary)',
}

const checkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  fontSize: '0.75rem',
  flexShrink: 0,
}

export function Opcao({
  opcao,
  selecionada,
  focada,
  onSelecionar,
  onFocar,
  index,
}: OpcaoProps): React.ReactElement {
  const style: React.CSSProperties = {
    ...baseStyle,
    background: focada
      ? 'var(--bg-elevated)'
      : selecionada
        ? 'var(--bg-surface)'
        : 'transparent',
    color: opcao.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    cursor: opcao.disabled ? 'not-allowed' : 'pointer',
  }

  return (
    <div
      role="option"
      aria-selected={selecionada}
      aria-disabled={opcao.disabled}
      style={style}
      onMouseEnter={() => !opcao.disabled && onFocar(index)}
      onClick={() => !opcao.disabled && onSelecionar(opcao.value)}
    >
      <span>{opcao.label}</span>
      {selecionada && <span style={checkStyle} aria-hidden="true">✓</span>}
    </div>
  )
}

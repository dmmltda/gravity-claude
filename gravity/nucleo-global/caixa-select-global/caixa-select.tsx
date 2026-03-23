import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Opcao } from './opcao.js'
import type { SelectProps } from './types.js'

const triggerBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  background: 'var(--bg-base)',
  border: '1px solid var(--bg-elevated)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: '0.875rem',
  color: 'var(--text-primary)',
  width: '100%',
  textAlign: 'left',
  transition: 'all 0.15s',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: 'var(--bg-base)',
  border: '1px solid var(--bg-elevated)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
  zIndex: 200,
  overflow: 'hidden',
  maxHeight: '16rem',
  display: 'flex',
  flexDirection: 'column',
}

const buscaStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--bg-elevated)',
  background: 'var(--bg-surface)',
}

const inputBuscaStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-base)',
  border: '1px solid var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.375rem 0.5rem',
  fontSize: '0.8125rem',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

const listaStyle: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
}

const semResultadoStyle: React.CSSProperties = {
  padding: '0.75rem',
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
}

const chevronStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  flexShrink: 0,
  transition: 'transform 0.15s',
}

function getLabelSelecionado(props: SelectProps): string {
  if (!props.multiple) {
    if (!props.value) return props.placeholder ?? 'Selecione…'
    return props.options.find((o) => o.value === props.value)?.label ?? props.value
  }
  if (props.value.length === 0) return props.placeholder ?? 'Selecione…'
  if (props.value.length === 1) {
    return props.options.find((o) => o.value === props.value[0])?.label ?? props.value[0]
  }
  return `${props.value.length} selecionados`
}

export function CaixaSelectGlobal(props: SelectProps): React.ReactElement {
  const { options, disabled = false, id, name } = props

  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [indiceFocado, setIndiceFocado] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const opcoesFiltradas = useMemo(() => {
    if (!busca.trim()) return options
    const termo = busca.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(termo))
  }, [options, busca])

  const eSelecionada = useCallback(
    (value: string): boolean => {
      if (!props.multiple) return props.value === value
      return props.value.includes(value)
    },
    [props]
  )

  const selecionar = useCallback(
    (value: string): void => {
      if (!props.multiple) {
        props.onChange(value === props.value ? null : value)
        setAberto(false)
        setBusca('')
      } else {
        const atual = props.value
        if (atual.includes(value)) {
          props.onChange(atual.filter((v) => v !== value))
        } else {
          props.onChange([...atual, value])
        }
      }
    },
    [props]
  )

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Foco no input de busca ao abrir
  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 10)
      setIndiceFocado(0)
    }
  }, [aberto])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (!aberto) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setAberto(true)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        setAberto(false)
        setBusca('')
        break
      case 'ArrowDown':
        e.preventDefault()
        setIndiceFocado((i) => Math.min(i + 1, opcoesFiltradas.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setIndiceFocado((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (opcoesFiltradas[indiceFocado]) {
          selecionar(opcoesFiltradas[indiceFocado].value)
        }
        break
    }
  }

  const labelAtual = getLabelSelecionado(props)
  const temValor = props.multiple ? props.value.length > 0 : props.value !== null

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        id={id}
        name={name}
        style={{
          ...triggerBase,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: aberto ? 'var(--focus-ring)' : undefined,
          borderColor: aberto ? 'var(--accent)' : undefined,
        }}
        onClick={() => !disabled && setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-disabled={disabled}
        disabled={disabled}
      >
        <span style={{ color: temValor ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {labelAtual}
        </span>
        <span style={{ ...chevronStyle, transform: aberto ? 'rotate(180deg)' : undefined }}>
          ▾
        </span>
      </button>

      {aberto && (
        <div style={dropdownStyle}>
          <div style={buscaStyle}>
            <input
              ref={inputRef}
              style={inputBuscaStyle}
              type="text"
              placeholder="Buscar…"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setIndiceFocado(0)
              }}
              aria-label="Buscar opções"
            />
          </div>

          <div style={listaStyle} role="listbox" aria-multiselectable={props.multiple}>
            {opcoesFiltradas.length === 0 ? (
              <div style={semResultadoStyle}>Nenhum resultado.</div>
            ) : (
              opcoesFiltradas.map((opcao, i) => (
                <Opcao
                  key={opcao.value}
                  opcao={opcao}
                  selecionada={eSelecionada(opcao.value)}
                  focada={indiceFocado === i}
                  onSelecionar={selecionar}
                  onFocar={setIndiceFocado}
                  index={i}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { PopoverProps, Placement, PosicaoCalculada } from './types.js'

const OFFSET = 8

function calcularPosicao(
  trigger: DOMRect,
  popover: DOMRect,
  placement: Placement
): PosicaoCalculada {
  switch (placement) {
    case 'top':
      return {
        top: trigger.top - popover.height - OFFSET + window.scrollY,
        left: trigger.left + (trigger.width - popover.width) / 2 + window.scrollX,
      }
    case 'bottom':
      return {
        top: trigger.bottom + OFFSET + window.scrollY,
        left: trigger.left + (trigger.width - popover.width) / 2 + window.scrollX,
      }
    case 'left':
      return {
        top: trigger.top + (trigger.height - popover.height) / 2 + window.scrollY,
        left: trigger.left - popover.width - OFFSET + window.scrollX,
      }
    case 'right':
      return {
        top: trigger.top + (trigger.height - popover.height) / 2 + window.scrollY,
        left: trigger.right + OFFSET + window.scrollX,
      }
  }
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  background: 'var(--bg-base)',
  border: '1px solid var(--bg-elevated)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  zIndex: 4000,
  minWidth: '12rem',
  animation: 'gravity-fade-in 0.15s ease',
}

export function Popover({
  conteudo,
  children,
  placement = 'bottom',
  disabled = false,
  aberto: abertoControlado,
  onAbrir,
  onFechar,
}: PopoverProps): React.ReactElement {
  const [abertoInterno, setAbertoInterno] = useState(false)
  const [posicao, setPosicao] = useState<PosicaoCalculada>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const aberto = abertoControlado !== undefined ? abertoControlado : abertoInterno

  const alternarAberto = useCallback((): void => {
    if (disabled) return
    if (aberto) {
      setAbertoInterno(false)
      onFechar?.()
    } else {
      setAbertoInterno(true)
      onAbrir?.()
    }
  }, [aberto, disabled, onAbrir, onFechar])

  // Recalcular posição ao abrir
  useEffect(() => {
    if (!aberto) return
    requestAnimationFrame(() => {
      if (!triggerRef.current || !popoverRef.current) return
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const popoverRect = popoverRef.current.getBoundingClientRect()
      setPosicao(calcularPosicao(triggerRect, popoverRect, placement))
    })
  }, [aberto, placement])

  // Fechar ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const handler = (e: MouseEvent): void => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setAbertoInterno(false)
      onFechar?.()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto, onFechar])

  // Fechar com ESC
  useEffect(() => {
    if (!aberto) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setAbertoInterno(false)
        onFechar?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [aberto, onFechar])

  return (
    <>
      <span
        ref={triggerRef}
        onClick={alternarAberto}
        aria-expanded={aberto}
        aria-haspopup="true"
        style={{ display: 'inline-flex', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        {children}
      </span>

      {aberto && (
        <div
          ref={popoverRef}
          role="dialog"
          style={{ ...popoverStyle, top: posicao.top, left: posicao.left }}
        >
          {conteudo}
        </div>
      )}
    </>
  )
}

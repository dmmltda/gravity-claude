import React, { useState, useRef, useCallback, useId } from 'react'
import type { DicaProps, Placement, PosicaoCalculada } from './types.js'

const OFFSET = 8

function calcularPosicao(
  trigger: DOMRect,
  tooltip: DOMRect,
  placement: Placement
): PosicaoCalculada {
  switch (placement) {
    case 'top':
      return {
        top: trigger.top - tooltip.height - OFFSET + window.scrollY,
        left: trigger.left + (trigger.width - tooltip.width) / 2 + window.scrollX,
      }
    case 'bottom':
      return {
        top: trigger.bottom + OFFSET + window.scrollY,
        left: trigger.left + (trigger.width - tooltip.width) / 2 + window.scrollX,
      }
    case 'left':
      return {
        top: trigger.top + (trigger.height - tooltip.height) / 2 + window.scrollY,
        left: trigger.left - tooltip.width - OFFSET + window.scrollX,
      }
    case 'right':
      return {
        top: trigger.top + (trigger.height - tooltip.height) / 2 + window.scrollY,
        left: trigger.right + OFFSET + window.scrollX,
      }
  }
}

const tooltipBaseStyle: React.CSSProperties = {
  position: 'absolute',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  padding: '0.375rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.8125rem',
  boxShadow: 'var(--shadow-sm)',
  pointerEvents: 'none',
  zIndex: 5000,
  maxWidth: '16rem',
  whiteSpace: 'pre-wrap',
  animation: 'gravity-fade-in 0.1s ease',
}

export function Dica({
  conteudo,
  children,
  placement = 'top',
  delay = 300,
  disabled = false,
}: DicaProps): React.ReactElement {
  const [visivel, setVisivel] = useState(false)
  const [posicao, setPosicao] = useState<PosicaoCalculada>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()

  const mostrar = useCallback((): void => {
    if (disabled) return
    timerRef.current = setTimeout(() => {
      setVisivel(true)
      requestAnimationFrame(() => {
        if (!triggerRef.current || !tooltipRef.current) return
        const triggerRect = triggerRef.current.getBoundingClientRect()
        const tooltipRect = tooltipRef.current.getBoundingClientRect()
        setPosicao(calcularPosicao(triggerRect, tooltipRect, placement))
      })
    }, delay)
  }, [disabled, delay, placement])

  const esconder = useCallback((): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisivel(false)
  }, [])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={mostrar}
        onMouseLeave={esconder}
        onFocus={mostrar}
        onBlur={esconder}
        aria-describedby={visivel ? id : undefined}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>

      {visivel && (
        <div
          ref={tooltipRef}
          id={id}
          role="tooltip"
          style={{ ...tooltipBaseStyle, top: posicao.top, left: posicao.left }}
        >
          {conteudo}
        </div>
      )}
    </>
  )
}

import React, { useEffect, useCallback, useState } from 'react'
import type { ModalAba, ModalConfig } from './types.js'

interface ModalOverlayProps {
  modal: ModalConfig
  zIndex: number
  onFechar: (id: string) => void
}

const overlayBase: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(2px)',
  animation: 'gravity-fade-in 0.15s ease',
}

const dialogBase: React.CSSProperties = {
  background: 'var(--bg-base)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '90vh',
  overflow: 'hidden',
  animation: 'gravity-slide-up 0.15s ease',
}

const headerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid var(--bg-elevated)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const tituloStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
}

const btnFecharStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: '1.25rem',
  lineHeight: 1,
  padding: '0.25rem',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const bodyStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  padding: '1.5rem',
  flex: 1,
  overflowY: 'auto',
}

const footerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: '1rem 1.5rem',
  borderTop: '1px solid var(--bg-elevated)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
}

// Body sem padding quando o modo de abas está ativo — as abas gerenciam o próprio espaçamento.
const bodyComAbasStyle: React.CSSProperties = {
  ...bodyStyle,
  padding: 0,
}

// Underline tabs — design system: "para conteúdo aninhado em modais"
const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: '1px solid var(--bg-elevated)',
}

function tabItemStyle(ativa: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: ativa ? 'var(--accent)' : 'var(--text-secondary)',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${ativa ? 'var(--accent)' : 'transparent'}`,
    transition: 'all 0.15s',
  }
}

const tabPanelStyle: React.CSSProperties = {
  padding: '1.5rem',
}

// Componente interno — gerencia estado de aba ativa. Não exportado.
function CorpoComAbas({ abas }: { abas: ModalAba[] }): React.ReactElement {
  const [abaAtivaId, setAbaAtivaId] = useState<string>(abas[0]?.id ?? '')

  // Garante que a aba ativa sempre aponta para uma aba existente.
  const abaAtiva = abas.find((a) => a.id === abaAtivaId) ?? abas[0]

  return (
    <div>
      <div style={tabBarStyle} role="tablist">
        {abas.map((aba) => (
          <button
            key={aba.id}
            role="tab"
            aria-selected={aba.id === abaAtivaId}
            aria-controls={`tab-panel-${aba.id}`}
            id={`tab-${aba.id}`}
            style={tabItemStyle(aba.id === abaAtivaId)}
            onClick={() => setAbaAtivaId(aba.id)}
          >
            {aba.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`tab-panel-${abaAtiva?.id}`}
        aria-labelledby={`tab-${abaAtiva?.id}`}
        style={tabPanelStyle}
      >
        {abaAtiva?.conteudo}
      </div>
    </div>
  )
}

const keyframes = `
  @keyframes gravity-fade-in {
    from { opacity: 0 }
    to   { opacity: 1 }
  }
  @keyframes gravity-slide-up {
    from { opacity: 0; transform: translateY(12px) scale(0.97) }
    to   { opacity: 1; transform: translateY(0) scale(1) }
  }
`

let estiloInjetado = false

function injetarKeyframes(): void {
  if (estiloInjetado || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.textContent = keyframes
  document.head.appendChild(style)
  estiloInjetado = true
}

export function ModalOverlay({ modal, zIndex, onFechar }: ModalOverlayProps): React.ReactElement {
  injetarKeyframes()

  const fechar = useCallback(() => {
    onFechar(modal.id)
  }, [modal.id, onFechar])

  useEffect(() => {
    if (!modal.fecharComEsc) return

    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fechar, modal.fecharComEsc])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (modal.fecharComBackdrop && e.target === e.currentTarget) fechar()
  }

  return (
    <div
      style={{ ...overlayBase, zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={modal.titulo ? `modal-titulo-${modal.id}` : undefined}
      onClick={handleBackdropClick}
    >
      <div style={{ ...dialogBase, width: modal.largura ?? '32rem' }}>
        {modal.titulo && (
          <div style={headerStyle}>
            <h2 id={`modal-titulo-${modal.id}`} style={tituloStyle}>
              {modal.titulo}
            </h2>
            <button
              style={btnFecharStyle}
              onClick={fechar}
              aria-label="Fechar modal"
            >
              ✕
            </button>
          </div>
        )}

        <div style={modal.abas ? bodyComAbasStyle : bodyStyle}>
          {modal.abas ? <CorpoComAbas abas={modal.abas} /> : modal.conteudo}
        </div>

        {modal.footer && <div style={footerStyle}>{modal.footer}</div>}
      </div>
    </div>
  )
}

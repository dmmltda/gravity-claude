import React from 'react'
import type { ConfirmarConfig } from './types.js'

interface ConfirmarProps {
  config: ConfirmarConfig
  onConfirmar: () => void
  onCancelar: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(2px)',
  zIndex: 9999,
  animation: 'gravity-fade-in 0.15s ease',
}

const dialogStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  width: '24rem',
  maxWidth: '90vw',
  overflow: 'hidden',
  animation: 'gravity-slide-up 0.15s ease',
}

const headerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid var(--bg-elevated)',
}

const tituloStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
}

const bodyStyle: React.CSSProperties = {
  padding: '1.5rem',
  fontSize: '0.875rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
}

const footerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: '1rem 1.5rem',
  borderTop: '1px solid var(--bg-elevated)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.5rem 1.25rem',
  borderRadius: 'var(--radius-pill)',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: 'all 0.15s',
}

const btnCancelarStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
}

const btnConfirmarPadraoStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent)',
  color: '#0f172a',
}

const btnConfirmarPerigoStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--danger)',
  color: '#ffffff',
}

export function Confirmar({ config, onConfirmar, onCancelar }: ConfirmarProps): React.ReactElement {
  const {
    titulo = 'Confirmar',
    mensagem,
    textoBotaoConfirmar = 'Confirmar',
    textoBotaoCancelar = 'Cancelar',
    variante = 'padrao',
  } = config

  const btnConfirmarStyle =
    variante === 'perigo' ? btnConfirmarPerigoStyle : btnConfirmarPadraoStyle

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onCancelar()
  }

  return (
    <div
      style={overlayStyle}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmar-titulo"
      aria-describedby="confirmar-mensagem"
      onClick={handleBackdrop}
    >
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <h2 id="confirmar-titulo" style={tituloStyle}>
            {titulo}
          </h2>
        </div>

        <div style={bodyStyle}>
          <p id="confirmar-mensagem" style={{ margin: 0 }}>
            {mensagem}
          </p>
        </div>

        <div style={footerStyle}>
          <button style={btnCancelarStyle} onClick={onCancelar}>
            {textoBotaoCancelar}
          </button>
          <button style={btnConfirmarStyle} onClick={onConfirmar} autoFocus>
            {textoBotaoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

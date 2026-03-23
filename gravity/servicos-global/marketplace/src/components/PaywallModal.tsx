import { useState } from 'react'
import { buildConfiguradorUrl } from '../utils/configurador'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  featureName?: string
}

function isValidCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length === 16
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

export default function PaywallModal({
  isOpen,
  onClose,
  featureName = 'Filtro avançado',
}: PaywallModalProps) {
  const [cardNumber, setCardNumber] = useState('')
  const isValid = isValidCardNumber(cardNumber)

  function handleCardChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCardNumber(formatCardNumber(e.target.value))
  }

  function handleDesbloquear(e: React.FormEvent) {
    e.preventDefault()
    window.location.href = buildConfiguradorUrl({ plano: 'profissional' })
  }

  if (!isOpen) return null

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div>
            <span
              style={{
                background: 'rgba(245,158,11,0.15)',
                color: 'var(--color-warning)',
                fontSize: 11,
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-pill)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Feature Pro
            </span>
            <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginTop: '0.5rem' }}>
              Desbloqueie: {featureName}
            </h2>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Fechar">
            ✕
          </button>
        </div>

        {/* CORPO — 2 COLUNAS */}
        <div style={bodyStyle}>
          {/* COLUNA ESQUERDA — demo da feature */}
          <div style={demoColStyle}>
            <span className="text-micro" style={{ display: 'block', marginBottom: '1rem' }}>
              Preview da feature
            </span>
            <div style={demoPreviewStyle}>
              {/* Simulação de filtro avançado bloqueado */}
              <div style={{ marginBottom: '0.75rem' }}>
                <span className="text-micro" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Filtrar por NCM
                </span>
                <div style={mockInputStyle}>8471.30.19 — Laptops</div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span className="text-micro" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Origem
                </span>
                <div style={mockInputStyle}>China (CN) · EUA (US)</div>
              </div>
              <div>
                <span className="text-micro" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Faixa de valor CIF
                </span>
                <div
                  style={{
                    ...mockInputStyle,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>US$ 5.000</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                  <span>US$ 50.000</span>
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15,23,42,0.7)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(2px)',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: '0.5rem' }}>🔒</div>
                  <span
                    style={{
                      fontSize: 'var(--text-small)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Disponível no plano Pro
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA — formulário */}
          <div style={formColStyle}>
            <span className="text-micro" style={{ display: 'block', marginBottom: '1rem' }}>
              Desbloquear agora
            </span>
            <form onSubmit={handleDesbloquear}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="card"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-small)',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: '0.375rem',
                  }}
                >
                  Número do cartão
                </label>
                <input
                  id="card"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={handleCardChange}
                  style={{
                    width: '100%',
                    background: 'var(--color-bg-primary)',
                    border: `1px solid ${isValid ? 'var(--color-success)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.75rem',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-small)',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                />
                {isValid && (
                  <span
                    style={{
                      display: 'block',
                      marginTop: '0.375rem',
                      fontSize: 12,
                      color: 'var(--color-success)',
                    }}
                  >
                    ✓ Número válido
                  </span>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Você será redirecionado para o checkout seguro do Stripe para confirmar o plano
                Profissional.
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  opacity: isValid ? 1 : 0.6,
                  cursor: isValid ? 'pointer' : 'not-allowed',
                }}
                disabled={!isValid}
              >
                Desbloquear — Plano Pro
              </button>

              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
                Cancele quando quiser · Sem cobranças surpresa
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Estilos ──────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  padding: '1rem',
}

const modalStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  width: '100%',
  maxWidth: 700,
  boxShadow: 'var(--shadow-card)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '1.25rem 1.5rem',
  background: 'var(--color-bg-surface)',
  borderBottom: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  fontSize: 16,
  padding: '0.25rem',
  lineHeight: 1,
}

const bodyStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1.5rem',
  padding: '1.5rem',
}

const demoColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const demoPreviewStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem',
  position: 'relative',
  flex: 1,
}

const mockInputStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '0.5rem 0.75rem',
  fontSize: 'var(--text-small)',
  color: 'var(--color-text-secondary)',
}

const formColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

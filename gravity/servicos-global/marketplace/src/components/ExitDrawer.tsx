import { useState, useEffect } from 'react'

const SESSION_KEY = 'gravity_exit_drawer_shown'

export default function ExitDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SESSION_KEY)
    if (alreadyShown) return

    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) {
        sessionStorage.setItem(SESSION_KEY, 'true')
        setIsOpen(true)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    // Mock — apenas fecha o drawer
    setIsOpen(false)
  }

  function handleFechar() {
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Fundo translúcido NÃO bloqueante — pointer-events: none */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 149,
          pointerEvents: 'none',
        }}
      />

      {/* DRAWER LATERAL — desliza da direita */}
      <div
        style={drawerStyle}
        role="complementary"
        aria-label="Salvar acesso ao SimulaCusto"
      >
        {/* HEADER */}
        <div style={drawerHeaderStyle}>
          <span className="text-micro">Antes de ir embora</span>
          <button onClick={handleFechar} style={closeBtnStyle} aria-label="Fechar">
            ✕
          </button>
        </div>

        {/* CORPO */}
        <div style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: 28, marginBottom: '1rem' }}>👋</div>
          <h2
            style={{
              fontSize: 'var(--text-body)',
              fontWeight: 700,
              marginBottom: '0.75rem',
              lineHeight: 1.4,
            }}
          >
            Vimos que você explorou o SimulaCusto.
          </h2>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-small)',
              marginBottom: '1.5rem',
              lineHeight: 1.6,
            }}
          >
            Quer salvar seu acesso para testar depois? A gente guarda tudo para quando
            você estiver pronto.
          </p>

          <form onSubmit={handleSalvar}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="exit-email"
                style={{
                  display: 'block',
                  fontSize: 'var(--text-small)',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.375rem',
                }}
              >
                Seu e-mail
              </label>
              <input
                id="exit-email"
                type="email"
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 0.75rem',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-small)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Salvar acesso
            </button>
          </form>

          <button
            onClick={handleFechar}
            style={{
              marginTop: '0.75rem',
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'center',
              padding: '0.375rem',
            }}
          >
            Não, obrigado
          </button>
        </div>
      </div>
    </>
  )
}

// ── Estilos ──────────────────────────────────────────────────────

const drawerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 320,
  background: 'var(--color-bg-secondary)',
  borderLeft: '1px solid var(--color-border)',
  boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
  zIndex: 150,
  display: 'flex',
  flexDirection: 'column',
  animation: 'slideInRight 0.25s ease',
}

const drawerHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 1.5rem',
  background: 'var(--color-bg-surface)',
  borderBottom: '1px solid var(--color-border)',
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

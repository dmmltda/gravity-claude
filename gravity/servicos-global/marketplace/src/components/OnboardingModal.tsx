import { useState } from 'react'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

type Perfil = 'Dev' | 'Designer' | 'Manager'

const CORES = [
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Violet', value: '#a78bfa' },
  { label: 'Emerald', value: '#34d399' },
  { label: 'Amber', value: '#fbbf24' },
  { label: 'Rose', value: '#fb7185' },
  { label: 'Slate', value: '#94a3b8' },
]

const PERFIS: Perfil[] = ['Dev', 'Designer', 'Manager']

const MOCK_DADOS: Record<Perfil, { kpis: Array<{ label: string; valor: string }>; desc: string }> = {
  Dev: {
    kpis: [
      { label: 'Simulações rodadas', valor: '1.247' },
      { label: 'NCMs na base', valor: '12.850' },
      { label: 'Tempo médio de resposta', valor: '82ms' },
      { label: 'Uptime', valor: '99.98%' },
    ],
    desc: 'Sua API está pronta. Integre o SimulaCusto ao seu sistema em minutos.',
  },
  Designer: {
    kpis: [
      { label: 'Componentes no sistema', valor: '64' },
      { label: 'Tokens de design', valor: '120' },
      { label: 'Temas disponíveis', valor: '2' },
      { label: 'Acessibilidade', valor: 'AA+' },
    ],
    desc: 'Interface limpa, consistente e acessível. Tokens CSS prontos para customização.',
  },
  Manager: {
    kpis: [
      { label: 'Simulações este mês', valor: '3.480' },
      { label: 'Economia estimada', valor: 'R$ 42k' },
      { label: 'Usuários ativos', valor: '28' },
      { label: 'Relatórios gerados', valor: '194' },
    ],
    desc: 'Visibilidade completa das operações. Tome decisões com dados reais.',
  },
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  function handleCorClick(cor: string) {
    document.documentElement.style.setProperty('--color-accent', cor)
    setPasso(2)
  }

  function handlePerfilClick(p: Perfil) {
    setPerfil(p)
    setPasso(3)
  }

  function handleFechar() {
    setPasso(1)
    setPerfil(null)
    onClose()
  }

  if (!isOpen) return null

  const mockData = perfil ? MOCK_DADOS[perfil] : null

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        {/* HEADER */}
        <div style={modalHeaderStyle}>
          <div>
            <span className="text-micro">Preview do Gravity</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {([1, 2, 3] as const).map((n) => (
                <div
                  key={n}
                  style={{
                    width: 24,
                    height: 4,
                    borderRadius: 2,
                    background: passo >= n ? 'var(--color-accent)' : 'var(--color-bg-elevated)',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>
          </div>
          <button onClick={handleFechar} style={closeBtnStyle} aria-label="Fechar">
            ✕
          </button>
        </div>

        {/* CORPO */}
        <div style={{ padding: '2rem' }}>
          {passo === 1 && (
            <div>
              <h2 style={{ fontSize: 'var(--text-heading)', marginBottom: '0.5rem' }}>
                Qual a cor da sua marca?
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-small)', marginBottom: '2rem' }}>
                O sistema inteiro vai se adaptar em tempo real.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                }}
              >
                {CORES.map((cor) => (
                  <button
                    key={cor.value}
                    onClick={() => handleCorClick(cor.value)}
                    style={{
                      background: cor.value,
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      height: 64,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0f172a',
                      fontWeight: 700,
                      fontSize: 12,
                      transition: 'transform 0.1s',
                    }}
                  >
                    {cor.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {passo === 2 && (
            <div>
              <h2 style={{ fontSize: 'var(--text-heading)', marginBottom: '0.5rem' }}>
                Qual é o seu perfil?
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-small)', marginBottom: '2rem' }}>
                Vamos mostrar o que mais importa para você.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {PERFIS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePerfilClick(p)}
                    style={perfilBtnStyle}
                  >
                    <span style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{p}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-small)' }}>
                      {p === 'Dev' && 'Integração, API e performance'}
                      {p === 'Designer' && 'Componentes, tokens e design system'}
                      {p === 'Manager' && 'Métricas, relatórios e ROI'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {passo === 3 && mockData && perfil && (
            <div>
              <h2 style={{ fontSize: 'var(--text-heading)', marginBottom: '0.5rem' }}>
                Seu dashboard, {perfil}
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-small)', marginBottom: '2rem' }}>
                {mockData.desc}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  marginBottom: '2rem',
                }}
              >
                {mockData.kpis.map((kpi) => (
                  <div key={kpi.label} style={kpiCardStyle}>
                    <span className="text-micro" style={{ display: 'block', marginBottom: '0.25rem' }}>
                      {kpi.label}
                    </span>
                    <strong style={{ fontSize: 22, color: 'var(--color-accent)' }}>
                      {kpi.valor}
                    </strong>
                  </div>
                ))}
              </div>
              <button onClick={handleFechar} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Gostou? Começar trial grátis →
              </button>
            </div>
          )}
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
  maxWidth: 480,
  boxShadow: 'var(--shadow-card)',
}

const modalHeaderStyle: React.CSSProperties = {
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

const perfilBtnStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem 1.25rem',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  color: 'var(--color-text-primary)',
  transition: 'border-color 0.15s',
}

const kpiCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem',
}

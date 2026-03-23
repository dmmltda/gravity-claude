import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { buildTrialUrl } from '../utils/configurador'

const TRIAL_INCLUDES = [
  'Acesso completo ao SimulaCusto por 14 dias',
  'Cálculo de impostos por NCM sem limite de simulações',
  'Exportação de relatórios em PDF e planilha',
  'Dashboard com histórico completo de simulações',
  'Suporte via chat durante o período de trial',
]

export default function Trial() {
  useEffect(() => {
    document.title = '14 dias grátis, sem cartão — Gravity Trial'
  }, [])

  return (
    <HelmetProvider>
      <Helmet>
        <title>14 dias grátis, sem cartão — Gravity Trial</title>
        <meta
          name="description"
          content="Comece seu trial gratuito de 14 dias no Gravity. Sem cartão de crédito. Acesso completo ao SimulaCusto."
        />
        <meta property="og:title" content="14 dias grátis, sem cartão — Gravity Trial" />
        <meta
          property="og:description"
          content="Comece seu trial gratuito de 14 dias no Gravity. Sem cartão de crédito. Acesso completo ao SimulaCusto."
        />
      </Helmet>

      <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        {/* NAV */}
        <nav style={navStyle}>
          <Link to="/" style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-accent)', textDecoration: 'none' }}>
            Gravity
          </Link>
          <Link to="/precos" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: 'var(--text-small)' }}>
            Ver planos
          </Link>
        </nav>

        {/* CONTEÚDO */}
        <section style={contentStyle}>
          <div style={cardStyle}>
            {/* BADGE */}
            <div style={trialBadgeStyle}>
              <span>14 dias grátis</span>
              <span style={{ color: 'var(--color-text-muted)', margin: '0 0.5rem' }}>·</span>
              <span>Sem cartão de crédito</span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                fontWeight: 700,
                marginBottom: '1rem',
                textAlign: 'center',
              }}
            >
              Teste o Gravity sem compromisso
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                marginBottom: '2rem',
                maxWidth: 420,
                margin: '0 auto 2rem',
              }}
            >
              Acesso completo por 14 dias. Cancele a qualquer momento, sem perguntas.
            </p>

            {/* O QUE ESTÁ INCLUÍDO */}
            <div style={includesBoxStyle}>
              <span className="text-micro" style={{ display: 'block', marginBottom: '1rem' }}>
                O que está incluído no trial
              </span>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {TRIAL_INCLUDES.map((item) => (
                  <li
                    key={item}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                      fontSize: 'var(--text-small)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--color-success)',
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <a
              href={buildTrialUrl('simula-custo')}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: '2rem' }}
            >
              Começar agora — é grátis
            </a>

            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 12,
                textAlign: 'center',
                marginTop: '1rem',
              }}
            >
              Sem cartão de crédito · Cancele quando quiser · Sem cobranças automáticas
            </p>
          </div>
        </section>
      </div>
    </HelmetProvider>
  )
}

// ── Estilos ──────────────────────────────────────────────────────

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem 2rem',
  borderBottom: '1px solid var(--color-border)',
  background: 'var(--color-bg-secondary)',
}

const contentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'calc(100vh - 65px)',
  padding: '3rem 1.5rem',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '2.5rem',
  width: '100%',
  maxWidth: 480,
}

const trialBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(56,189,248,0.1)',
  border: '1px solid rgba(56,189,248,0.3)',
  borderRadius: 'var(--radius-pill)',
  padding: '0.375rem 1rem',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-accent)',
  marginBottom: '1.5rem',
}

const includesBoxStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '1.25rem',
}

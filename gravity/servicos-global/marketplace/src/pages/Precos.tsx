import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { buildConfiguradorUrl } from '../utils/configurador'

interface Plano {
  nome: string
  preco: string
  periodo: string
  destaque: boolean
  planoId: 'basico' | 'profissional'
  features: Record<string, boolean | string>
}

const FEATURES_LABELS: Record<string, string> = {
  produtos: 'Produtos ativos',
  usuarios: 'Usuários',
  dashboard: 'Dashboard',
  relatorios: 'Relatórios exportáveis',
  historico: 'Histórico ilimitado',
  erp: 'Integração ERP',
  suporte: 'Suporte',
  api: 'Acesso à API',
  sla: 'SLA garantido',
}

const PLANOS: Plano[] = [
  {
    nome: 'Básico',
    preco: 'R$ 297',
    periodo: '/mês',
    destaque: false,
    planoId: 'basico',
    features: {
      produtos: '1 produto',
      usuarios: '5 usuários',
      dashboard: 'Básico',
      relatorios: false,
      historico: false,
      erp: false,
      suporte: 'Email',
      api: false,
      sla: false,
    },
  },
  {
    nome: 'Profissional',
    preco: 'R$ 697',
    periodo: '/mês',
    destaque: true,
    planoId: 'profissional',
    features: {
      produtos: 'Todos os produtos',
      usuarios: 'Ilimitados',
      dashboard: 'Avançado',
      relatorios: true,
      historico: true,
      erp: true,
      suporte: 'Prioritário',
      api: true,
      sla: false,
    },
  },
]

function renderFeatureValue(val: boolean | string): React.ReactNode {
  if (val === true) return <span style={{ color: 'var(--color-success)' }}>✓</span>
  if (val === false) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return <span style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-secondary)' }}>{val}</span>
}

export default function Precos() {
  useEffect(() => {
    document.title = 'Preços — Gravity'
  }, [])

  return (
    <HelmetProvider>
      <Helmet>
        <title>Preços — Gravity</title>
        <meta
          name="description"
          content="Planos Básico e Profissional para empresas de comércio exterior. Comece grátis por 14 dias, sem cartão de crédito."
        />
        <meta property="og:title" content="Preços — Gravity" />
        <meta
          property="og:description"
          content="Planos Básico e Profissional para empresas de comércio exterior. Comece grátis por 14 dias, sem cartão de crédito."
        />
      </Helmet>

      <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        {/* NAV */}
        <nav style={navStyle}>
          <Link to="/" style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-accent)', textDecoration: 'none' }}>
            Gravity
          </Link>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/produtos/simula-custo" className="btn btn-ghost">Produtos</Link>
            <Link to="/trial" className="btn btn-primary">Teste Grátis</Link>
          </div>
        </nav>

        {/* HERO */}
        <section style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <span className="text-micro" style={{ display: 'block', marginBottom: '1rem' }}>
            Planos e preços
          </span>
          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, var(--text-heading))', marginBottom: '1rem' }}>
            Simples, transparente, sem surpresas
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: 480, margin: '0 auto' }}>
            Comece com 14 dias grátis em qualquer plano. Sem cartão de crédito.
          </p>
        </section>

        {/* CARDS DE PLANO */}
        <section style={{ padding: '0 2rem 4rem', maxWidth: 800, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginBottom: '3rem',
            }}
          >
            {PLANOS.map((plano) => (
              <div
                key={plano.nome}
                style={{
                  ...planCardStyle,
                  border: plano.destaque
                    ? '2px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                }}
              >
                {plano.destaque && (
                  <div style={popularBadgeStyle}>Mais popular</div>
                )}
                <h2 style={{ fontSize: 'var(--text-heading)', marginBottom: '0.5rem' }}>{plano.nome}</h2>
                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: 32, fontWeight: 700 }}>{plano.preco}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-small)' }}>
                    {plano.periodo}
                  </span>
                </div>
                <a
                  href={buildConfiguradorUrl({ plano: plano.planoId })}
                  className={plano.destaque ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem' }}
                >
                  Começar com {plano.nome}
                </a>
                <Link
                  to="/trial"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    fontSize: 'var(--text-small)',
                    color: 'var(--color-text-muted)',
                    textDecoration: 'none',
                  }}
                >
                  ou iniciar trial grátis
                </Link>
              </div>
            ))}
          </div>

          {/* TABELA COMPARATIVA */}
          <div
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              marginBottom: '3rem',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                background: 'var(--color-bg-surface)',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <span className="text-micro">Funcionalidade</span>
              <span className="text-micro" style={{ textAlign: 'center' }}>Básico</span>
              <span className="text-micro" style={{ textAlign: 'center' }}>Profissional</span>
            </div>
            {Object.entries(FEATURES_LABELS).map(([key, label], idx) => (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  padding: '0.875rem 1.5rem',
                  borderBottom: idx < Object.keys(FEATURES_LABELS).length - 1
                    ? '1px solid var(--color-border)'
                    : 'none',
                  alignItems: 'center',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-secondary)' }}>
                  {label}
                </span>
                <div style={{ textAlign: 'center' }}>
                  {renderFeatureValue(PLANOS[0].features[key])}
                </div>
                <div style={{ textAlign: 'center' }}>
                  {renderFeatureValue(PLANOS[1].features[key])}
                </div>
              </div>
            ))}
          </div>

          {/* ENTERPRISE */}
          <div style={enterpriseCardStyle}>
            <div>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginBottom: '0.25rem' }}>
                Enterprise
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-small)' }}>
                SLA garantido, onboarding dedicado, API personalizada e suporte 24/7.
              </p>
            </div>
            <a
              href="mailto:vendas@gravity.com.br"
              className="btn btn-secondary"
              style={{ whiteSpace: 'nowrap' }}
            >
              Falar com vendas
            </a>
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
  position: 'sticky',
  top: 0,
  zIndex: 100,
}

const planCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  borderRadius: 'var(--radius-lg)',
  padding: '2rem',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
}

const popularBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-12px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'var(--color-accent)',
  color: '#0f172a',
  fontSize: 11,
  fontWeight: 700,
  padding: '0.25rem 0.75rem',
  borderRadius: 'var(--radius-pill)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
}

const enterpriseCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem 2rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',
}

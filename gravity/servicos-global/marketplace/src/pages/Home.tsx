import { useEffect } from 'react'
import { HelmetProvider, Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { buildTrialUrl } from '../utils/configurador'

const LOGOS_MOCK = ['Importex SA', 'LogComex', 'TradeFlow', 'AlfaBrasil', 'NovaCargo']

const DEPOIMENTOS = [
  {
    nome: 'Ana Ferreira',
    cargo: 'Analista Comex — Importex SA',
    texto:
      'O SimulaCusto reduziu em 70% o tempo de cotação de impostos. Nossa equipe ganhou horas por semana.',
  },
  {
    nome: 'Carlos Menezes',
    cargo: 'Gerente de Operações — LogComex',
    texto:
      'Finalmente uma plataforma que integra tudo. Dashboard, histórico e relatórios em um só lugar.',
  },
]

const PLANOS = [
  {
    nome: 'Básico',
    preco: 'R$ 297',
    periodo: '/mês',
    destaque: false,
    features: ['1 produto ativo', 'Dashboard básico', 'Suporte por email', '5 usuários'],
    cta: 'Começar grátis',
    plano: 'basico',
  },
  {
    nome: 'Profissional',
    preco: 'R$ 697',
    periodo: '/mês',
    destaque: true,
    features: [
      'Todos os produtos',
      'Dashboard avançado',
      'Suporte prioritário',
      'Usuários ilimitados',
      'Relatórios exportáveis',
      'Integração ERP',
    ],
    cta: 'Mais popular',
    plano: 'profissional',
  },
  {
    nome: 'Enterprise',
    preco: 'Sob consulta',
    periodo: '',
    destaque: false,
    features: [
      'Tudo do Profissional',
      'SLA garantido',
      'Onboarding dedicado',
      'API personalizada',
    ],
    cta: 'Falar com vendas',
    plano: 'enterprise',
  },
]

export default function Home() {
  useEffect(() => {
    document.title = 'Gravity — Plataforma SaaS B2B para Comércio Exterior'
  }, [])

  return (
    <HelmetProvider>
      <Helmet>
        <title>Gravity — Plataforma SaaS B2B para Comércio Exterior</title>
        <meta
          name="description"
          content="Gravity é a plataforma modular para empresas de comércio exterior. Simule custos, gerencie importações e integre seu ERP em minutos."
        />
        <meta property="og:title" content="Gravity — Plataforma SaaS B2B para Comércio Exterior" />
        <meta
          property="og:description"
          content="Gravity é a plataforma modular para empresas de comércio exterior. Simule custos, gerencie importações e integre seu ERP em minutos."
        />
      </Helmet>

      <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        {/* NAV */}
        <nav style={navStyle}>
          <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-accent)' }}>
            Gravity
          </span>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <Link to="/produtos/simula-custo" style={navLinkStyle}>
              Produtos
            </Link>
            <Link to="/precos" style={navLinkStyle}>
              Preços
            </Link>
            <Link to="/trial" style={navLinkStyle}>
              Trial
            </Link>
            <a href={buildTrialUrl('simula-custo')} className="btn btn-primary">
              Teste Grátis
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section style={heroStyle}>
          <span className="text-micro" style={{ marginBottom: '1rem', display: 'block' }}>
            Plataforma modular · Multi-tenant · B2B
          </span>
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, var(--text-hero))',
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: '1.5rem',
              maxWidth: 700,
            }}
          >
            Operações de Comércio Exterior{' '}
            <span style={{ color: 'var(--color-accent)' }}>sem complexidade</span>
          </h1>
          <p
            style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-secondary)',
              maxWidth: 560,
              marginBottom: '2.5rem',
            }}
          >
            Simule custos de importação, integre seu ERP e gerencie toda a operação em uma
            plataforma modular. 14 dias grátis, sem cartão.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href={buildTrialUrl('simula-custo')} className="btn btn-primary btn-lg">
              Teste Grátis — 14 dias
            </a>
            <Link to="/produtos/simula-custo" className="btn btn-secondary btn-lg">
              Ver produtos
            </Link>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section style={sectionStyle}>
          <p className="text-micro" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            Empresas que confiam no Gravity
          </p>
          <div style={logosGridStyle}>
            {LOGOS_MOCK.map((logo) => (
              <div key={logo} style={logoCardStyle}>
                {logo}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginTop: '3rem',
            }}
          >
            {DEPOIMENTOS.map((d) => (
              <div key={d.nome} style={depoimentoCardStyle}>
                <p
                  style={{
                    color: 'var(--color-text-secondary)',
                    marginBottom: '1rem',
                    fontStyle: 'italic',
                  }}
                >
                  "{d.texto}"
                </p>
                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--text-small)' }}>
                    {d.nome}
                  </strong>
                  <span className="text-micro">{d.cargo}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SHOWCASE */}
        <section style={{ ...sectionStyle, background: 'var(--color-bg-secondary)', padding: '4rem 2rem' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <p className="text-micro" style={{ marginBottom: '0.75rem' }}>
              Demo interativa
            </p>
            <h2 style={{ fontSize: 'var(--text-heading)', marginBottom: '1rem' }}>
              Experimente o SimulaCusto agora
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
              Veja uma simulação de custo de importação com dados reais — sem cadastro.
            </p>
            <div style={showcaseCardStyle}>
              <div style={showcaseHeaderStyle}>
                <span className="text-micro">Simulação · NCMH 8471.30.19</span>
                <span
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    color: 'var(--color-success)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Resultado calculado
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '1rem',
                  padding: '1.5rem',
                }}
              >
                {[
                  { label: 'II (Imposto de Importação)', valor: 'R$ 4.200,00' },
                  { label: 'IPI', valor: 'R$ 1.050,00' },
                  { label: 'PIS/COFINS', valor: 'R$ 630,00' },
                  { label: 'Total Tributos', valor: 'R$ 5.880,00' },
                ].map((item) => (
                  <div key={item.label} style={kpiCardStyle}>
                    <span className="text-micro" style={{ marginBottom: '0.5rem', display: 'block' }}>
                      {item.label}
                    </span>
                    <strong style={{ fontSize: 20, color: 'var(--color-accent)' }}>
                      {item.valor}
                    </strong>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 1.5rem 1.5rem', textAlign: 'center' }}>
                <Link to="/produtos/simula-custo" className="btn btn-secondary">
                  Ver produto completo →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* PREÇOS RESUMIDOS */}
        <section style={sectionStyle}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <p className="text-micro" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
              Planos
            </p>
            <h2
              style={{
                fontSize: 'var(--text-heading)',
                textAlign: 'center',
                marginBottom: '0.75rem',
              }}
            >
              Simples e transparente
            </h2>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                marginBottom: '3rem',
              }}
            >
              Comece grátis. Sem cartão de crédito.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1.5rem',
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
                  <h3 style={{ fontSize: 'var(--text-heading)', marginBottom: '0.5rem' }}>
                    {plano.nome}
                  </h3>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: 28, fontWeight: 700 }}>{plano.preco}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-small)' }}>
                      {plano.periodo}
                    </span>
                  </div>
                  <ul style={{ listStyle: 'none', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {plano.features.map((f) => (
                      <li
                        key={f}
                        style={{
                          fontSize: 'var(--text-small)',
                          color: 'var(--color-text-secondary)',
                          display: 'flex',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ color: 'var(--color-success)' }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/precos"
                    className={plano.destaque ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {plano.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={footerStyle}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '2rem',
                marginBottom: '2rem',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-accent)', fontSize: 18 }}>Gravity</strong>
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-small)',
                    marginTop: '0.5rem',
                  }}
                >
                  Plataforma SaaS B2B modular para comércio exterior.
                </p>
              </div>
              <div>
                <span className="text-micro" style={{ display: 'block', marginBottom: '1rem' }}>
                  Produto
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Link to="/produtos/simula-custo" style={footerLinkStyle}>SimulaCusto</Link>
                  <Link to="/precos" style={footerLinkStyle}>Preços</Link>
                  <Link to="/trial" style={footerLinkStyle}>Trial Grátis</Link>
                </div>
              </div>
              <div>
                <span className="text-micro" style={{ display: 'block', marginBottom: '1rem' }}>
                  Empresa
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={footerLinkStyle}>Sobre</span>
                  <span style={footerLinkStyle}>Blog</span>
                  <span style={footerLinkStyle}>Contato</span>
                </div>
              </div>
            </div>
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: '1.5rem',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-small)',
                textAlign: 'center',
              }}
            >
              © {new Date().getFullYear()} Gravity. Todos os direitos reservados.
            </div>
          </div>
        </footer>
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

const navLinkStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  textDecoration: 'none',
  fontSize: 'var(--text-small)',
  fontWeight: 500,
}

const heroStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: '0 auto',
  padding: '5rem 2rem',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

const sectionStyle: React.CSSProperties = {
  padding: '4rem 2rem',
}

const logosGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  flexWrap: 'wrap',
  maxWidth: 700,
  margin: '0 auto',
}

const logoCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '0.625rem 1.25rem',
  fontSize: 'var(--text-small)',
  color: 'var(--color-text-muted)',
  fontWeight: 600,
}

const depoimentoCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
  maxWidth: 900,
  margin: '0 auto',
}

const showcaseCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
}

const showcaseHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 1.5rem',
  background: 'var(--color-bg-surface)',
  borderBottom: '1px solid var(--color-border)',
}

const kpiCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem',
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

const footerStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  borderTop: '1px solid var(--color-border)',
  padding: '3rem 2rem',
}

const footerLinkStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-small)',
  textDecoration: 'none',
  cursor: 'pointer',
}

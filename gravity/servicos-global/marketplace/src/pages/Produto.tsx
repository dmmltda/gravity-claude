import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { buildConfiguradorUrl, buildTrialUrl } from '../utils/configurador'

const FEATURES_SIMULA_CUSTO = [
  {
    titulo: 'Cálculo de impostos em tempo real',
    descricao:
      'II, IPI, PIS, COFINS, ICMS e taxas aduaneiras calculados automaticamente por NCM.',
  },
  {
    titulo: 'Simulação por NCM',
    descricao:
      'Base atualizada de todas as NCMs vigentes com alíquotas corretas por origem e destinação.',
  },
  {
    titulo: 'Exportação de relatórios',
    descricao: 'Gere PDFs e planilhas prontos para apresentar ao cliente ou arquivar no ERP.',
  },
  {
    titulo: 'Histórico de simulações',
    descricao:
      'Todas as simulações ficam salvas com comparação de cenários lado a lado.',
  },
]

const PRODUTO_DESCONHECIDO = 'Produto não encontrado'

export default function Produto() {
  const { slug } = useParams<{ slug: string }>()
  const isSimulaCusto = slug === 'simula-custo'

  useEffect(() => {
    document.title = isSimulaCusto
      ? 'SimulaCusto — Simulador de Custos de Importação | Gravity'
      : `${PRODUTO_DESCONHECIDO} | Gravity`
  }, [isSimulaCusto])

  if (!isSimulaCusto) {
    return (
      <div style={notFoundStyle}>
        <h1 style={{ fontSize: 'var(--text-heading)', marginBottom: '1rem' }}>
          {PRODUTO_DESCONHECIDO}
        </h1>
        <Link to="/" className="btn btn-secondary">
          Voltar ao início
        </Link>
      </div>
    )
  }

  return (
    <HelmetProvider>
      <Helmet>
        <title>SimulaCusto — Simulador de Custos de Importação | Gravity</title>
        <meta
          name="description"
          content="Calcule impostos de importação em segundos. II, IPI, PIS, COFINS e ICMS por NCM. 14 dias grátis, sem cartão."
        />
        <meta property="og:title" content="SimulaCusto — Simulador de Custos de Importação | Gravity" />
        <meta
          property="og:description"
          content="Calcule impostos de importação em segundos. II, IPI, PIS, COFINS e ICMS por NCM. 14 dias grátis, sem cartão."
        />
      </Helmet>

      <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        {/* NAV */}
        <nav style={navStyle}>
          <Link to="/" style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-accent)', textDecoration: 'none' }}>
            Gravity
          </Link>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/precos" className="btn btn-ghost">Preços</Link>
            <a href={buildTrialUrl('simula-custo')} className="btn btn-primary">
              Teste Grátis
            </a>
          </div>
        </nav>

        {/* HERO DO PRODUTO */}
        <section style={heroStyle}>
          <span className="text-micro" style={{ marginBottom: '1rem', display: 'block' }}>
            Produto · SimulaCusto
          </span>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 700,
              lineHeight: 1.2,
              marginBottom: '1.25rem',
              maxWidth: 640,
            }}
          >
            Simule custos de importação{' '}
            <span style={{ color: 'var(--color-accent)' }}>em segundos</span>
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              maxWidth: 540,
              marginBottom: '2.5rem',
              fontSize: 'var(--text-body)',
            }}
          >
            Calcule II, IPI, PIS, COFINS e ICMS automaticamente por NCM. Histórico completo,
            relatórios exportáveis e integração com seu ERP.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href={buildTrialUrl('simula-custo')} className="btn btn-primary btn-lg">
              Teste Grátis — 14 dias
            </a>
            <a
              href={buildConfiguradorUrl({ produto: 'simula-custo', plano: 'profissional' })}
              className="btn btn-secondary btn-lg"
            >
              Assinar agora
            </a>
          </div>
        </section>

        {/* FEATURES */}
        <section style={sectionStyle}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <p className="text-micro" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
              Funcionalidades
            </p>
            <h2
              style={{
                fontSize: 'var(--text-heading)',
                textAlign: 'center',
                marginBottom: '3rem',
              }}
            >
              Tudo que você precisa para cotar uma importação
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {FEATURES_SIMULA_CUSTO.map((f) => (
                <div key={f.titulo} style={featureCardStyle}>
                  <div style={featureIconStyle}>✦</div>
                  <h3
                    style={{
                      fontSize: 'var(--text-body)',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {f.titulo}
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-small)' }}>
                    {f.descricao}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEMO MOCK */}
        <section
          style={{
            background: 'var(--color-bg-secondary)',
            padding: '4rem 2rem',
          }}
        >
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <p className="text-micro" style={{ marginBottom: '0.75rem' }}>
              Preview da interface
            </p>
            <h2 style={{ fontSize: 'var(--text-heading)', marginBottom: '2rem' }}>
              Interface limpa, resultado imediato
            </h2>
            <div style={demoContainerStyle}>
              <div style={demoHeaderStyle}>
                <span className="text-micro">Nova Simulação</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                </div>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={demoInputStyle}>
                  <span className="text-micro" style={{ marginBottom: '0.5rem', display: 'block' }}>NCM</span>
                  <div style={demoInputFieldStyle}>8471.30.19</div>
                </div>
                <div style={demoInputStyle}>
                  <span className="text-micro" style={{ marginBottom: '0.5rem', display: 'block' }}>Valor CIF (USD)</span>
                  <div style={demoInputFieldStyle}>12.500,00</div>
                </div>
                <div style={demoInputStyle}>
                  <span className="text-micro" style={{ marginBottom: '0.5rem', display: 'block' }}>País de Origem</span>
                  <div style={demoInputFieldStyle}>China (CN)</div>
                </div>
                <div style={demoInputStyle}>
                  <span className="text-micro" style={{ marginBottom: '0.5rem', display: 'block' }}>Estado Destinatário</span>
                  <div style={demoInputFieldStyle}>SP</div>
                </div>
              </div>
              <div
                style={{
                  background: 'var(--color-bg-primary)',
                  margin: '0 1.5rem 1.5rem',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span className="text-micro" style={{ marginBottom: '1rem', display: 'block' }}>
                  Resultado
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  {[
                    { label: 'II', valor: 'R$ 4.200' },
                    { label: 'IPI', valor: 'R$ 1.050' },
                    { label: 'PIS/COF.', valor: 'R$ 630' },
                    { label: 'TOTAL', valor: 'R$ 5.880' },
                  ].map((k) => (
                    <div
                      key={k.label}
                      style={{
                        background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                        textAlign: 'center',
                      }}
                    >
                      <span className="text-micro" style={{ display: 'block', marginBottom: '0.25rem' }}>
                        {k.label}
                      </span>
                      <strong style={{ color: 'var(--color-accent)', fontSize: 14 }}>{k.valor}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section style={{ padding: '5rem 2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'var(--text-heading)', marginBottom: '1rem' }}>
            Pronto para começar?
          </h2>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              marginBottom: '2rem',
              maxWidth: 400,
              margin: '0 auto 2rem',
            }}
          >
            14 dias grátis, sem cartão de crédito. Cancele quando quiser.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={buildTrialUrl('simula-custo')} className="btn btn-primary btn-lg">
              Começar Trial Grátis
            </a>
            <a
              href={buildConfiguradorUrl({ produto: 'simula-custo', plano: 'profissional' })}
              className="btn btn-secondary btn-lg"
            >
              Ver planos
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

const heroStyle: React.CSSProperties = {
  maxWidth: 800,
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

const featureCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
}

const featureIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: 'rgba(56,189,248,0.1)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-accent)',
  marginBottom: '1rem',
  fontSize: 16,
}

const demoContainerStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
}

const demoHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1.5rem',
  background: 'var(--color-bg-surface)',
  borderBottom: '1px solid var(--color-border)',
}

const demoInputStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const demoInputFieldStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '0.5rem 0.75rem',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-small)',
}

const notFoundStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
}

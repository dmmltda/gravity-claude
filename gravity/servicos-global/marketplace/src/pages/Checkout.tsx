import { useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { buildConfiguradorUrl } from '../utils/configurador'

const PRODUCT_NAMES: Record<string, string> = {
  'simula-custo': 'SimulaCusto',
}

const PLAN_LABELS: Record<string, string> = {
  basico: 'Básico',
  profissional: 'Profissional',
  enterprise: 'Enterprise',
}

const PLAN_PRICES: Record<string, string> = {
  basico: 'R$ 297/mês',
  profissional: 'R$ 697/mês',
  enterprise: 'Sob consulta',
}

const SECURITY_BULLETS = [
  'Cancele quando quiser, sem multa',
  'Dados criptografados com SSL',
  'Pagamento processado com segurança pelo Stripe',
  'Suporte disponível durante a migração',
  'Seus dados são seus — exportáveis a qualquer momento',
]

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const produto = searchParams.get('produto') ?? 'simula-custo'
  const plano = searchParams.get('plano') ?? 'profissional'

  const nomeProduto = PRODUCT_NAMES[produto] ?? produto
  const nomePlano = PLAN_LABELS[plano] ?? plano
  const preco = PLAN_PRICES[plano] ?? '—'

  useEffect(() => {
    document.title = `Checkout — ${nomeProduto} ${nomePlano} | Gravity`
  }, [nomeProduto, nomePlano])

  return (
    <HelmetProvider>
      <Helmet>
        <title>{`Checkout — ${nomeProduto} ${nomePlano} | Gravity`}</title>
        <meta
          name="description"
          content={`Confirme seu pedido do ${nomeProduto} plano ${nomePlano} e comece agora.`}
        />
        <meta property="og:title" content={`Checkout — ${nomeProduto} ${nomePlano} | Gravity`} />
        <meta
          property="og:description"
          content={`Confirme seu pedido do ${nomeProduto} plano ${nomePlano} e comece agora.`}
        />
      </Helmet>

      <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        {/* NAV */}
        <nav style={navStyle}>
          <Link to="/" style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-accent)', textDecoration: 'none' }}>
            Gravity
          </Link>
          <span style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-muted)' }}>
            Checkout seguro
          </span>
        </nav>

        {/* CONTEÚDO */}
        <section style={contentStyle}>
          <div style={cardStyle}>
            <span className="text-micro" style={{ display: 'block', marginBottom: '1.5rem' }}>
              Resumo do pedido
            </span>

            {/* PRODUTO + PLANO */}
            <div style={summaryBoxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 700, marginBottom: '0.25rem' }}>
                    {nomeProduto}
                  </h2>
                  <span
                    style={{
                      background: 'rgba(56,189,248,0.1)',
                      color: 'var(--color-accent)',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-pill)',
                    }}
                  >
                    Plano {nomePlano}
                  </span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{preco}</span>
              </div>
            </div>

            {/* BULLETS DE SEGURANÇA */}
            <div style={{ marginBottom: '2rem' }}>
              <span className="text-micro" style={{ display: 'block', marginBottom: '0.75rem' }}>
                Por que confiar no Gravity
              </span>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {SECURITY_BULLETS.map((item) => (
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
                    <span style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }}>
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <a
              href={buildConfiguradorUrl({ produto, plano })}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Confirmar e ir para Setup →
            </a>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '1.5rem',
                marginTop: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <Link
                to="/precos"
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  textDecoration: 'none',
                }}
              >
                ← Voltar aos planos
              </Link>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                Pagamento processado pelo Stripe
              </span>
            </div>
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

const summaryBoxStyle: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '1.25rem',
  marginBottom: '2rem',
}

import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
  lazy,
} from 'react'
import type { IGravityWidget } from './registry.js'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DashboardPanel = 'global-admin' | 'tenant-home' | 'product'

interface DashboardStats {
  pendingTasks: number
  unreadEmails: number
  unreadNotifications: number
  activeTimers: number
}

interface WidgetLayout {
  widgetId: string
  position: number
  config: Record<string, unknown>
}

interface DashboardProps {
  tenantId: string
  userId: string
  panel: DashboardPanel
  productId?: string
  userPermissions: string[]
  authToken: string
}

// ---------------------------------------------------------------------------
// Estados de widget — Loading e Forbidden
// ---------------------------------------------------------------------------

function WidgetLoadingState({ title }: { title: string }) {
  return (
    <div className="widget-card widget-card--loading" aria-busy="true" aria-label={`Carregando ${title}`}>
      <div className="widget-card__header">
        <span className="widget-card__title">{title}</span>
      </div>
      <div className="widget-card__skeleton" />
    </div>
  )
}

function WidgetForbiddenState({ title }: { title: string }) {
  return (
    <div className="widget-card widget-card--forbidden" aria-label={`Sem acesso a ${title}`}>
      <div className="widget-card__header">
        <span className="widget-card__title">{title}</span>
      </div>
      <p className="widget-card__message">
        Você não tem permissão para visualizar este widget.
      </p>
    </div>
  )
}

function WidgetErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="widget-card widget-card--error">
      <div className="widget-card__header">
        <span className="widget-card__title">{title}</span>
      </div>
      <p className="widget-card__message">Erro ao carregar dados.</p>
      <button className="widget-card__retry-btn" onClick={onRetry} type="button">
        Tentar novamente
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget genérico — rende o componente certo via dynamic import
// ---------------------------------------------------------------------------

interface WidgetCardProps {
  widget: IGravityWidget
  layout: WidgetLayout
  userPermissions: string[]
  authToken: string
  liveStats: DashboardStats | null
}

function WidgetCard({ widget, layout, userPermissions, authToken, liveStats }: WidgetCardProps) {
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Verifica permissões antes de buscar dados
  const hasPermission = widget.permissions.every((p) => userPermissions.includes(p))

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(widget.dataSource, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: unknown = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [widget.dataSource, authToken])

  // Polling a cada 60s para gráficos pesados
  useEffect(() => {
    if (!hasPermission) return

    void fetchData()
    const interval = setInterval(() => void fetchData(), 60_000)
    return () => clearInterval(interval)
  }, [hasPermission, fetchData])

  if (!hasPermission) {
    return <WidgetForbiddenState title={widget.title} />
  }

  if (loading) {
    return <WidgetLoadingState title={widget.title} />
  }

  if (error) {
    return <WidgetErrorState title={widget.title} onRetry={() => void fetchData()} />
  }

  return (
    <div
      className={`widget-card widget-card--${widget.size}`}
      data-widget-id={widget.id}
      data-position={layout.position}
    >
      <div className="widget-card__header">
        <span className="widget-card__title">{widget.title}</span>
      </div>
      <div className="widget-card__body">
        {/* Contador crítico via SSE tem prioridade sobre dados polled */}
        <WidgetContent widget={widget} data={data} liveStats={liveStats} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Renderizador de conteúdo — expande para componentes específicos conforme
// o widget.component registrado no Registry
// ---------------------------------------------------------------------------

interface WidgetContentProps {
  widget: IGravityWidget
  data: unknown
  liveStats: DashboardStats | null
}

function WidgetContent({ widget, data, liveStats }: WidgetContentProps) {
  switch (widget.component) {
    case 'PendingTasksWidget':
      return (
        <div className="stat-counter">
          <span className="stat-counter__value">
            {liveStats?.pendingTasks ?? '—'}
          </span>
          <span className="stat-counter__label">tarefas pendentes</span>
        </div>
      )

    case 'NotificationsWidget':
      return (
        <div className="stat-counter">
          <span className="stat-counter__value">
            {liveStats?.unreadNotifications ?? '—'}
          </span>
          <span className="stat-counter__label">notificações não lidas</span>
        </div>
      )

    case 'SalesFunnelWidget':
      return <SalesFunnelContent data={data} />

    case 'OnboardingWidget':
      return <OnboardingContent data={data} />

    default:
      // Widget de produto ou componente customizado — renderiza JSON como fallback
      return (
        <pre className="widget-card__raw-data">
          {JSON.stringify(data, null, 2)}
        </pre>
      )
  }
}

// ---------------------------------------------------------------------------
// Funil de Vendas — widget padrão
// ---------------------------------------------------------------------------

interface FunnelData {
  leadIn: number
  qualification: number
  proposal: number
  closing: number
}

function isFunnelData(value: unknown): value is FunnelData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['leadIn'] === 'number' &&
    typeof v['qualification'] === 'number' &&
    typeof v['proposal'] === 'number' &&
    typeof v['closing'] === 'number'
  )
}

function SalesFunnelContent({ data }: { data: unknown }) {
  if (!isFunnelData(data)) {
    return <p className="widget-card__message">Dados do funil indisponíveis.</p>
  }

  const stages = [
    { label: 'Lead In', value: data.leadIn },
    { label: 'Qualificação', value: data.qualification },
    { label: 'Proposta', value: data.proposal },
    { label: 'Fechamento', value: data.closing },
  ]

  return (
    <ol className="funnel-list">
      {stages.map((stage) => (
        <li key={stage.label} className="funnel-list__item">
          <span className="funnel-list__label">{stage.label}</span>
          <span className="funnel-list__value">{stage.value}</span>
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Onboarding — widget padrão
// ---------------------------------------------------------------------------

interface OnboardingData {
  docsSubmitted: boolean
  firstLogin: boolean
  integrationsSetup: boolean
}

function isOnboardingData(value: unknown): value is OnboardingData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['docsSubmitted'] === 'boolean' &&
    typeof v['firstLogin'] === 'boolean' &&
    typeof v['integrationsSetup'] === 'boolean'
  )
}

function OnboardingContent({ data }: { data: unknown }) {
  if (!isOnboardingData(data)) {
    return <p className="widget-card__message">Dados de onboarding indisponíveis.</p>
  }

  const steps = [
    { label: 'Documentação enviada', done: data.docsSubmitted },
    { label: 'Primeiro acesso', done: data.firstLogin },
    { label: 'Integrações configuradas', done: data.integrationsSetup },
  ]

  const completed = steps.filter((s) => s.done).length

  return (
    <div className="onboarding">
      <p className="onboarding__progress">
        {completed}/{steps.length} etapas concluídas
      </p>
      <ul className="onboarding__list">
        {steps.map((step) => (
          <li
            key={step.label}
            className={`onboarding__step ${step.done ? 'onboarding__step--done' : ''}`}
          >
            {step.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel: Global Admin
// ---------------------------------------------------------------------------

function GlobalAdminPanel({
  liveStats,
}: {
  liveStats: DashboardStats | null
}) {
  return (
    <section className="dashboard-panel dashboard-panel--global-admin">
      <h2 className="dashboard-panel__title">Administração Global</h2>
      <div className="dashboard-panel__grid">
        <div className="stat-card">
          <span className="stat-card__label">Notificações do sistema</span>
          <span className="stat-card__value">
            {liveStats?.unreadNotifications ?? '—'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Timers ativos</span>
          <span className="stat-card__value">
            {liveStats?.activeTimers ?? '—'}
          </span>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Painel: Tenant Home
// ---------------------------------------------------------------------------

interface TenantHomePanelProps {
  widgets: IGravityWidget[]
  layouts: WidgetLayout[]
  userPermissions: string[]
  authToken: string
  liveStats: DashboardStats | null
}

function TenantHomePanel({
  widgets,
  layouts,
  userPermissions,
  authToken,
  liveStats,
}: TenantHomePanelProps) {
  const sorted = [...widgets].sort((a, b) => {
    const posA = layouts.find((l) => l.widgetId === a.id)?.position ?? 999
    const posB = layouts.find((l) => l.widgetId === b.id)?.position ?? 999
    return posA - posB
  })

  return (
    <section className="dashboard-panel dashboard-panel--tenant-home">
      <h2 className="dashboard-panel__title">Visão Geral</h2>
      <div className="dashboard-panel__grid">
        {sorted.map((widget) => {
          const layout = layouts.find((l) => l.widgetId === widget.id) ?? {
            widgetId: widget.id,
            position: 999,
            config: {},
          }
          return (
            <WidgetCard
              key={widget.id}
              widget={widget}
              layout={layout}
              userPermissions={userPermissions}
              authToken={authToken}
              liveStats={liveStats}
            />
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Painel: Produto Específico
// ---------------------------------------------------------------------------

interface ProductPanelProps {
  productId: string
  widgets: IGravityWidget[]
  layouts: WidgetLayout[]
  userPermissions: string[]
  authToken: string
  liveStats: DashboardStats | null
}

function ProductPanel({
  productId,
  widgets,
  layouts,
  userPermissions,
  authToken,
  liveStats,
}: ProductPanelProps) {
  const productWidgets = widgets.filter(
    (w) => w.productId === productId || w.productId === undefined
  )

  return (
    <section className="dashboard-panel dashboard-panel--product">
      <h2 className="dashboard-panel__title">Dashboard do Produto</h2>
      <div className="dashboard-panel__grid">
        {productWidgets.map((widget) => {
          const layout = layouts.find((l) => l.widgetId === widget.id) ?? {
            widgetId: widget.id,
            position: 999,
            config: {},
          }
          return (
            <WidgetCard
              key={widget.id}
              widget={widget}
              layout={layout}
              userPermissions={userPermissions}
              authToken={authToken}
              liveStats={liveStats}
            />
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Hook — SSE para contadores críticos em tempo real
// ---------------------------------------------------------------------------

function useLiveStats(
  authToken: string,
  tenantId: string
): DashboardStats | null {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    // SSE — mantém conexão aberta para atualizações em tempo real
    const url = `/api/v1/dashboard/stream?tenant_id=${encodeURIComponent(tenantId)}`
    const source = new EventSource(url)

    source.addEventListener('stats', (event: MessageEvent) => {
      try {
        const parsed: unknown = JSON.parse(event.data as string)
        if (isDashboardStats(parsed)) {
          setStats(parsed)
        }
      } catch {
        // Ignora frames malformados sem expor erro ao usuário
      }
    })

    source.onerror = () => {
      // EventSource reconecta automaticamente — apenas loga o evento
      console.error('[dashboard/stream] SSE connection error, reconnecting...')
    }

    return () => {
      source.close()
    }
  }, [authToken, tenantId])

  return stats
}

function isDashboardStats(value: unknown): value is DashboardStats {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['pendingTasks'] === 'number' &&
    typeof v['unreadEmails'] === 'number' &&
    typeof v['unreadNotifications'] === 'number' &&
    typeof v['activeTimers'] === 'number'
  )
}

// ---------------------------------------------------------------------------
// Hook — layouts persistidos do tenant
// ---------------------------------------------------------------------------

function useWidgetLayouts(
  tenantId: string,
  authToken: string
): { layouts: WidgetLayout[]; loading: boolean } {
  const [layouts, setLayouts] = useState<WidgetLayout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/v1/dashboard', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: unknown = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setLayouts(data as WidgetLayout[])
        }
      } catch {
        // Silencia erro — layouts padrão são usados
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [tenantId, authToken])

  return { layouts, loading }
}

// ---------------------------------------------------------------------------
// Hook — widgets disponíveis para o tenant
// ---------------------------------------------------------------------------

function useAvailableWidgets(
  authToken: string,
  productId?: string
): { widgets: IGravityWidget[]; loading: boolean } {
  const [widgets, setWidgets] = useState<IGravityWidget[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const url = productId
          ? `/api/v1/dashboard/widgets?product_id=${encodeURIComponent(productId)}`
          : '/api/v1/dashboard/widgets'
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: unknown = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setWidgets(data as IGravityWidget[])
        }
      } catch {
        // Silencia erro — sem widgets disponíveis
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [authToken, productId])

  return { widgets, loading }
}

// ---------------------------------------------------------------------------
// Dashboard — componente raiz
// ---------------------------------------------------------------------------

export function Dashboard({
  tenantId,
  userId,
  panel,
  productId,
  userPermissions,
  authToken,
}: DashboardProps) {
  const liveStats = useLiveStats(authToken, tenantId)
  const { layouts, loading: layoutsLoading } = useWidgetLayouts(tenantId, authToken)
  const { widgets, loading: widgetsLoading } = useAvailableWidgets(
    authToken,
    productId
  )

  const isLoading = layoutsLoading || widgetsLoading

  if (isLoading) {
    return (
      <div className="dashboard dashboard--loading" aria-busy="true">
        <p>Carregando dashboard...</p>
      </div>
    )
  }

  return (
    <div className="dashboard" data-panel={panel} data-user-id={userId}>
      {panel === 'global-admin' && (
        <GlobalAdminPanel liveStats={liveStats} />
      )}

      {panel === 'tenant-home' && (
        <TenantHomePanel
          widgets={widgets}
          layouts={layouts}
          userPermissions={userPermissions}
          authToken={authToken}
          liveStats={liveStats}
        />
      )}

      {panel === 'product' && productId !== undefined && (
        <ProductPanel
          productId={productId}
          widgets={widgets}
          layouts={layouts}
          userPermissions={userPermissions}
          authToken={authToken}
          liveStats={liveStats}
        />
      )}
    </div>
  )
}

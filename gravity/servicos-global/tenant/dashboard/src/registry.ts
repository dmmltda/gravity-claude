// Widget Registry central do Dashboard
// Produtos registram widgets aqui via POST /api/v1/dashboard/widgets/register
// ou diretamente via registerWidget() em contexto de servidor

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full'

export interface IGravityWidget {
  id: string
  title: string
  component: string    // Nome do componente no Design System
  dataSource: string   // Endpoint da API que fornece os dados
  permissions: string[]
  size: WidgetSize
  productId?: string   // undefined = widget global de tenant
}

const widgets = new Map<string, IGravityWidget>()

function validateWidget(widget: IGravityWidget): void {
  if (!widget.id || widget.id.trim().length === 0) {
    throw new Error('Widget deve ter um id não vazio')
  }
  if (!widget.title || widget.title.trim().length === 0) {
    throw new Error('Widget deve ter um title não vazio')
  }
  if (!widget.component || widget.component.trim().length === 0) {
    throw new Error('Widget deve ter um component não vazio')
  }
  if (!widget.dataSource || widget.dataSource.trim().length === 0) {
    throw new Error('Widget deve ter um dataSource não vazio')
  }
  const validSizes: WidgetSize[] = ['sm', 'md', 'lg', 'full']
  if (!validSizes.includes(widget.size)) {
    throw new Error(`Widget.size deve ser um de: ${validSizes.join(', ')}`)
  }
  if (!Array.isArray(widget.permissions)) {
    throw new Error('Widget.permissions deve ser um array')
  }
}

export function registerWidget(widget: IGravityWidget): void {
  validateWidget(widget)
  widgets.set(widget.id, widget)
}

export function getWidget(id: string): IGravityWidget | undefined {
  return widgets.get(id)
}

export function listWidgets(): IGravityWidget[] {
  return Array.from(widgets.values())
}

export function listWidgetsForProduct(productId: string): IGravityWidget[] {
  return Array.from(widgets.values()).filter(
    (w) => w.productId === productId || w.productId === undefined
  )
}

export function hasWidget(id: string): boolean {
  return widgets.has(id)
}

// Widgets padrão do tenant — registrados na inicialização do serviço
registerWidget({
  id: 'tenant-pending-tasks',
  title: 'Tarefas Pendentes',
  component: 'PendingTasksWidget',
  dataSource: '/api/v1/dashboard/stats',
  permissions: ['dashboard.view'],
  size: 'sm',
})

registerWidget({
  id: 'tenant-credit-usage',
  title: 'Uso de Créditos',
  component: 'CreditUsageWidget',
  dataSource: '/api/v1/dashboard/stats',
  permissions: ['dashboard.view', 'billing.view'],
  size: 'sm',
})

registerWidget({
  id: 'tenant-notifications',
  title: 'Notificações',
  component: 'NotificationsWidget',
  dataSource: '/api/v1/dashboard/stats',
  permissions: ['dashboard.view'],
  size: 'md',
})

registerWidget({
  id: 'tenant-sales-funnel',
  title: 'Funil de Vendas',
  component: 'SalesFunnelWidget',
  dataSource: '/api/v1/dashboard/stats',
  permissions: ['dashboard.view', 'sales.view'],
  size: 'lg',
})

registerWidget({
  id: 'tenant-onboarding',
  title: 'Onboarding de Clientes',
  component: 'OnboardingWidget',
  dataSource: '/api/v1/dashboard/stats',
  permissions: ['dashboard.view'],
  size: 'md',
})

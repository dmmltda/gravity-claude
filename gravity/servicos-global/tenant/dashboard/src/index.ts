// Entry point público do serviço de dashboard
// Exporta tudo que outros módulos podem consumir via @tenant/dashboard

export { Dashboard } from './Dashboard.js'
export {
  registerWidget,
  getWidget,
  listWidgets,
  listWidgetsForProduct,
  hasWidget,
} from './registry.js'
export type { IGravityWidget, WidgetSize } from './registry.js'

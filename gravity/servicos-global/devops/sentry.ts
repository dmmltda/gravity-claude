/**
 * sentry.ts — Inicialização do Sentry para serviços Node.js do Gravity
 *
 * Uso em cada serviço:
 *   import { initSentry } from '../../devops/sentry.js'
 *   initSentry('nome-do-servico')
 *
 * Chame ANTES de qualquer outro import para capturar erros de inicialização.
 */
import * as Sentry from '@sentry/node'

export function initSentry(serviceName: string): void {
  const dsn = process.env['SENTRY_DSN']
  if (!dsn) {
    console.warn(`[sentry] SENTRY_DSN não configurado para ${serviceName} — monitoramento desativado`)
    return
  }

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release:     `${serviceName}@${process.env['npm_package_version'] ?? '0.0.0'}`,
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    serverName: serviceName,
  })

  console.info(`[sentry] Inicializado para ${serviceName} (env: ${process.env['NODE_ENV']})`)
}

/**
 * Middleware Express para captura de erros pelo Sentry.
 * Deve ser registrado DEPOIS de todas as rotas e ANTES do error handler global.
 */
export function sentryErrorHandler(): ReturnType<typeof Sentry.expressErrorHandler> {
  return Sentry.expressErrorHandler()
}

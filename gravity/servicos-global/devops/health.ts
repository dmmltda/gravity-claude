/**
 * health.ts — Rota de health check padrão Gravity
 *
 * Uso:
 *   import { healthRouter } from '../../devops/health.js'
 *   app.use(healthRouter)
 *
 * Responde em GET /health — usado pelo Railway e UptimeRobot.
 */
import { Router } from 'express'

interface HealthDeps {
  /** Função assíncrona que testa a conexão com o banco */
  checkDb?: () => Promise<void>
  /** Nome do serviço (exibido na resposta) */
  service: string
}

export function createHealthRouter({ service, checkDb }: HealthDeps): Router {
  const router = Router()

  router.get('/health', async (_req, res) => {
    const start = Date.now()

    try {
      if (checkDb) await checkDb()

      res.json({
        status:   'ok',
        service,
        env:      process.env['NODE_ENV'] ?? 'development',
        uptime:   Math.floor(process.uptime()),
        latency:  Date.now() - start,
      })
    } catch (err) {
      res.status(503).json({
        status:  'degraded',
        service,
        error:   err instanceof Error ? err.message : 'db_unreachable',
        latency: Date.now() - start,
      })
    }
  })

  return router
}

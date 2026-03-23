import express from 'express'
import { notificacoesRouter } from './routes.js'
import { errorHandler } from '../../../../../servicos-global/tenant/middleware/error-handler.js'
import { startQueue } from './job-queue.js'
import { startCron } from './cron.js'
import { prisma } from './prisma.js'

const app = express()

// 1. Parse de body
app.use(express.json())

// 2. Health check — sem autenticação, sempre disponível
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'notificacoes' })
  } catch {
    res.status(503).json({ status: 'down', service: 'notificacoes' })
  }
})

// 3. Rotas de negócio
app.use('/api/v1/notificacoes', notificacoesRouter)

// 4. Error handler — sempre o último
app.use(errorHandler)

const PORT = parseInt(process.env.PORT ?? '3007', 10)

async function bootstrap(): Promise<void> {
  await startQueue()
  startCron()

  app.listen(PORT, () => {
    console.info(`[notificacoes] Servidor rodando na porta ${PORT}`)
  })
}

bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[notificacoes] Falha ao iniciar:', msg)
  process.exit(1)
})

export { app }

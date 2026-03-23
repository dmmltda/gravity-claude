import express from 'express'
import { emailRouter } from './routes.js'
import { errorHandler } from '../../../../../servicos-global/tenant/middleware/error-handler.js'
import { prisma } from './prisma.js'

const app = express()

// 1. Parse de body — raw para validação de assinatura de webhook
app.use('/api/v1/email/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

// 2. Health check — sem autenticação, disponível sempre
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'email' })
  } catch {
    res.status(503).json({ status: 'down', service: 'email' })
  }
})

// 3. Rotas de negócio
app.use('/api/v1/email', emailRouter)

// 4. Error handler — sempre o último
app.use(errorHandler)

const PORT = parseInt(process.env.PORT ?? '3004', 10)
app.listen(PORT, () => {
  console.info(`[email] Servidor rodando na porta ${PORT}`)
})

export { app }

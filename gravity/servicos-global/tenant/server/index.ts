import * as Sentry from '@sentry/node'
import express from 'express'
import { PrismaClient } from '@prisma/client'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
})

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

// Health check — sem autenticação
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      service: 'tenant-services',
      timestamp: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({
      status: 'down',
      service: 'tenant-services',
      timestamp: new Date().toISOString(),
    })
  }
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`Tenant services rodando na porta ${PORT}`)
})

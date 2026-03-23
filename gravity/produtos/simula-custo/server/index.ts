import express from 'express'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { requireInternalKey } from './middleware/require-internal-key.js'
import { requireAuth } from './middleware/require-auth.js'
import { errorHandler } from './middleware/error-handler.js'
import { estimativasRouter } from './routes/estimativas.js'
import { ncmRouter } from './routes/ncm.js'
import { cambioRouter } from './routes/cambio.js'

if (!process.env['INTERNAL_SERVICE_KEY']) {
  throw new Error('INTERNAL_SERVICE_KEY não definida')
}

const prisma = new PrismaClient()
const app = express()

// ─── 1. Parse body ────────────────────────────────────────────────────────────
app.use(express.json())

// ─── 2. Correlation ID ────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  const correlationId = (_req.headers['x-correlation-id'] as string | undefined) ?? randomUUID()
  res.locals['correlationId'] = correlationId
  res.setHeader('x-correlation-id', correlationId)
  next()
})

// ─── 3. Health check — sem autenticação ──────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'simula-custo' })
  } catch {
    res.status(503).json({ status: 'down' })
  }
})

// ─── 4. Rotas protegidas — requer internal key + auth de usuário ──────────────
app.use('/api/v1/estimativas', requireInternalKey, requireAuth, estimativasRouter)
app.use('/api/v1/ncm', requireInternalKey, ncmRouter)
app.use('/api/v1/cambio', requireInternalKey, cambioRouter)

// ─── 5. Error handler — sempre o último ──────────────────────────────────────
app.use(errorHandler)

const PORT = process.env['PORT'] ?? 3002
app.listen(PORT, () => {
  console.log(`SimulaCusto rodando na porta ${PORT}`)
})

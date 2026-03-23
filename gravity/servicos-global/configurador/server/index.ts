import express from 'express'
import { randomUUID } from 'crypto'
import { prisma } from './prisma/client.js'
import { authRoutes } from './routes/auth.js'
import { tenantsRoutes } from './routes/tenants.js'
import { companiesRoutes } from './routes/companies.js'
import { usersRoutes } from './routes/users.js'
import { plansRoutes } from './routes/plans.js'
import { billingRoutes } from './routes/billing.js'
import { accessRoutes } from './routes/access.js'
import { checkAccessRoutes } from './routes/check-access.js'
import { serviceTokenRoutes } from './routes/service-token.js'
import { requireInternalKey } from './middleware/require-internal-key.js'
import { errorHandler } from './middleware/error-handler.js'

if (!process.env.INTERNAL_SERVICE_KEY) {
  throw new Error('INTERNAL_SERVICE_KEY não definida')
}

const app = express()

// 1a. Raw body para verificação de assinatura Svix — deve vir ANTES do express.json()
app.use('/api/v1/auth/webhook', express.raw({ type: 'application/json' }))

// 1b. Parse body
app.use(express.json())

// 2. Correlation ID — lê o header de entrada ou gera um novo
app.use((req, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID()
  res.locals.correlationId = correlationId
  res.setHeader('x-correlation-id', correlationId)
  next()
})

// 3. Health check — sem autenticação
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'configurador' })
  } catch {
    res.status(503).json({ status: 'down' })
  }
})

// 4. Rotas públicas (Clerk Auth)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/tenants', tenantsRoutes)
app.use('/api/v1/companies', companiesRoutes)
app.use('/api/v1/users', usersRoutes)
app.use('/api/v1/plans', plansRoutes)
app.use('/api/v1/billing', billingRoutes)

// 5a. Rota de check-access (verifica x-internal-key inline)
app.use('/api/check-access', checkAccessRoutes)

// 5b. Rotas internas (x-internal-key via middleware)
// service-token montado antes para não cair no accessRoutes
app.use('/api/internal/service-token', requireInternalKey, serviceTokenRoutes)
app.use('/api/internal', requireInternalKey, accessRoutes)

// 6. Error handler — SEMPRE o último
app.use(errorHandler)

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  console.log(`Configurador rodando na porta ${PORT}`)
})

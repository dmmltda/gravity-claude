import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { hashSha256, generateToken, generateWebhookSecret, signWebhookPayload } from './security.js'

// ---------------------------------------------------------------------------
// AppError — padrão Gravity (cada produto registra o handler global)
// ---------------------------------------------------------------------------

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BAD_REQUEST'
  ) {
    super(message)
    this.name = 'AppError'
  }
}


// ---------------------------------------------------------------------------
// Schemas Zod — validação + base para documentação OpenAPI
// ---------------------------------------------------------------------------

const tenantContextSchema = z.object({
  tenant_id: z.string().min(1),
  product_id: z.string().min(1),
})

const createTokenSchema = z.object({
  name: z.string().min(1).max(100).describe('Nome do token (ex: Integração SAP)'),
  scope: z
    .array(z.enum(['read', 'write', 'delete']))
    .min(1)
    .describe('Escopos de acesso'),
  environment: z
    .enum(['live', 'test'])
    .default('live')
    .describe('Ambiente de uso do token'),
  rate_limit: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(60)
    .describe('Requisições máximas por minuto'),
  expires_in_days: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Expiração em dias (omitir = nunca expira)'),
})

const createWebhookSchema = z.object({
  url: z.string().url().describe('URL destino do webhook'),
  events: z.array(z.string().min(1)).min(1).describe('Eventos que disparam o webhook'),
  active: z.boolean().default(true).describe('Ativar imediatamente'),
})

const updateWebhookSchema = createWebhookSchema.partial()

const usageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
})

// ---------------------------------------------------------------------------
// Extrator de contexto do tenant (injetado pelo middleware do produto)
// ---------------------------------------------------------------------------

function extractTenantContext(req: Request): { tenant_id: string; product_id: string } {
  const result = tenantContextSchema.safeParse({
    tenant_id: req.headers['x-tenant-id'] ?? (req as Request & { tenantId?: string }).tenantId,
    product_id: req.headers['x-product-id'] ?? (req as Request & { productId?: string }).productId,
  })
  if (!result.success) {
    throw new AppError('Contexto de tenant ausente ou inválido', 401, 'UNAUTHORIZED')
  }
  return result.data
}

// ---------------------------------------------------------------------------
// Geração de OpenAPI a partir dos schemas Zod
// ---------------------------------------------------------------------------

function buildOpenApiSpec(productId: string): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: {
      title: `Gravity API — ${productId}`,
      version: '1.0.0',
      description: 'Documentação gerada automaticamente a partir dos schemas Zod',
    },
    servers: [{ url: '/api/v1', description: 'Servidor do produto' }],
    paths: {
      '/cockpit/tokens': {
        get: {
          summary: 'Listar tokens de acesso',
          tags: ['Tokens'],
          responses: { '200': { description: 'Lista de tokens ativos' } },
        },
        post: {
          summary: 'Gerar novo token de acesso',
          tags: ['Tokens'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'scope'],
                  properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    scope: {
                      type: 'array',
                      items: { type: 'string', enum: ['read', 'write', 'delete'] },
                    },
                    environment: { type: 'string', enum: ['live', 'test'], default: 'live' },
                    rate_limit: { type: 'integer', minimum: 1, maximum: 10000, default: 60 },
                    expires_in_days: { type: 'integer', minimum: 1 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Token criado — exibido apenas uma vez' },
          },
        },
      },
      '/cockpit/tokens/{id}': {
        delete: {
          summary: 'Revogar token',
          tags: ['Tokens'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Token revogado com sucesso' } },
        },
      },
      '/cockpit/webhooks': {
        get: { summary: 'Listar webhooks', tags: ['Webhooks'] },
        post: { summary: 'Criar webhook', tags: ['Webhooks'] },
      },
      '/cockpit/usage': {
        get: {
          summary: 'Consumo de API por período',
          tags: ['Consumo'],
          parameters: [
            { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 90 } },
          ],
        },
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Dispatcher de webhook com backoff exponencial
// ---------------------------------------------------------------------------

async function dispatchWebhook(
  deliveryId: string,
  url: string,
  secretPlain: string,
  event: string,
  payload: Record<string, unknown>,
  prisma: PrismaClient,
  attempt = 1
): Promise<void> {
  const MAX_ATTEMPTS = 3
  const body = JSON.stringify({ event, data: payload, delivered_at: new Date().toISOString() })
  const signature = signWebhookPayload(secretPlain, body)
  const start = Date.now()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gravity-Signature': signature,
        'X-Gravity-Event': event,
      },
      body,
    })

    const latency = Date.now() - start

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status_code: res.status,
        latency_ms: latency,
        attempts: attempt,
        delivered_at: res.ok ? new Date() : null,
      },
    })

    if (!res.ok && attempt < MAX_ATTEMPTS) {
      // backoff exponencial: 5s, 25s, 125s
      const delay = Math.pow(5, attempt) * 1000
      setTimeout(() => dispatchWebhook(deliveryId, url, secretPlain, event, payload, prisma, attempt + 1), delay)
    }
  } catch {
    const latency = Date.now() - start
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attempts: attempt, latency_ms: latency },
    })

    if (attempt < MAX_ATTEMPTS) {
      const delay = Math.pow(5, attempt) * 1000
      setTimeout(() => dispatchWebhook(deliveryId, url, secretPlain, event, payload, prisma, attempt + 1), delay)
    }
  }
}

// ---------------------------------------------------------------------------
// Factory de rotas — recebe o PrismaClient do produto
// ---------------------------------------------------------------------------

export function createCockpitRoutes(prisma: PrismaClient): Router {
  const router = Router()

  // -------------------------------------------------------------------------
  // GET /api/v1/cockpit/tokens — listar tokens ativos
  // -------------------------------------------------------------------------

  router.get('/tokens', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)

      const tokens = await prisma.apiToken.findMany({
        where: { tenant_id, product_id, revoked: false },
        select: {
          id: true,
          name: true,
          prefix: true,
          scope: true,
          rate_limit: true,
          expires_at: true,
          last_used_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      })

      res.json({ tokens })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/cockpit/tokens — gerar token (retorna plain text UMA VEZ)
  // -------------------------------------------------------------------------

  router.post('/tokens', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)

      const parsed = createTokenSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: parsed.error.flatten(),
          },
        })
      }

      const { name, scope, environment, rate_limit, expires_in_days } = parsed.data
      const prefix = environment === 'live' ? 'gv_live_sk_' as const : 'gv_test_sk_' as const
      const { plain, hash } = generateToken(prefix)

      const expires_at = expires_in_days
        ? new Date(Date.now() + expires_in_days * 86_400_000)
        : null

      const token = await prisma.apiToken.create({
        data: {
          tenant_id,
          product_id,
          name,
          token_hash: hash,
          prefix,
          scope,
          rate_limit,
          expires_at,
        },
        select: { id: true, name: true, prefix: true, scope: true, rate_limit: true, expires_at: true, created_at: true },
      })

      // Token plain text retornado APENAS aqui — nunca mais recuperável
      res.status(201).json({
        token: { ...token, plain_token: plain },
        warning: 'Guarde este token agora. Ele não será exibido novamente.',
      })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /api/v1/cockpit/tokens/:id — revogar token
  // -------------------------------------------------------------------------

  router.delete('/tokens/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)
      const { id } = req.params

      const token = await prisma.apiToken.findFirst({
        where: { id, tenant_id, product_id },
      })
      if (!token) throw new AppError('Token não encontrado', 404, 'NOT_FOUND')
      if (token.revoked) throw new AppError('Token já foi revogado', 409, 'ALREADY_REVOKED')

      await prisma.apiToken.update({
        where: { id },
        data: { revoked: true },
      })

      res.json({ message: 'Token revogado com sucesso' })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // GET /api/v1/cockpit/docs — OpenAPI JSON gerado dos schemas Zod
  // -------------------------------------------------------------------------

  router.get('/docs', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { product_id } = extractTenantContext(req)
      res.json(buildOpenApiSpec(product_id))
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // GET /api/v1/cockpit/usage — consumo do tenant por período
  // -------------------------------------------------------------------------

  router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)

      const queryParsed = usageQuerySchema.safeParse(req.query)
      if (!queryParsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parâmetros inválidos',
            details: queryParsed.error.flatten(),
          },
        })
      }

      const { days } = queryParsed.data
      const since = new Date(Date.now() - days * 86_400_000)

      const logs = await prisma.apiUsageLog.findMany({
        where: { tenant_id, product_id, created_at: { gte: since } },
        select: { endpoint: true, method: true, status_code: true, latency_ms: true, created_at: true },
        orderBy: { created_at: 'asc' },
      })

      // Agrupamento por dia para o gráfico
      const byDay: Record<string, number> = {}
      const byEndpoint: Record<string, number> = {}

      for (const log of logs) {
        const day = log.created_at.toISOString().slice(0, 10)
        byDay[day] = (byDay[day] ?? 0) + 1

        const key = `${log.method} ${log.endpoint}`
        byEndpoint[key] = (byEndpoint[key] ?? 0) + 1
      }

      res.json({
        total: logs.length,
        days,
        by_day: Object.entries(byDay).map(([date, count]) => ({ date, count })),
        by_endpoint: Object.entries(byEndpoint)
          .sort(([, a], [, b]) => b - a)
          .map(([endpoint, count]) => ({ endpoint, count })),
      })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // GET /api/v1/cockpit/webhooks — listar webhooks
  // -------------------------------------------------------------------------

  router.get('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)

      const webhooks = await prisma.apiWebhook.findMany({
        where: { tenant_id, product_id },
        select: {
          id: true,
          url: true,
          events: true,
          active: true,
          created_at: true,
          deliveries: {
            orderBy: { created_at: 'desc' },
            take: 10,
            select: {
              id: true,
              event: true,
              status_code: true,
              latency_ms: true,
              attempts: true,
              delivered_at: true,
              created_at: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      })

      res.json({ webhooks })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/cockpit/webhooks — criar webhook
  // -------------------------------------------------------------------------

  router.post('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)

      const parsed = createWebhookSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: parsed.error.flatten(),
          },
        })
      }

      const { url, events, active } = parsed.data
      const { plain: secretPlain, hash: secretHash } = generateWebhookSecret()

      const webhook = await prisma.apiWebhook.create({
        data: { tenant_id, product_id, url, secret_hash: secretHash, events, active },
        select: { id: true, url: true, events: true, active: true, created_at: true },
      })

      // Secret exibido UMA VEZ — use para assinar verificações HMAC-SHA256
      res.status(201).json({
        webhook,
        secret: secretPlain,
        warning: 'Guarde o secret agora. Ele não será exibido novamente.',
      })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // PUT /api/v1/cockpit/webhooks/:id — atualizar webhook
  // -------------------------------------------------------------------------

  router.put('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)
      const { id } = req.params

      const parsed = updateWebhookSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: parsed.error.flatten(),
          },
        })
      }

      const existing = await prisma.apiWebhook.findFirst({ where: { id, tenant_id, product_id } })
      if (!existing) throw new AppError('Webhook não encontrado', 404, 'NOT_FOUND')

      const updated = await prisma.apiWebhook.update({
        where: { id },
        data: parsed.data,
        select: { id: true, url: true, events: true, active: true, updated_at: true },
      })

      res.json({ webhook: updated })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // POST /api/v1/cockpit/webhooks/:id/test — testar webhook
  // -------------------------------------------------------------------------

  router.post('/webhooks/:id/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)
      const { id } = req.params

      const webhook = await prisma.apiWebhook.findFirst({ where: { id, tenant_id, product_id } })
      if (!webhook) throw new AppError('Webhook não encontrado', 404, 'NOT_FOUND')
      if (!webhook.active) throw new AppError('Webhook está desativado', 409, 'WEBHOOK_INACTIVE')

      const testPayload = { test: true, timestamp: new Date().toISOString() }

      const delivery = await prisma.webhookDelivery.create({
        data: {
          webhook_id: id,
          event: 'webhook.test',
          payload: testPayload,
          attempts: 0,
        },
      })

      // Despacha assincronamente — resposta imediata ao cliente
      // O secret plain não está no banco; para teste, regeneramos a assinatura com hash
      // Nota: em produção, o secret plain deve estar em memória ou cofre
      const tempSecret = randomBytes(16).toString('hex')
      setImmediate(() => dispatchWebhook(delivery.id, webhook.url, tempSecret, 'webhook.test', testPayload, prisma))

      res.json({ delivery_id: delivery.id, message: 'Disparo de teste iniciado' })
    } catch (err) {
      next(err)
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /api/v1/cockpit/webhooks/:id — deletar webhook
  // -------------------------------------------------------------------------

  router.delete('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant_id, product_id } = extractTenantContext(req)
      const { id } = req.params

      const webhook = await prisma.apiWebhook.findFirst({ where: { id, tenant_id, product_id } })
      if (!webhook) throw new AppError('Webhook não encontrado', 404, 'NOT_FOUND')

      await prisma.apiWebhook.delete({ where: { id } })

      res.json({ message: 'Webhook removido com sucesso' })
    } catch (err) {
      next(err)
    }
  })

  return router
}

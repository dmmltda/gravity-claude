import { Router, type Request, type Response, type NextFunction } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AppError } from '../../errors/AppError.js'
import { withTenantIsolation } from '../../middleware/tenant-isolation.js'
import type { TenantRequest } from '../../middleware/types.js'
import {
  sendTextMessage,
  validateWebhookSignature,
  findOrCreateConversation,
} from './services/whatsapp.js'

// ─── Tipos SSE ────────────────────────────────────────────────────────────────

interface SseClient {
  tenantId: string
  res: Response
}

// SSE clients em memória — substituir por Redis pub/sub em escala
const sseClients: Set<SseClient> = new Set()

function emitToTenant(tenantId: string, event: Record<string, unknown>): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const client of sseClients) {
    if (client.tenantId === tenantId) {
      client.res.write(payload)
    }
  }
}

import {
  listConversationsSchema,
  sendMessageSchema,
  closeConversationSchema,
} from './schemas.js'

// ─── Router factory ───────────────────────────────────────────────────────────

export function buildWhatsAppRouter(prisma: PrismaClient): Router {
  const router = Router()
  router.use(withTenantIsolation)

  // GET /api/v1/whatsapp/conversations
  router.get(
    '/conversations',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantReq = req as TenantRequest
        const parsed = listConversationsSchema.safeParse(req.query)
        if (!parsed.success) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos')
        }

        const { status, temperatura, vinculado, page, limit } = parsed.data

        const where: Record<string, unknown> = { tenant_id: tenantReq.tenantId }
        if (status) where['status'] = status
        if (temperatura) where['gabi_temperatura'] = temperatura
        if (vinculado === 'true') {
          where['contact_id'] = { not: null }
        } else if (vinculado === 'false') {
          where['contact_id'] = null
        }

        const [conversations, total] = await Promise.all([
          prisma.whatsAppConversation.findMany({
            where,
            orderBy: { opened_at: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.whatsAppConversation.count({ where }),
        ])

        res.json({ conversations, total, page, limit })
      } catch (err) {
        next(err)
      }
    }
  )

  // GET /api/v1/whatsapp/conversations/:id
  router.get(
    '/conversations/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantReq = req as TenantRequest

        const conversation = await prisma.whatsAppConversation.findFirst({
          where: { id: req.params['id'], tenant_id: tenantReq.tenantId },
        })
        if (!conversation) {
          throw new AppError(404, 'NOT_FOUND', 'Conversa não encontrada')
        }

        const messages = await prisma.whatsAppMessage.findMany({
          where: {
            tenant_id: tenantReq.tenantId,
            conversation_id: conversation.id,
          },
          orderBy: { created_at: 'asc' },
        })

        res.json({ conversation, messages })
      } catch (err) {
        next(err)
      }
    }
  )

  // POST /api/v1/whatsapp/conversations/:id/send
  router.post(
    '/conversations/:id/send',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantReq = req as TenantRequest
        const parsed = sendMessageSchema.safeParse(req.body)
        if (!parsed.success) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
        }

        const conversation = await prisma.whatsAppConversation.findFirst({
          where: { id: req.params['id'], tenant_id: tenantReq.tenantId, status: 'open' },
        })
        if (!conversation) {
          throw new AppError(404, 'NOT_FOUND', 'Conversa não encontrada ou já encerrada')
        }

        const waMessageId = await sendTextMessage({
          tenantId: tenantReq.tenantId,
          phone: conversation.wa_phone_number,
          text: parsed.data.text,
          conversationId: conversation.id,
          sentBy: tenantReq.userId,
          prisma,
        })

        emitToTenant(tenantReq.tenantId, {
          type: 'message_sent',
          conversation_id: conversation.id,
          wa_message_id: waMessageId,
        })

        res.json({ ok: true, wa_message_id: waMessageId })
      } catch (err) {
        next(err)
      }
    }
  )

  // PUT /api/v1/whatsapp/conversations/:id/close
  router.put(
    '/conversations/:id/close',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantReq = req as TenantRequest
        const parsed = closeConversationSchema.safeParse(req.body)
        if (!parsed.success) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
        }

        const conversation = await prisma.whatsAppConversation.findFirst({
          where: { id: req.params['id'], tenant_id: tenantReq.tenantId, status: 'open' },
        })
        if (!conversation) {
          throw new AppError(404, 'NOT_FOUND', 'Conversa não encontrada ou já encerrada')
        }

        const { temperatura, temperatura_score, resumo, acoes_sugeridas } = parsed.data

        const updated = await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            status: 'closed',
            closed_at: new Date(),
            ...(temperatura ? { gabi_temperatura: temperatura } : {}),
            ...(temperatura_score !== undefined ? { gabi_temperatura_score: temperatura_score } : {}),
            ...(resumo ? { gabi_resumo: resumo } : {}),
            ...(acoes_sugeridas ? { gabi_acoes_sugeridas: acoes_sugeridas } : {}),
          },
        })

        emitToTenant(tenantReq.tenantId, {
          type: 'conversation_closed',
          conversation_id: conversation.id,
        })

        res.json({ ok: true, conversation: updated })
      } catch (err) {
        next(err)
      }
    }
  )

  // GET /api/v1/whatsapp/verify — verificação inicial Meta Webhook
  router.get(
    '/webhook',
    (req: Request, res: Response): void => {
      const mode = req.query['hub.mode']
      const token = req.query['hub.verify_token']
      const challenge = req.query['hub.challenge']

      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        res.status(200).send(challenge)
        return
      }

      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Token inválido' } })
    }
  )

  // POST /api/v1/whatsapp/webhook — inbound Meta API
  router.post(
    '/webhook',
    async (req: Request, res: Response): Promise<void> => {
      const signature = req.headers['x-hub-signature-256'] as string | undefined

      if (!signature) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Assinatura ausente' } })
        return
      }

      const rawBody = JSON.stringify(req.body)
      if (!validateWebhookSignature(rawBody, signature)) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Assinatura inválida' } })
        return
      }

      // 200 OK imediato — obrigatório Meta (< 5s)
      res.status(200).json({ ok: true })

      // Processamento assíncrono
      setImmediate(() => {
        void processInboundWebhook(req.body as MetaWebhookPayload, prisma)
      })
    }
  )

  // GET /api/v1/whatsapp/stream — SSE
  router.get(
    '/stream',
    (req: Request, res: Response): void => {
      const tenantReq = req as TenantRequest

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const client: SseClient = { tenantId: tenantReq.tenantId, res }
      sseClients.add(client)

      // Heartbeat a cada 30s
      const heartbeat = setInterval(() => {
        res.write(':ping\n\n')
      }, 30_000)

      req.on('close', () => {
        clearInterval(heartbeat)
        sseClients.delete(client)
      })
    }
  )

  return router
}

// ─── Processamento de webhook inbound ────────────────────────────────────────

interface MetaWebhookPayload {
  object: string
  entry?: MetaWebhookEntry[]
}

interface MetaWebhookEntry {
  changes?: MetaWebhookChange[]
}

interface MetaWebhookChange {
  value?: MetaWebhookValue
}

interface MetaWebhookValue {
  messaging_product: string
  metadata?: { phone_number_id: string }
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>
  messages?: MetaInboundMessage[]
}

interface MetaInboundMessage {
  id: string
  from: string
  type: string
  timestamp: string
  text?: { body: string }
}

async function processInboundWebhook(
  payload: MetaWebhookPayload,
  prisma: PrismaClient
): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') return

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value?.messages?.length) continue

      for (const message of value.messages) {
        await processInboundMessage(message, prisma)
      }
    }
  }
}

async function processInboundMessage(
  message: MetaInboundMessage,
  prisma: PrismaClient
): Promise<void> {
  // O tenant_id deve ser resolvido via WHATSAPP_PHONE_NUMBER_ID → tenant mapeado
  // Por ora, busca tenant pelo número de destino (configurado em app_settings)
  // TODO(daniel, 2026-03): implementar resolução de tenant via service registry
  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) {
    console.warn('[WHATSAPP] DEFAULT_TENANT_ID não configurado — impossível processar mensagem inbound')
    return
  }

  try {
    const conversation = await findOrCreateConversation(prisma, tenantId, message.from)

    const content = message.text?.body ?? `[${message.type}]`

    await prisma.whatsAppMessage.create({
      data: {
        tenant_id: tenantId,
        conversation_id: conversation.id,
        wa_message_id: message.id,
        direction: 'inbound',
        content_type: message.type === 'text' ? 'text' : message.type,
        content,
        origin: 'contact',
        status: 'received',
      },
    })

    emitToTenant(tenantId, {
      type: 'new_message',
      conversation_id: conversation.id,
      wa_message_id: message.id,
      direction: 'inbound',
      content,
    })
  } catch {
    console.error('[WHATSAPP] Erro ao processar mensagem inbound')
  }
}

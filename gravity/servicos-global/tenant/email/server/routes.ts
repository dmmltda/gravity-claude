import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from './prisma.js'
import { sendEmail, fetchEmailContent, verifyWebhookSignature } from './services/email.js'
import { AppError } from '../../../../../servicos-global/tenant/errors/AppError.js'
import { withTenantIsolation } from '../../../../../servicos-global/tenant/middleware/tenant-isolation.js'
import type { TenantRequest } from '../../../../../servicos-global/tenant/middleware/types.js'
import { fallbackAnalysis, bodyHash } from './fallback.js'

export const emailRouter = Router()
emailRouter.use(withTenantIsolation)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tenantReq(req: Request): TenantRequest {
  return req as TenantRequest
}

async function analyzeWithGabi(body: string): Promise<{
  sentiment: number
  action: 'auto_reply' | 'escalate_to_human'
  response: string
  confidence: number
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return fallbackAnalysis(body)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildGabiPrompt(body) }] }],
        }),
      },
    )
    if (!res.ok) return fallbackAnalysis(body)
    const data = await res.json() as GeminiResponse
    return parseGabiResponse(data)
  } catch {
    return fallbackAnalysis(body)
  }
}

interface GeminiResponse {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>
}

function buildGabiPrompt(body: string): string {
  return `Analise este email de cliente e responda em JSON:
{"sentiment": <número de -1 a 1>, "action": "auto_reply" ou "escalate_to_human", "response": "<resposta automática se aplicável>", "confidence": <0 a 1>}

Regras:
- sentiment < -0.5 → escalate_to_human
- Dúvidas simples, confirmações → auto_reply
- Reclamações, cancelamentos → escalate_to_human

Email: ${body.slice(0, 1000)}`
}

function parseGabiResponse(data: GeminiResponse): ReturnType<typeof fallbackAnalysis> {
  try {
    const text = data.candidates[0]?.content.parts[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallbackAnalysis('')
    const parsed = JSON.parse(jsonMatch[0]) as {
      sentiment: number
      action: 'auto_reply' | 'escalate_to_human'
      response: string
      confidence: number
    }
    return parsed
  } catch {
    return fallbackAnalysis('')
  }
}

async function checkGabiCostLimit(tenantId: string): Promise<boolean> {
  const limit = parseFloat(process.env.GABI_MONTHLY_LIMIT_USD ?? '20')
  const alertPct = parseFloat(process.env.GABI_ALERT_PCT ?? '80')
  // TODO(daniel, 2026-03): integrar com tabela de custo real da Gabi quando disponível
  const currentMonth = new Date().toISOString().slice(0, 7)
  const count = await prisma.emailMessage.count({
    where: {
      thread: { tenant_id: tenantId },
      gabi_response: { not: null },
      sent_at: { gte: new Date(`${currentMonth}-01`) },
    },
  })
  // Estimativa: ~0.002 USD por análise Gemini Flash
  const estimatedCost = count * 0.002
  if (estimatedCost >= limit) return false // Somente triagem
  if (estimatedCost >= limit * (alertPct / 100)) {
    // Alerta de custo — fire and forget
    void sendEmail({
      to: process.env.GABI_ALERT_EMAIL ?? '',
      subject: `[Gravity] Alerta de custo Gabi — ${Math.round((estimatedCost / limit) * 100)}% do limite`,
      html: `<p>Custo estimado Gabi: $${estimatedCost.toFixed(2)} de $${limit} (${Math.round((estimatedCost / limit) * 100)}%)</p>`,
      tags: [{ name: 'gabi-cost-alert', value: 'true' }],
      skipLog: true,
    })
  }
  return true
}

// ─── GET /api/v1/email/threads ────────────────────────────────────────────────

const listThreadsSchema = z.object({
  status: z.enum(['open', 'archived', 'resolved']).optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

emailRouter.get('/threads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = listThreadsSchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos')
    }
    const { status, sentiment, page, limit } = parsed.data
    const { tenantId } = tenantReq(req)

    const sentimentFilter =
      sentiment === 'positive'
        ? { sentiment: { gt: 0.2 } }
        : sentiment === 'negative'
          ? { sentiment: { lt: -0.2 } }
          : sentiment === 'neutral'
            ? { sentiment: { gte: -0.2, lte: 0.2 } }
            : {}

    const [threads, total] = await Promise.all([
      prisma.emailThread.findMany({
        where: { tenant_id: tenantId, ...(status ? { status } : {}), ...sentimentFilter },
        orderBy: { updated_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { messages: true } } },
      }),
      prisma.emailThread.count({
        where: { tenant_id: tenantId, ...(status ? { status } : {}), ...sentimentFilter },
      }),
    ])

    res.json({ threads, total, page, limit })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/email/threads/:id ───────────────────────────────────────────

emailRouter.get('/threads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = tenantReq(req)
    const thread = await prisma.emailThread.findFirst({
      where: { id: req.params.id, tenant_id: tenantId },
      include: { messages: { orderBy: { sent_at: 'asc' } } },
    })
    if (!thread) throw new AppError(404, 'NOT_FOUND', 'Thread não encontrada')
    res.json(thread)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/email/send ─────────────────────────────────────────────────

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  html: z.string().min(1),
  thread_id: z.string().uuid().optional(),
  from: z.string().optional(),
})

emailRouter.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = sendSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos')
    }
    const { to, subject, html, thread_id, from } = parsed.data
    const { tenantId } = tenantReq(req)

    const result = await sendEmail({ to, subject, html, from })

    let threadId = thread_id
    if (!threadId) {
      const thread = await prisma.emailThread.create({
        data: { tenant_id: tenantId, subject, sentiment: 0, status: 'open' },
      })
      threadId = thread.id
    }

    await prisma.emailMessage.create({
      data: {
        tenant_id: tenantId,
        thread_id: threadId,
        resend_id: result.resendId,
        direction: 'outbound',
        from: from ?? process.env.EMAIL_FROM!,
        to,
        body: html,
        dedup_key: result.dedupKey,
      },
    })

    res.status(201).json({ resend_id: result.resendId, thread_id: threadId })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/v1/email/webhook ──────────────────────────────────────────────

const webhookSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string().optional(),
    to: z.union([z.string(), z.array(z.string())]).optional(),
    subject: z.string().optional(),
  }),
})

emailRouter.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody = JSON.stringify(req.body)
      const signature = req.headers['x-resend-signature'] as string | undefined

      if (signature && !verifyWebhookSignature(rawBody, signature)) {
        throw new AppError(401, 'INVALID_SIGNATURE', 'Assinatura inválida')
      }

      const parsed = webhookSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Payload de webhook inválido')
      }

      if (parsed.data.type !== 'email.received') {
        res.sendStatus(200)
        return
      }

      // Responde imediatamente; processa de forma assíncrona
      res.sendStatus(200)

      setImmediate(() => {
        void processInboundEmail(parsed.data.data.email_id)
      })
    } catch (err) {
      next(err)
    }
  },
)

async function processInboundEmail(resendEmailId: string): Promise<void> {
  // Camada 1: dedup por resend_id
  const existing = await prisma.emailMessage.findUnique({ where: { resend_id: resendEmailId } })
  if (existing) return

  const content = await fetchEmailContent(resendEmailId)

  // Resolve tenant ANTES de qualquer query de dedup
  const tenantId = await resolveTenantFromEmail(content.to)
  if (!tenantId) return // descarta silenciosamente se não conseguir resolver

  const hash = bodyHash(content.html)

  // Camada 2: dedup por timestamp (mesmo remetente + conteúdo em < 5s)
  const recentDuplicate = await prisma.emailMessage.findFirst({
    where: {
      tenant_id: tenantId,
      from: content.from,
      sent_at: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { sent_at: 'desc' },
  })
  if (recentDuplicate) return

  // Camada 3: dedup por hash de corpo
  const hashDuplicate = await prisma.emailMessage.findFirst({
    where: { tenant_id: tenantId, dedup_key: hash },
  })
  if (hashDuplicate) return

  // Detecta parent_email_id via Reply-To+uuid no endereço "to"
  const toAddress = content.to
  const replyMatch = toAddress.match(/\+([0-9a-f-]{36})@/)
  const parentDedupKey = replyMatch ? replyMatch[1] : null

  const parentMessage = parentDedupKey
    ? await prisma.emailMessage.findFirst({ where: { tenant_id: tenantId, dedup_key: parentDedupKey } })
    : null

  const threadId = parentMessage
    ? parentMessage.thread_id
    : (
        await prisma.emailThread.create({
          data: {
            tenant_id: tenantId,
            subject: content.subject,
            sentiment: 0,
            status: 'open',
          },
        })
      ).id

  const message = await prisma.emailMessage.create({
    data: {
      tenant_id: tenantId,
      thread_id: threadId,
      resend_id: resendEmailId,
      direction: 'inbound',
      from: content.from,
      to: content.to,
      body: content.html,
      dedup_key: hash,
      parent_email_id: parentMessage?.id ?? null,
    },
  })

  // Gabi analisa
  const gabiEnabled = await checkGabiCostLimit(tenantId)
  const analysis = await analyzeWithGabi(content.html)

  await prisma.emailMessage.update({
    where: { id: message.id },
    data: {
      gabi_response: gabiEnabled ? analysis.response : null,
      gabi_confidence: analysis.confidence,
      gabi_analysis: { ...analysis },
    },
  })

  // Atualiza sentimento do thread (média ponderada)
  await updateThreadSentiment(threadId, analysis.sentiment)

  if (gabiEnabled && analysis.action === 'auto_reply' && analysis.response) {
    await sendEmail({
      to: content.from,
      subject: `Re: ${content.subject}`,
      html: `<p>${analysis.response}</p>`,
      tags: [{ name: 'gabi-auto-reply', value: 'true' }],
      skipLog: true,
    })
  }

  // Alerta imediato para sentimento muito negativo
  if (analysis.sentiment < -0.5) {
    void sendEmail({
      to: process.env.GABI_ALERT_EMAIL ?? '',
      subject: `[Gravity] Email com sentimento muito negativo detectado`,
      html: `<p>Thread: <a href="/email/thread/${threadId}">${threadId}</a></p><p>De: ${content.from}</p>`,
      tags: [{ name: 'sentiment-alert', value: 'true' }],
      skipLog: true,
    })
  }
}

async function resolveTenantFromEmail(to: string): Promise<string | null> {
  // Em produção, o tenant_id viria do roteamento multi-tenant via domínio ou alias
  // TODO(daniel, 2026-03): integrar com multi-tenant routing quando disponível
  const replyMatch = to.match(/\+([0-9a-f-]{36})@/)
  if (replyMatch) {
    const parent = await prisma.emailMessage.findFirst({
      where: { dedup_key: replyMatch[1] },
      include: { thread: true },
    })
    if (parent?.thread.tenant_id) return parent.thread.tenant_id
  }
  return process.env.DEFAULT_TENANT_ID ?? null
}

async function updateThreadSentiment(threadId: string, newScore: number): Promise<void> {
  const thread = await prisma.emailThread.findUnique({ where: { id: threadId } })
  if (!thread) return
  const updated = thread.sentiment * 0.7 + newScore * 0.3
  await prisma.emailThread.update({
    where: { id: threadId },
    data: { sentiment: updated, updated_at: new Date() },
  })
}

// ─── PUT /api/v1/email/threads/:id/status ────────────────────────────────────

const updateStatusSchema = z.object({
  status: z.enum(['open', 'archived', 'resolved']),
})

emailRouter.put('/threads/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Status inválido')
    }
    const { tenantId } = tenantReq(req)

    const thread = await prisma.emailThread.findFirst({
      where: { id: req.params.id, tenant_id: tenantId },
    })
    if (!thread) throw new AppError(404, 'NOT_FOUND', 'Thread não encontrada')

    const updated = await prisma.emailThread.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/v1/email/stats ─────────────────────────────────────────────────

emailRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = tenantReq(req)

    const [total, open, sentimentResult, gabiReplied, escalated] = await Promise.all([
      prisma.emailThread.count({ where: { tenant_id: tenantId } }),
      prisma.emailThread.count({ where: { tenant_id: tenantId, status: 'open' } }),
      prisma.emailThread.aggregate({
        where: { tenant_id: tenantId },
        _avg: { sentiment: true },
      }),
      prisma.emailMessage.count({
        where: {
          thread: { tenant_id: tenantId },
          gabi_response: { not: null },
          direction: 'outbound',
        },
      }),
      prisma.emailMessage.count({
        where: {
          thread: { tenant_id: tenantId },
          direction: 'inbound',
          gabi_response: null,
          gabi_confidence: { not: null },
        },
      }),
    ])

    res.json({
      total_threads: total,
      open_threads: open,
      avg_sentiment: sentimentResult._avg.sentiment ?? 0,
      gabi_replied: gabiReplied,
      escalated_to_human: escalated,
    })
  } catch (err) {
    next(err)
  }
})

import { Router } from 'express'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AppError } from '@tenant/errors/AppError.js'
import { withTenantIsolation } from '@tenant/middleware/tenant-isolation.js'
import type { TenantRequest } from '@tenant/middleware/types.js'
import { streamGabiChat, getMonthlyUsageCost } from './services/gabi-service.js'
import { sendSseError } from './streaming/sse.js'

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const chatSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória').max(8000),
  conversation_id: z.string().cuid().nullable().optional(),
  product_id: z.string().min(1, 'product_id é obrigatório'),
})

const conversationParamSchema = z.object({
  id: z.string().cuid(),
})

const uploadSchema = z.object({
  product_id: z.string().min(1),
  conversation_id: z.string().cuid().nullable().optional(),
})

const settingsSchema = z.object({
  product_id: z.string().min(1),
  monthly_limit_usd: z.number().positive().max(10000).optional(),
  alert_at_80_sent: z.boolean().optional(),
  alert_at_100_sent: z.boolean().optional(),
})

const usageQuerySchema = z.object({
  product_id: z.string().min(1),
})

// ─── Factory ──────────────────────────────────────────────────────────────────
// Serviço de produto — recebe o PrismaClient do produto que o instancia

export function createGabiRouter(prisma: PrismaClient): Router {
  const router = Router()
  router.use(withTenantIsolation)

  // ─── POST /chat ─────────────────────────────────────────────────────────────
  // Envia mensagem para a Gabi. Resposta via SSE.

  router.post('/chat', async (req, res) => {
    const { tenantId, userId } = req as TenantRequest

    const parsed = chatSchema.safeParse(req.body)
    if (!parsed.success) {
      sendSseError(res, 'Dados inválidos: ' + JSON.stringify(parsed.error.flatten()))
      return
    }

    const { message, conversation_id, product_id } = parsed.data

    // Carrega histórico da conversa se conversation_id fornecido
    let history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

    if (conversation_id) {
      try {
        const prismaWithGabi = prisma as PrismaClient & {
          gabiMessage: {
            findMany: (args: {
              where: { conversation_id: string }
              orderBy: { created_at: 'asc' | 'desc' }
              take: number
            }) => Promise<Array<{ role: string; content: string }>>
          }
          gabiConversation: {
            findFirst: (args: {
              where: { id: string; tenant_id: string }
            }) => Promise<{ id: string } | null>
          }
        }

        const convo = await prismaWithGabi.gabiConversation.findFirst({
          where: { id: conversation_id, tenant_id: tenantId },
        })
        if (!convo) {
          sendSseError(res, 'Conversa não encontrada')
          return
        }

        const messages = await prismaWithGabi.gabiMessage.findMany({
          where: { conversation_id },
          orderBy: { created_at: 'asc' },
          take: 20,
        })

        history = messages.map((m) => ({
          role: (m.role === 'user' || m.role === 'assistant' || m.role === 'system'
            ? m.role
            : 'user') as 'user' | 'assistant' | 'system',
          content: m.content,
        }))
      } catch (err) {
        sendSseError(res, 'Erro ao carregar histórico da conversa')
        return
      }
    }

    // Contexto do usuário para o system prompt — em produção viria do Configurador
    const userContext = {
      userId,
      userName: userId, // substituir por nome real via Configurador
      userRole: 'user',
      tenantId,
      tenantName: tenantId,
      productId: product_id,
      activeServices: ['email', 'whatsapp', 'cronometro', 'relatorios'],
    }

    await streamGabiChat(
      prisma,
      res,
      userContext,
      conversation_id ?? null,
      message,
      history
    )
  })

  // ─── GET /conversations ──────────────────────────────────────────────────────

  router.get('/conversations', async (req, res, next) => {
    try {
      const { tenantId, userId } = req as TenantRequest

      const prismaWithGabi = prisma as PrismaClient & {
        gabiConversation: {
          findMany: (args: {
            where: { tenant_id: string; user_id: string }
            orderBy: { updated_at: 'desc' }
            select: {
              id: boolean
              title: boolean
              updated_at: boolean
              messages: { select: { id: boolean }; take: number; orderBy: { created_at: 'desc' } }
            }
          }) => Promise<
            Array<{
              id: string
              title: string | null
              updated_at: Date
              messages: Array<{ id: string }>
            }>
          >
        }
      }

      const conversations = await prismaWithGabi.gabiConversation.findMany({
        where: { tenant_id: tenantId, user_id: userId },
        orderBy: { updated_at: 'desc' },
        select: {
          id: true,
          title: true,
          updated_at: true,
          messages: { select: { id: true }, take: 1, orderBy: { created_at: 'desc' } },
        },
      })

      res.json({ conversations })
    } catch (err) {
      next(err)
    }
  })

  // ─── GET /conversations/:id ──────────────────────────────────────────────────

  router.get('/conversations/:id', async (req, res, next) => {
    try {
      const { tenantId } = req as TenantRequest

      const paramParsed = conversationParamSchema.safeParse(req.params)
      if (!paramParsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'ID de conversa inválido')
      }

      const prismaWithGabi = prisma as PrismaClient & {
        gabiConversation: {
          findFirst: (args: {
            where: { id: string; tenant_id: string }
            include: { messages: { orderBy: { created_at: 'asc' } } }
          }) => Promise<{
            id: string
            title: string | null
            updated_at: Date
            messages: Array<{
              id: string
              role: string
              content: string
              attachments: string | null
              created_at: Date
            }>
          } | null>
        }
      }

      const conversation = await prismaWithGabi.gabiConversation.findFirst({
        where: { id: paramParsed.data.id, tenant_id: tenantId },
        include: { messages: { orderBy: { created_at: 'asc' } } },
      })

      if (!conversation) {
        throw new AppError(404, 'NOT_FOUND', 'Conversa não encontrada')
      }

      res.json({ conversation })
    } catch (err) {
      next(err)
    }
  })

  // ─── DELETE /conversations/:id ───────────────────────────────────────────────
  // Barreira 4: ação destrutiva — requer campo confirm: true no body

  router.delete('/conversations/:id', async (req, res, next) => {
    try {
      const { tenantId, userId } = req as TenantRequest

      const paramParsed = conversationParamSchema.safeParse(req.params)
      if (!paramParsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'ID de conversa inválido')
      }

      const confirmSchema = z.object({ confirm: z.literal(true) })
      const confirmParsed = confirmSchema.safeParse(req.body)
      if (!confirmParsed.success) {
        throw new AppError(
          400,
          'CONFIRMATION_REQUIRED',
          'Ação destrutiva: envie { "confirm": true } para confirmar a exclusão'
        )
      }

      const prismaWithGabi = prisma as PrismaClient & {
        gabiConversation: {
          findFirst: (args: {
            where: { id: string; tenant_id: string; user_id: string }
          }) => Promise<{ id: string } | null>
          delete: (args: { where: { id: string } }) => Promise<unknown>
        }
      }

      const conversation = await prismaWithGabi.gabiConversation.findFirst({
        where: { id: paramParsed.data.id, tenant_id: tenantId, user_id: userId },
      })
      if (!conversation) {
        throw new AppError(404, 'NOT_FOUND', 'Conversa não encontrada')
      }

      await prismaWithGabi.gabiConversation.delete({ where: { id: conversation.id } })
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  // ─── POST /upload ────────────────────────────────────────────────────────────

  router.post('/upload', async (req, res, next) => {
    try {
      const { tenantId, userId } = req as TenantRequest

      const parsed = uploadSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Dados de upload inválidos')
      }

      // Em produção: processar multipart/form-data com multer
      // O arquivo seria salvo em storage (Railway Volume / S3) e a URL retornada
      // Por ora, retorna o contrato da resposta esperada
      res.status(201).json({
        file_id: 'placeholder',
        name: 'arquivo.pdf',
        type: 'application/pdf',
        url: '',
        size_bytes: 0,
        preview_available: true,
        message: 'Upload endpoint pronto. Configure multer e storage para produção.',
      })

      void tenantId
      void userId
    } catch (err) {
      next(err)
    }
  })

  // ─── GET /usage ──────────────────────────────────────────────────────────────

  router.get('/usage', async (req, res, next) => {
    try {
      const { tenantId } = req as TenantRequest

      const queryParsed = usageQuerySchema.safeParse(req.query)
      if (!queryParsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'product_id é obrigatório')
      }

      const { count, estimated_usd } = await getMonthlyUsageCost(
        prisma,
        tenantId,
        queryParsed.data.product_id
      )

      const prismaWithGabi = prisma as PrismaClient & {
        gabiSettings: {
          findFirst: (args: {
            where: { tenant_id: string; product_id: string }
          }) => Promise<{
            monthly_limit_usd: number
            alert_at_80_sent: boolean
            alert_at_100_sent: boolean
          } | null>
        }
      }

      const settings = await prismaWithGabi.gabiSettings.findFirst({
        where: { tenant_id: tenantId, product_id: queryParsed.data.product_id },
      })

      const monthly_limit_usd = settings?.monthly_limit_usd ?? 50.0
      const usage_percent = Math.min(100, Math.round((estimated_usd / monthly_limit_usd) * 100))

      res.json({
        actions_count: count,
        estimated_usd,
        monthly_limit_usd,
        usage_percent,
        alert_80_triggered: usage_percent >= 80,
        alert_100_triggered: usage_percent >= 100,
      })
    } catch (err) {
      next(err)
    }
  })

  // ─── PUT /settings ───────────────────────────────────────────────────────────

  router.put('/settings', async (req, res, next) => {
    try {
      const { tenantId } = req as TenantRequest

      const parsed = settingsSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Dados de configuração inválidos')
      }

      const { product_id, ...updateData } = parsed.data

      const now = new Date()
      const prismaWithGabi = prisma as PrismaClient & {
        gabiSettings: {
          upsert: (args: {
            where: { tenant_id_product_id: { tenant_id: string; product_id: string } }
            create: {
              tenant_id: string
              product_id: string
              monthly_limit_usd?: number
            }
            update: {
              monthly_limit_usd?: number
              alert_at_80_sent?: boolean
              alert_at_100_sent?: boolean
              alert_reset_month?: number
              alert_reset_year?: number
            }
          }) => Promise<{
            tenant_id: string
            product_id: string
            monthly_limit_usd: number
            alert_at_80_sent: boolean
            alert_at_100_sent: boolean
          }>
        }
      }

      // Anti-spam: ao atualizar monthly_limit_usd, reseta os alertas do mês
      const resetAlerts = updateData.monthly_limit_usd !== undefined

      const settings = await prismaWithGabi.gabiSettings.upsert({
        where: { tenant_id_product_id: { tenant_id: tenantId, product_id } },
        create: {
          tenant_id: tenantId,
          product_id,
          monthly_limit_usd: updateData.monthly_limit_usd,
        },
        update: {
          ...updateData,
          ...(resetAlerts
            ? {
                alert_at_80_sent: false,
                alert_at_100_sent: false,
                alert_reset_month: now.getMonth() + 1,
                alert_reset_year: now.getFullYear(),
              }
            : {}),
        },
      })

      res.json({ settings })
    } catch (err) {
      next(err)
    }
  })

  return router
}

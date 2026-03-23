import type { PrismaClient } from '@prisma/client'
import type { Response } from 'express'
import { AppError } from '@tenant/errors/AppError.js'
import {
  initSseResponse,
  sendTypingIndicator,
  sendSseEvent,
  sendActionNotice,
  closeSseStream,
  sendSseError,
} from '../streaming/sse.js'

// Fallback chain com 5 modelos Gemini — tenta na ordem até um responder
const GEMINI_MODELS = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.0-pro',
  'gemini-pro',
] as const

const MAX_CONTEXT_MESSAGES = 20

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GabiUserContext {
  userId: string
  userName: string
  userRole: string
  tenantId: string
  tenantName: string
  productId: string
  activeServices: string[]
}

interface GeminiMessage {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

interface GeminiResponseCandidate {
  content?: {
    parts?: Array<{ text?: string }>
  }
}

interface GeminiStreamChunk {
  candidates?: GeminiResponseCandidate[]
}

// Monta o system prompt dinâmico com permissões e serviços do usuário
export function buildSystemPrompt(ctx: GabiUserContext): string {
  return `Você é a Gabi, agente de execução da Gravity.
Você atua com as permissões do usuário: ${ctx.userName} (${ctx.userRole}).

TENANT: ${ctx.tenantName}
SERVIÇOS ATIVOS: ${ctx.activeServices.join(', ')}

PAPÉIS QUE VOCÊ EXERCE:
1. Help Desk Inteligente — responde dúvidas sobre a plataforma
2. Customer Success — analisa saúde de clientes e sugere ações proativas
3. Treinamento e Onboarding — gera guias passo a passo
4. Analista de Dados — interpreta planilhas e gera insights

REGRAS ABSOLUTAS:
- Nunca execute uma ação sem verificar permissão primeiro
- Toda ação que modifica dados deve ser registrada no histórico
- Ações destrutivas (delete, exclusão em massa) SEMPRE exigem confirmação do usuário
- Antes de executar qualquer ação, informe ao usuário o que você verificou e o que vai executar
- Ao verificar permissão, informe: "Verificando sua permissão para [ação]..."
- Seja direta e eficiente — elimine tarefas repetitivas com linguagem natural`
}

// Sumariza mensagens antigas quando o contexto excede 20 mensagens
function summarizeOldMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return messages

  const oldMessages = messages.slice(0, messages.length - MAX_CONTEXT_MESSAGES)
  const recentMessages = messages.slice(messages.length - MAX_CONTEXT_MESSAGES)

  const summary = oldMessages
    .map((m) => `[${m.role}]: ${m.content.slice(0, 200)}`)
    .join('\n')

  const summaryMessage: ChatMessage = {
    role: 'system',
    content: `[RESUMO DE MENSAGENS ANTERIORES]\n${summary}`,
  }

  return [summaryMessage, ...recentMessages]
}

// Converte ChatMessage[] para o formato da API Gemini
function toGeminiMessages(messages: ChatMessage[]): GeminiMessage[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
}

// Chama a API Gemini com streaming, tentando cada modelo do fallback chain
async function callGeminiWithFallback(
  systemPrompt: string,
  messages: GeminiMessage[],
  onToken: (token: string) => void
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new AppError(500, 'CONFIGURATION_ERROR', 'GEMINI_API_KEY não configurada')
  }

  let lastError: Error | null = null

  for (const model of GEMINI_MODELS) {
    try {
      await streamGeminiModel(apiKey, model, systemPrompt, messages, onToken)
      return // sucesso — para o fallback chain
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[GABI] Modelo ${model} falhou, tentando próximo...`, lastError.message)
    }
  }

  throw new AppError(
    503,
    'GABI_AI_UNAVAILABLE',
    `Todos os modelos Gemini falharam. Último erro: ${lastError?.message ?? 'desconhecido'}`
  )
}

async function streamGeminiModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: GeminiMessage[],
  onToken: (token: string) => void
): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini ${model} retornou ${response.status}: ${errorText}`)
  }

  if (!response.body) {
    throw new Error(`Gemini ${model}: response body vazio`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // A API Gemini retorna um array JSON — processar linha por linha
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue

      try {
        const chunk = JSON.parse(trimmed.replace(/^,/, '')) as GeminiStreamChunk
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onToken(text)
      } catch {
        // linha parcial ou separador — ignora
      }
    }
  }
}

// streamGabiChat — lógica central do chat com streaming SSE
// Monta contexto, chama Gemini, persiste mensagens e resposta
export async function streamGabiChat(
  prisma: PrismaClient,
  res: Response,
  ctx: GabiUserContext,
  conversationId: string | null,
  userMessage: string,
  history: ChatMessage[]
): Promise<void> {
  initSseResponse(res)
  sendTypingIndicator(res)

  const systemPrompt = buildSystemPrompt(ctx)
  const contextMessages = summarizeOldMessages([
    ...history,
    { role: 'user', content: userMessage },
  ])
  const geminiMessages = toGeminiMessages(contextMessages)

  let fullResponse = ''

  try {
    await callGeminiWithFallback(systemPrompt, geminiMessages, (token) => {
      fullResponse += token
      sendSseEvent(res, { type: 'token', data: token })
    })
  } catch (err) {
    const message = err instanceof AppError ? err.message : 'Erro ao processar resposta da Gabi'
    sendSseError(res, message)
    return
  }

  // Persiste a mensagem do usuário e a resposta no banco
  try {
    const prismaWithGabi = prisma as PrismaClient & {
      gabiConversation: {
        create: (args: {
          data: {
            tenant_id: string
            product_id: string
            user_id: string
            title?: string
          }
        }) => Promise<{ id: string }>
        findFirst: (args: {
          where: { id: string; tenant_id: string }
        }) => Promise<{ id: string } | null>
      }
      gabiMessage: {
        createMany: (args: {
          data: Array<{
            conversation_id: string
            role: string
            content: string
          }>
        }) => Promise<unknown>
      }
    }

    let activeConversationId = conversationId

    if (!activeConversationId) {
      const convo = await prismaWithGabi.gabiConversation.create({
        data: {
          tenant_id: ctx.tenantId,
          product_id: ctx.productId,
          user_id: ctx.userId,
          title: userMessage.slice(0, 80),
        },
      })
      activeConversationId = convo.id
    }

    await prismaWithGabi.gabiMessage.createMany({
      data: [
        { conversation_id: activeConversationId, role: 'user', content: userMessage },
        { conversation_id: activeConversationId, role: 'assistant', content: fullResponse },
      ],
    })

    // Envia o conversation_id para o cliente poder continuar a conversa
    sendSseEvent(res, { type: 'done', data: activeConversationId })
  } catch (err) {
    console.error('[GABI] Erro ao persistir mensagens', err)
    sendSseEvent(res, { type: 'done', data: conversationId ?? '' })
  }

  res.end()
}

// getMonthlyUsageCost — calcula custo estimado do mês atual
export async function getMonthlyUsageCost(
  prisma: PrismaClient,
  tenantId: string,
  productId: string
): Promise<{ count: number; estimated_usd: number }> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const prismaWithGabi = prisma as PrismaClient & {
    gabiUsageLog: {
      count: (args: {
        where: {
          tenant_id: string
          product_id: string
          created_at: { gte: Date }
        }
      }) => Promise<number>
    }
  }

  const count = await prismaWithGabi.gabiUsageLog.count({
    where: {
      tenant_id: tenantId,
      product_id: productId,
      created_at: { gte: startOfMonth },
    },
  })

  // Estimativa aproximada: cada ação usa ~0.002 USD (Gemini 1.5 Flash)
  const estimated_usd = count * 0.002

  return { count, estimated_usd }
}

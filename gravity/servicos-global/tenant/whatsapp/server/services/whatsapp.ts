import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { AppError } from '../../errors/AppError.js'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface MetaSendTextPayload {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'text'
  text: { body: string }
}

interface MetaSendTemplatePayload {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'template'
  template: {
    name: string
    language: { code: string }
    components?: MetaTemplateComponent[]
  }
}

interface MetaTemplateComponent {
  type: string
  parameters: MetaTemplateParameter[]
}

interface MetaTemplateParameter {
  type: string
  text?: string
}

interface MetaSendResult {
  messages: Array<{ id: string }>
}

interface ConversationRecord {
  id: string
  tenant_id: string
  wa_phone_number: string
  status: string
  ai_enabled: boolean
  contact_id: string | null
  company_id: string | null
  contact_nome: string | null
  company_nome: string | null
}

export interface SendTextOptions {
  tenantId: string
  phone: string
  text: string
  conversationId: string
  sentBy?: string
  prisma: PrismaClient
}

export interface SendTemplateOptions {
  tenantId: string
  phone: string
  templateName: string
  languageCode: string
  components?: MetaTemplateComponent[]
  conversationId: string
  sentBy?: string
  prisma: PrismaClient
}

// ─── Normalização de número brasileiro ──────────────────────────────────────

/**
 * A Meta envia webhooks com 12 dígitos (sem o 9º dígito BR).
 * Para entregar, precisa de 13. Injeta o 9 automaticamente.
 * Ex: 554888480707 → 5548988480707
 */
export function normalizePhoneForSend(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 12 && clean.startsWith('55')) {
    return clean.slice(0, 4) + '9' + clean.slice(4)
  }
  return clean
}

// ─── Validação HMAC-SHA256 ───────────────────────────────────────────────────

export function validateWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return false

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  // Garante comprimentos iguais antes de timingSafeEqual para evitar crash
  if (expected.length !== signature.length) return false

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// ─── findOrCreateConversation ─────────────────────────────────────────────────

export async function findOrCreateConversation(
  prisma: PrismaClient,
  tenantId: string,
  waPhoneNumber: string
): Promise<ConversationRecord> {
  const existing = await prisma.whatsAppConversation.findFirst({
    where: {
      tenant_id: tenantId,
      wa_phone_number: waPhoneNumber,
      status: 'open',
    },
  })

  if (existing) return existing as ConversationRecord

  const created = await prisma.whatsAppConversation.create({
    data: {
      tenant_id: tenantId,
      wa_phone_number: waPhoneNumber,
      status: 'open',
      gabi_temperatura: 'neutro',
    },
  })

  return created as ConversationRecord
}

// ─── Acesso à Meta Cloud API ─────────────────────────────────────────────────

async function callMetaApi(
  payload: MetaSendTextPayload | MetaSendTemplatePayload
): Promise<MetaSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new AppError(500, 'WHATSAPP_CONFIG_MISSING', 'Variáveis de ambiente do WhatsApp não configuradas')
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new AppError(502, 'WHATSAPP_API_ERROR', `Meta API retornou ${response.status}: ${body}`)
  }

  return response.json() as Promise<MetaSendResult>
}

// ─── sendTextMessage ──────────────────────────────────────────────────────────

export async function sendTextMessage(options: SendTextOptions): Promise<string> {
  const { tenantId, phone, text, conversationId, sentBy, prisma } = options

  const normalizedPhone = normalizePhoneForSend(phone)

  const payload: MetaSendTextPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'text',
    text: { body: text },
  }

  const result = await callMetaApi(payload)
  const waMessageId = result.messages[0]?.id ?? null

  await prisma.whatsAppMessage.create({
    data: {
      tenant_id: tenantId,
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction: 'outbound',
      content_type: 'text',
      content: text,
      origin: sentBy ? 'agent' : 'system',
      sent_by: sentBy ?? null,
      status: 'sent',
    },
  })

  return waMessageId ?? ''
}

// ─── sendTemplateMessage ──────────────────────────────────────────────────────

export async function sendTemplateMessage(options: SendTemplateOptions): Promise<string> {
  const { tenantId, phone, templateName, languageCode, components, conversationId, sentBy, prisma } = options

  const normalizedPhone = normalizePhoneForSend(phone)

  const payload: MetaSendTemplatePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  }

  const result = await callMetaApi(payload)
  const waMessageId = result.messages[0]?.id ?? null

  await prisma.whatsAppMessage.create({
    data: {
      tenant_id: tenantId,
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction: 'outbound',
      content_type: 'template',
      content: templateName,
      origin: sentBy ? 'agent' : 'system',
      sent_by: sentBy ?? null,
      status: 'sent',
    },
  })

  return waMessageId ?? ''
}

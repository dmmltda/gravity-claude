import { Resend } from 'resend'
import { createHmac, randomUUID } from 'crypto'
import { AppError } from '../../../../../../servicos-global/tenant/errors/AppError.js'

const resend = new Resend(process.env.RESEND_API_KEY!)

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
  tags?: Array<{ name: string; value: string }>
  skipLog?: boolean
}

export interface SendEmailResult {
  resendId: string
  dedupKey: string
  replyTo: string | undefined
}

function buildReplyTo(dedupKey: string): string | undefined {
  const base = process.env.EMAIL_INBOUND_ADDRESS
  if (!base) return undefined
  const atIdx = base.indexOf('@')
  if (atIdx === -1) return undefined
  const local = base.slice(0, atIdx)
  const domain = base.slice(atIdx + 1)
  return `${local}+${dedupKey}@${domain}`
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const dedupKey = randomUUID()
  const from = opts.from ?? process.env.EMAIL_FROM!
  const replyTo = opts.replyTo ?? buildReplyTo(dedupKey)

  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    reply_to: replyTo,
    tags: opts.tags ?? [],
  })

  if (error ?? !data) {
    throw new AppError(502, 'EMAIL_SEND_FAILED', `Falha ao enviar email: ${error?.message ?? 'resposta vazia'}`)
  }

  return { resendId: data.id, dedupKey, replyTo }
}

export async function fetchEmailContent(resendEmailId: string): Promise<{ from: string; to: string; subject: string; html: string }> {
  const response = await fetch(`https://api.resend.com/emails/${resendEmailId}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!}` },
  })

  if (!response.ok) {
    throw new AppError(502, 'EMAIL_FETCH_FAILED', `Falha ao buscar email ${resendEmailId}`)
  }

  const data = await response.json() as { from: string; to: string[]; subject: string; html: string }
  return {
    from: data.from,
    to: Array.isArray(data.to) ? data.to[0] : data.to,
    subject: data.subject,
    html: data.html,
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return signature === `sha256=${expected}`
}

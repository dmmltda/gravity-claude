import { Resend } from 'resend'
import { prisma } from './prisma.js'
import { emitToUser } from './sse-registry.js'
import type { NotificationJobData } from './job-queue.js'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ResolvedUser {
  email: string
  name: string
  phone: string | null
}

// Forma mínima da Activity esperada após composição do schema
interface ActivityRecord {
  id: string
  tenant_id: string
  title: string | null
  assigned_to: string | null
  reminder_whatsapp: boolean | null
  send_invite_whatsapp: boolean | null
  send_summary_whatsapp: boolean | null
  send_recording_whatsapp: boolean | null
  company: { name: string } | null
}

// Tipos de notificação suportados
type NotificationType =
  | 'mentioned'
  | 'task-assigned'
  | 'reminder'
  | 'next-step'
  | 'meeting-invite'
  | 'meeting-summary'
  | 'recording'
  | 'gabi-summary'

// ─── Templates de email ───────────────────────────────────────────────────────

function buildEmailSubject(type: NotificationType, activity: ActivityRecord | null): string {
  const title = activity?.title ?? 'uma atividade'
  const subjects: Record<NotificationType, string> = {
    mentioned: `Você foi mencionado em: ${title}`,
    'task-assigned': `Nova tarefa atribuída: ${title}`,
    reminder: `Lembrete: ${title}`,
    'next-step': `Próximo passo chegando: ${title}`,
    'meeting-invite': `Convite de reunião: ${title}`,
    'meeting-summary': `Resumo de atendimento: ${title}`,
    recording: `Gravação disponível: ${title}`,
    'gabi-summary': 'Resumo da Gabi disponível',
  }
  return subjects[type]
}

function buildEmailHtml(
  type: NotificationType,
  activity: ActivityRecord | null,
  user: ResolvedUser,
  extra?: Record<string, string | number | boolean | null>,
): string {
  const title = activity?.title ?? ''
  const name = user.name
  const empresa = activity?.company?.name ?? ''

  const templates: Record<NotificationType, string> = {
    mentioned: `<p>Olá ${name},</p><p>Você foi mencionado em <strong>${title}</strong> por ${String(extra?.mencionadoPor ?? 'alguém')}.</p>`,
    'task-assigned': `<p>Olá ${name},</p><p>Uma tarefa foi atribuída a você: <strong>${title}</strong>.</p>`,
    reminder: `<p>Olá ${name},</p><p>Lembrete: <strong>${title}</strong> — o prazo chegou.</p>`,
    'next-step': `<p>Olá ${name},</p><p>O próximo passo de <strong>${title}</strong> se aproxima.</p>`,
    'meeting-invite': `<p>Olá ${name},</p><p>Você foi convidado para uma reunião: <strong>${title}</strong> — ${empresa}.</p>`,
    'meeting-summary': `<p>Olá ${name},</p><p>O atendimento <strong>${title}</strong> foi finalizado. Segue o resumo.</p>`,
    recording: `<p>Olá ${name},</p><p>A gravação de <strong>${title}</strong> está disponível.</p>`,
    'gabi-summary': `<p>Olá ${name},</p><p>A Gabi gerou um resumo para você. Acesse a plataforma para visualizar.</p>`,
  }

  return templates[type]
}

function buildTitle(type: NotificationType, activity: ActivityRecord | null): string {
  return buildEmailSubject(type, activity)
}

function buildMessage(type: NotificationType, activity: ActivityRecord | null): string {
  const title = activity?.title ?? ''
  const messages: Record<NotificationType, string> = {
    mentioned: `Você foi mencionado em "${title}"`,
    'task-assigned': `Tarefa "${title}" foi atribuída a você`,
    reminder: `Lembrete: "${title}"`,
    'next-step': `Próximo passo de "${title}" se aproxima`,
    'meeting-invite': `Convite para reunião: "${title}"`,
    'meeting-summary': `Resumo disponível para: "${title}"`,
    recording: `Gravação disponível para: "${title}"`,
    'gabi-summary': 'A Gabi gerou um novo resumo',
  }
  return messages[type]
}

function buildWhatsAppText(type: NotificationType, activity: ActivityRecord | null): string {
  const title = activity?.title ?? ''
  const texts: Record<NotificationType, string> = {
    mentioned: `Você foi mencionado em "${title}"`,
    'task-assigned': `Nova tarefa: "${title}"`,
    reminder: `Lembrete: "${title}"`,
    'next-step': `Próximo passo de "${title}" se aproxima`,
    'meeting-invite': `Convite de reunião: "${title}"`,
    'meeting-summary': `Resumo disponível para: "${title}"`,
    recording: `Gravação disponível: "${title}"`,
    'gabi-summary': 'A Gabi gerou um resumo. Acesse a plataforma.',
  }
  return texts[type]
}

function shouldSendWhatsApp(
  type: NotificationType,
  activity: ActivityRecord | null,
): boolean {
  if (!activity) return false
  const flagMap: Partial<Record<NotificationType, keyof ActivityRecord>> = {
    reminder: 'reminder_whatsapp',
    'task-assigned': 'reminder_whatsapp',
    'next-step': 'reminder_whatsapp',
    'meeting-invite': 'send_invite_whatsapp',
    'meeting-summary': 'send_summary_whatsapp',
    recording: 'send_recording_whatsapp',
  }
  const flag = flagMap[type]
  return flag ? Boolean(activity[flag]) : false
}

// ─── Helpers externos ─────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY!)

async function sendEmailNotification(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    html,
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
}

async function sendWhatsAppNotification(phone: string, text: string): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const token = process.env.WHATSAPP_ACCESS_TOKEN!
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { body: text },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`WhatsApp API error: ${msg}`)
  }
}

// Lookup flexível: Clerk ID ou email direto
async function resolveUser(userId: string): Promise<ResolvedUser> {
  if (userId.includes('@')) {
    return { email: userId, name: userId.split('@')[0], phone: null }
  }

  const clerkApiKey = process.env.CLERK_SECRET_KEY!
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${clerkApiKey}` },
  })

  if (!res.ok) throw new Error(`Clerk user not found: ${userId}`)

  const data = await res.json() as {
    first_name: string | null
    last_name: string | null
    email_addresses: Array<{ email_address: string }>
    phone_numbers: Array<{ phone_number: string }>
  }

  return {
    email: data.email_addresses[0]?.email_address ?? '',
    name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
    phone: data.phone_numbers[0]?.phone_number ?? null,
  }
}

// ─── Processamento principal ──────────────────────────────────────────────────

export async function processNotificationJob(data: NotificationJobData): Promise<void> {
  const type = data.type as NotificationType

  // Busca atividade com empresa (se houver activityId)
  // Requer schema composto (Activity model do fragment atividades)
  const prismaExt = prisma as unknown as {
    activity: {
      findUnique: (args: {
        where: { id: string }
        include: { company: boolean }
      }) => Promise<ActivityRecord | null>
    }
  }

  const activity = data.activityId
    ? await prismaExt.activity.findUnique({
        where: { id: data.activityId },
        include: { company: true },
      })
    : null

  const user = await resolveUser(data.userId)

  // 1. Cria notificação in-app
  const notification = await prisma.notification.create({
    data: {
      tenant_id: data.tenantId,
      user_id: data.userId,
      type,
      title: buildTitle(type, activity),
      message: buildMessage(type, activity),
      activity_id: data.activityId,
    },
  })

  // Conta não-lidas para atualizar badge
  const unreadCount = await prisma.notification.count({
    where: { tenant_id: data.tenantId, user_id: data.userId, read: false },
  })

  // Emite via SSE para o usuário (se conectado)
  emitToUser(data.tenantId, data.userId, 'new_notification', {
    notification,
    unread_count: unreadCount,
  })

  // 2. Email via Resend
  await sendEmailNotification(
    user.email,
    buildEmailSubject(type, activity),
    buildEmailHtml(type, activity, user, data.extra),
  )

  // 3. WhatsApp — condicional, falha silenciosa
  if (shouldSendWhatsApp(type, activity) && user.phone) {
    try {
      await sendWhatsAppNotification(user.phone, buildWhatsAppText(type, activity))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[notification-worker] WhatsApp notification failed (non-fatal):', msg)
    }
  }
}

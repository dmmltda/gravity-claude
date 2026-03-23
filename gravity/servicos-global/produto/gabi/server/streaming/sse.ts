import type { Response } from 'express'

export type SseEventType =
  | 'typing'       // indicador "..." antes do primeiro token
  | 'token'        // fragmento de texto gerado
  | 'action_notice' // aviso de ação que modifica dados
  | 'done'         // fim do stream
  | 'error'        // erro durante geração

export interface SseEvent {
  type: SseEventType
  data: string
}

// Configura os headers SSE na resposta Express.
// Deve ser chamado antes de qualquer write.
export function initSseResponse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // desativa buffer no nginx/Railway
  res.flushHeaders()
}

// Envia um evento SSE formatado.
// Formato: "event: <type>\ndata: <json>\n\n"
export function sendSseEvent(res: Response, event: SseEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify({ content: event.data })}\n\n`)
}

// Envia o indicador de digitação obrigatório antes do primeiro token.
export function sendTypingIndicator(res: Response): void {
  sendSseEvent(res, { type: 'typing', data: '...' })
}

// Envia o aviso obrigatório antes de qualquer ação que modifica dados.
export function sendActionNotice(res: Response): void {
  sendSseEvent(res, {
    type: 'action_notice',
    data: '📝 Esta conversa será salva no histórico',
  })
}

// Encerra o stream SSE.
export function closeSseStream(res: Response): void {
  sendSseEvent(res, { type: 'done', data: '' })
  res.end()
}

// Envia um erro pelo stream e encerra.
export function sendSseError(res: Response, message: string): void {
  sendSseEvent(res, { type: 'error', data: message })
  res.end()
}

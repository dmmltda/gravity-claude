import type { Response } from 'express'

// Mapa de conexões SSE ativas: `${tenantId}:${userId}` → Set de Response streams
const clients = new Map<string, Set<Response>>()

function sseKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`
}

export function addSseClient(tenantId: string, userId: string, res: Response): void {
  const key = sseKey(tenantId, userId)
  if (!clients.has(key)) clients.set(key, new Set())
  clients.get(key)!.add(res)
}

export function removeSseClient(tenantId: string, userId: string, res: Response): void {
  const key = sseKey(tenantId, userId)
  const set = clients.get(key)
  if (!set) return
  set.delete(res)
  if (set.size === 0) clients.delete(key)
}

export function emitToUser(
  tenantId: string,
  userId: string,
  event: string,
  data: Record<string, unknown>,
): void {
  const key = sseKey(tenantId, userId)
  const set = clients.get(key)
  if (!set || set.size === 0) return
  const payload = `data: ${JSON.stringify({ type: event, ...data })}\n\n`
  for (const res of set) {
    res.write(payload)
  }
}

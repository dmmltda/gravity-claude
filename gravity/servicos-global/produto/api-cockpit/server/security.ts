// Funções de segurança puras do api-cockpit — extraídas para testes unitários

import { createHash, createHmac, randomBytes } from 'crypto'

/**
 * Gera hash SHA-256 de um valor (hex).
 */
export function hashSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Gera um token de API com prefixo e seu hash SHA-256.
 * O plain text é retornado apenas uma vez — nunca armazenado.
 */
export function generateToken(
  prefix: 'gv_live_sk_' | 'gv_test_sk_'
): { plain: string; hash: string } {
  const random = randomBytes(32).toString('base64url')
  const plain = `${prefix}${random}`
  const hash = hashSha256(plain)
  return { plain, hash }
}

/**
 * Gera um secret de webhook aleatório e seu hash SHA-256.
 */
export function generateWebhookSecret(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString('hex')
  const hash = hashSha256(plain)
  return { plain, hash }
}

/**
 * Assina um payload com HMAC-SHA256 no formato "sha256=<hex>".
 */
export function signWebhookPayload(secret: string, payload: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
}

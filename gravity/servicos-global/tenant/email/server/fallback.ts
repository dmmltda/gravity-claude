// Lógica pura do email — extraída para permitir testes unitários

import { createHash } from 'crypto'

export interface GabiAnalysis {
  sentiment: number
  action: 'auto_reply' | 'escalate_to_human'
  response: string
  confidence: number
}

/**
 * Análise de fallback quando Gemini não está disponível ou falha.
 * Detecta palavras-chave negativas e decide a ação.
 */
export function fallbackAnalysis(body: string): GabiAnalysis {
  const isNegative =
    /ruim|péssimo|horrível|insatisfeito|cancelar|não consigo|reclamação|problema/i.test(body)
  return {
    sentiment: isNegative ? -0.7 : 0.1,
    action: isNegative ? 'escalate_to_human' : 'auto_reply',
    response: isNegative ? '' : 'Obrigado pelo contato! Nossa equipe irá retornar em breve.',
    confidence: 0.5,
  }
}

/**
 * Gera hash SHA-256 do corpo do email (normalizado) para deduplicação.
 */
export function bodyHash(body: string): string {
  return createHash('sha256').update(body.trim().toLowerCase()).digest('hex')
}

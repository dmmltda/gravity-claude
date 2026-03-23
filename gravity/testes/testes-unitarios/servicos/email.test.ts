import { describe, it, expect } from 'vitest'
import { fallbackAnalysis, bodyHash } from '../../../servicos-global/tenant/email/server/fallback.js'

// ─── fallbackAnalysis ─────────────────────────────────────────────────────────

describe('fallbackAnalysis', () => {
  it('retorna auto_reply e sentimento positivo para email neutro', () => {
    const result = fallbackAnalysis('Olá, gostaria de saber mais sobre os planos disponíveis.')
    expect(result.action).toBe('auto_reply')
    expect(result.sentiment).toBeGreaterThan(0)
    expect(result.response).not.toBe('')
    expect(result.confidence).toBe(0.5)
  })

  it('detecta "ruim" e escala para humano', () => {
    const result = fallbackAnalysis('O serviço está muito ruim, não consigo usar nada.')
    expect(result.action).toBe('escalate_to_human')
    expect(result.sentiment).toBe(-0.7)
    expect(result.response).toBe('')
  })

  it('detecta "cancelar" e escala para humano', () => {
    const result = fallbackAnalysis('Quero cancelar minha assinatura imediatamente.')
    expect(result.action).toBe('escalate_to_human')
    expect(result.sentiment).toBe(-0.7)
  })

  it('detecta "reclamação" e escala para humano', () => {
    const result = fallbackAnalysis('Tenho uma reclamação formal a registrar.')
    expect(result.action).toBe('escalate_to_human')
  })

  it('detecta "péssimo" (com acento) e escala para humano', () => {
    const result = fallbackAnalysis('O atendimento foi péssimo.')
    expect(result.action).toBe('escalate_to_human')
  })

  it('é case-insensitive — detecta "RUIM" em maiúsculas', () => {
    const result = fallbackAnalysis('Achei RUIM demais.')
    expect(result.action).toBe('escalate_to_human')
  })

  it('retorna response padrão para email positivo', () => {
    const result = fallbackAnalysis('Parabéns pelo excelente atendimento!')
    expect(result.action).toBe('auto_reply')
    expect(result.response).toBe('Obrigado pelo contato! Nossa equipe irá retornar em breve.')
  })
})

// ─── bodyHash ─────────────────────────────────────────────────────────────────

describe('bodyHash', () => {
  it('gera hash SHA-256 de 64 caracteres hex', () => {
    const hash = bodyHash('hello world')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('normaliza: corpo com espaços extras gera mesmo hash que versão limpa', () => {
    const h1 = bodyHash('  Olá mundo  ')
    const h2 = bodyHash('olá mundo')
    expect(h1).toBe(h2)
  })

  it('hashes diferentes para corpos diferentes', () => {
    const h1 = bodyHash('mensagem A')
    const h2 = bodyHash('mensagem B')
    expect(h1).not.toBe(h2)
  })

  it('é determinístico — mesmo input gera mesmo hash', () => {
    const body = 'Conteúdo do email de teste'
    expect(bodyHash(body)).toBe(bodyHash(body))
  })
})

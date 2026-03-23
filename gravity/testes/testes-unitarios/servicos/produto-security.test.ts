/**
 * Testes dos serviços de produto:
 * - api-cockpit: funções de segurança (hashSha256, generateToken, generateWebhookSecret, signWebhookPayload)
 * - gabi: schemas Zod
 */
import { describe, it, expect } from 'vitest'
import {
  hashSha256,
  generateToken,
  generateWebhookSecret,
  signWebhookPayload,
} from '../../../servicos-global/produto/api-cockpit/server/security.js'

import {
  chatSchema,
  uploadSchema,
  settingsSchema,
} from '../../../servicos-global/produto/gabi/server/schemas.js'

// ─── api-cockpit: hashSha256 ─────────────────────────────────────────────────

describe('hashSha256', () => {
  it('gera hash de 64 caracteres hex', () => {
    expect(hashSha256('hello')).toHaveLength(64)
    expect(hashSha256('hello')).toMatch(/^[a-f0-9]+$/)
  })

  it('é determinístico', () => {
    expect(hashSha256('gravity')).toBe(hashSha256('gravity'))
  })

  it('inputs diferentes geram hashes diferentes', () => {
    expect(hashSha256('a')).not.toBe(hashSha256('b'))
  })
})

// ─── api-cockpit: generateToken ───────────────────────────────────────────────

describe('generateToken', () => {
  it('plain token começa com o prefixo correto (live)', () => {
    const { plain } = generateToken('gv_live_sk_')
    expect(plain.startsWith('gv_live_sk_')).toBe(true)
  })

  it('plain token começa com o prefixo correto (test)', () => {
    const { plain } = generateToken('gv_test_sk_')
    expect(plain.startsWith('gv_test_sk_')).toBe(true)
  })

  it('hash é o SHA-256 do plain', () => {
    const { plain, hash } = generateToken('gv_live_sk_')
    expect(hash).toBe(hashSha256(plain))
  })

  it('gera tokens únicos a cada chamada', () => {
    const t1 = generateToken('gv_live_sk_')
    const t2 = generateToken('gv_live_sk_')
    expect(t1.plain).not.toBe(t2.plain)
    expect(t1.hash).not.toBe(t2.hash)
  })
})

// ─── api-cockpit: generateWebhookSecret ──────────────────────────────────────

describe('generateWebhookSecret', () => {
  it('plain é uma string hex de 64 caracteres (32 bytes)', () => {
    const { plain } = generateWebhookSecret()
    expect(plain).toHaveLength(64)
    expect(plain).toMatch(/^[a-f0-9]+$/)
  })

  it('hash é o SHA-256 do plain', () => {
    const { plain, hash } = generateWebhookSecret()
    expect(hash).toBe(hashSha256(plain))
  })

  it('gera secrets únicos a cada chamada', () => {
    const s1 = generateWebhookSecret()
    const s2 = generateWebhookSecret()
    expect(s1.plain).not.toBe(s2.plain)
  })
})

// ─── api-cockpit: signWebhookPayload ─────────────────────────────────────────

describe('signWebhookPayload', () => {
  it('retorna string no formato "sha256=<hex>"', () => {
    const sig = signWebhookPayload('secret123', '{"event":"test"}')
    expect(sig.startsWith('sha256=')).toBe(true)
    expect(sig.slice(7)).toHaveLength(64)
    expect(sig.slice(7)).toMatch(/^[a-f0-9]+$/)
  })

  it('é determinístico — mesmo secret + payload = mesma assinatura', () => {
    const payload = '{"event":"order.created"}'
    const s1 = signWebhookPayload('meu-secret', payload)
    const s2 = signWebhookPayload('meu-secret', payload)
    expect(s1).toBe(s2)
  })

  it('secrets diferentes geram assinaturas diferentes', () => {
    const payload = '{"event":"test"}'
    const s1 = signWebhookPayload('secret-A', payload)
    const s2 = signWebhookPayload('secret-B', payload)
    expect(s1).not.toBe(s2)
  })

  it('payloads diferentes geram assinaturas diferentes', () => {
    const secret = 'meu-secret'
    const s1 = signWebhookPayload(secret, '{"event":"A"}')
    const s2 = signWebhookPayload(secret, '{"event":"B"}')
    expect(s1).not.toBe(s2)
  })
})

// ─── Gabi: chatSchema ─────────────────────────────────────────────────────────

describe('chatSchema', () => {
  const valid = { message: 'Olá Gabi!', product_id: 'prod_123' }

  it('aceita payload mínimo válido', () => {
    expect(chatSchema.safeParse(valid).success).toBe(true)
  })

  it('rejeita mensagem vazia', () => {
    expect(chatSchema.safeParse({ ...valid, message: '' }).success).toBe(false)
  })

  it('rejeita mensagem acima de 8000 caracteres', () => {
    expect(chatSchema.safeParse({ ...valid, message: 'a'.repeat(8001) }).success).toBe(false)
  })

  it('rejeita product_id vazio', () => {
    expect(chatSchema.safeParse({ ...valid, product_id: '' }).success).toBe(false)
  })

  it('aceita conversation_id como null', () => {
    expect(chatSchema.safeParse({ ...valid, conversation_id: null }).success).toBe(true)
  })
})

// ─── Gabi: settingsSchema ─────────────────────────────────────────────────────

describe('settingsSchema', () => {
  it('aceita payload mínimo (apenas product_id)', () => {
    expect(settingsSchema.safeParse({ product_id: 'prod_1' }).success).toBe(true)
  })

  it('rejeita monthly_limit_usd negativo', () => {
    expect(settingsSchema.safeParse({ product_id: 'prod_1', monthly_limit_usd: -1 }).success).toBe(false)
  })

  it('rejeita monthly_limit_usd acima de 10000', () => {
    expect(settingsSchema.safeParse({ product_id: 'prod_1', monthly_limit_usd: 10001 }).success).toBe(false)
  })

  it('aceita flags booleanas', () => {
    expect(settingsSchema.safeParse({
      product_id: 'prod_1',
      alert_at_80_sent: true,
      alert_at_100_sent: false,
    }).success).toBe(true)
  })
})

// ─── Gabi: uploadSchema ───────────────────────────────────────────────────────

describe('uploadSchema', () => {
  it('aceita product_id válido', () => {
    expect(uploadSchema.safeParse({ product_id: 'prod_1' }).success).toBe(true)
  })

  it('rejeita product_id vazio', () => {
    expect(uploadSchema.safeParse({ product_id: '' }).success).toBe(false)
  })
})

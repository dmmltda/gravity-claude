/**
 * Testes de validação dos schemas Zod dos serviços tenant CRUD:
 * atividades, historico, whatsapp, notificacoes, dashboard
 */
import { describe, it, expect } from 'vitest'

import {
  createActivitySchema,
  updateActivitySchema,
  listActivitiesQuerySchema,
} from '../../../servicos-global/tenant/atividades/server/schemas.js'

import {
  listHistoricoSchema,
  statsHistoricoSchema,
} from '../../../servicos-global/tenant/historico/server/schemas.js'

import {
  listConversationsSchema,
  sendMessageSchema,
  closeConversationSchema,
} from '../../../servicos-global/tenant/whatsapp/server/schemas.js'

import {
  testQuerySchema,
  notificationTypeEnum,
} from '../../../servicos-global/tenant/notificacoes/server/schemas.js'

import {
  registerWidgetSchema,
  updateWidgetSchema,
} from '../../../servicos-global/tenant/dashboard/server/schemas.js'

// ─── Atividades ───────────────────────────────────────────────────────────────

describe('createActivitySchema', () => {
  it('aceita payload mínimo válido', () => {
    const r = createActivitySchema.safeParse({ title: 'Reunião', user_id: 'u1' })
    expect(r.success).toBe(true)
  })

  it('rejeita título vazio', () => {
    const r = createActivitySchema.safeParse({ title: '', user_id: 'u1' })
    expect(r.success).toBe(false)
  })

  it('rejeita user_id vazio', () => {
    const r = createActivitySchema.safeParse({ title: 'Tarefa', user_id: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita status inválido', () => {
    const r = createActivitySchema.safeParse({ title: 'T', user_id: 'u1', status: 'unknown' })
    expect(r.success).toBe(false)
  })

  it('aceita todos os status válidos', () => {
    for (const status of ['pending', 'in_progress', 'done', 'cancelled'] as const) {
      const r = createActivitySchema.safeParse({ title: 'T', user_id: 'u1', status })
      expect(r.success).toBe(true)
    }
  })

  it('aplica default status=pending quando não informado', () => {
    const r = createActivitySchema.safeParse({ title: 'T', user_id: 'u1' })
    if (r.success) expect(r.data.status).toBe('pending')
  })

  it('rejeita recording_url inválida', () => {
    const r = createActivitySchema.safeParse({ title: 'T', user_id: 'u1', recording_url: 'nao-e-url' })
    expect(r.success).toBe(false)
  })
})

describe('updateActivitySchema', () => {
  it('aceita objeto parcial — todos os campos são opcionais', () => {
    const r = updateActivitySchema.safeParse({ status: 'done' })
    expect(r.success).toBe(true)
  })

  it('aceita objeto vazio', () => {
    const r = updateActivitySchema.safeParse({})
    expect(r.success).toBe(true)
  })
})

describe('listActivitiesQuerySchema', () => {
  it('aceita query vazia', () => {
    expect(listActivitiesQuerySchema.safeParse({}).success).toBe(true)
  })

  it('rejeita status inválido na query', () => {
    expect(listActivitiesQuerySchema.safeParse({ status: 'invalid' }).success).toBe(false)
  })
})

// ─── Histórico ────────────────────────────────────────────────────────────────

describe('listHistoricoSchema', () => {
  const validBase = {
    from: '2026-03-01T00:00:00.000Z',
    to: '2026-03-31T23:59:59.000Z',
  }

  it('aceita payload mínimo com from e to', () => {
    expect(listHistoricoSchema.safeParse(validBase).success).toBe(true)
  })

  it('rejeita quando from está ausente', () => {
    expect(listHistoricoSchema.safeParse({ to: validBase.to }).success).toBe(false)
  })

  it('rejeita quando to está ausente', () => {
    expect(listHistoricoSchema.safeParse({ from: validBase.from }).success).toBe(false)
  })

  it('rejeita from com formato inválido', () => {
    expect(listHistoricoSchema.safeParse({ from: '2026-03-01', to: validBase.to }).success).toBe(false)
  })

  it('rejeita actor_type inválido', () => {
    expect(listHistoricoSchema.safeParse({ ...validBase, actor_type: 'robot' }).success).toBe(false)
  })

  it('aplica default page=1 e limit=30', () => {
    const r = listHistoricoSchema.safeParse(validBase)
    if (r.success) {
      expect(r.data.page).toBe(1)
      expect(r.data.limit).toBe(30)
    }
  })
})

describe('statsHistoricoSchema', () => {
  it('rejeita sem from ou to', () => {
    expect(statsHistoricoSchema.safeParse({}).success).toBe(false)
  })

  it('aceita from e to válidos', () => {
    expect(statsHistoricoSchema.safeParse({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T00:00:00.000Z',
    }).success).toBe(true)
  })
})

// ─── WhatsApp ────────────────────────────────────────────────────────────────

describe('listConversationsSchema', () => {
  it('aceita query vazia com defaults', () => {
    const r = listConversationsSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.page).toBe(1)
      expect(r.data.limit).toBe(20)
    }
  })

  it('rejeita status inválido', () => {
    expect(listConversationsSchema.safeParse({ status: 'pending' }).success).toBe(false)
  })

  it('rejeita temperatura inválida', () => {
    expect(listConversationsSchema.safeParse({ temperatura: 'morno' }).success).toBe(false)
  })

  it('aceita vinculado como string "true" ou "false"', () => {
    expect(listConversationsSchema.safeParse({ vinculado: 'true' }).success).toBe(true)
    expect(listConversationsSchema.safeParse({ vinculado: 'false' }).success).toBe(true)
  })
})

describe('sendMessageSchema', () => {
  it('aceita texto válido', () => {
    expect(sendMessageSchema.safeParse({ text: 'Olá!' }).success).toBe(true)
  })

  it('rejeita texto vazio', () => {
    expect(sendMessageSchema.safeParse({ text: '' }).success).toBe(false)
  })

  it('rejeita texto acima de 4096 caracteres', () => {
    expect(sendMessageSchema.safeParse({ text: 'a'.repeat(4097) }).success).toBe(false)
  })
})

describe('closeConversationSchema', () => {
  it('aceita objeto vazio', () => {
    expect(closeConversationSchema.safeParse({}).success).toBe(true)
  })

  it('rejeita temperatura_score fora do range 1–5', () => {
    expect(closeConversationSchema.safeParse({ temperatura_score: 0 }).success).toBe(false)
    expect(closeConversationSchema.safeParse({ temperatura_score: 6 }).success).toBe(false)
  })
})

// ─── Notificações ─────────────────────────────────────────────────────────────

describe('notificationTypeEnum', () => {
  it('aceita todos os tipos válidos', () => {
    const types = [
      'mentioned', 'task-assigned', 'reminder', 'next-step',
      'meeting-invite', 'meeting-summary', 'recording', 'gabi-summary',
    ]
    for (const type of types) {
      expect(notificationTypeEnum.safeParse(type).success).toBe(true)
    }
  })

  it('rejeita tipo inválido', () => {
    expect(notificationTypeEnum.safeParse('unknown-type').success).toBe(false)
  })
})

describe('testQuerySchema', () => {
  it('aplica default type=mentioned quando omitido', () => {
    const r = testQuerySchema.safeParse({})
    if (r.success) expect(r.data.type).toBe('mentioned')
  })

  it('aceita type válido', () => {
    expect(testQuerySchema.safeParse({ type: 'reminder' }).success).toBe(true)
  })
})

// ─── Dashboard ────────────────────────────────────────────────────────────────

describe('registerWidgetSchema', () => {
  const validWidget = {
    id: 'widget-vendas',
    title: 'Vendas do Mês',
    component: 'VendasWidget',
    dataSource: '/api/v1/vendas/resumo',
    size: 'md' as const,
  }

  it('aceita payload válido', () => {
    expect(registerWidgetSchema.safeParse(validWidget).success).toBe(true)
  })

  it('aplica default permissions=[]', () => {
    const r = registerWidgetSchema.safeParse(validWidget)
    if (r.success) expect(r.data.permissions).toEqual([])
  })

  it('rejeita size inválido', () => {
    expect(registerWidgetSchema.safeParse({ ...validWidget, size: 'xl' }).success).toBe(false)
  })

  it('rejeita id vazio', () => {
    expect(registerWidgetSchema.safeParse({ ...validWidget, id: '' }).success).toBe(false)
  })
})

describe('updateWidgetSchema', () => {
  it('aceita objeto vazio (todos opcionais)', () => {
    expect(updateWidgetSchema.safeParse({}).success).toBe(true)
  })

  it('rejeita position negativo', () => {
    expect(updateWidgetSchema.safeParse({ position: -1 }).success).toBe(false)
  })

  it('aceita active=false', () => {
    expect(updateWidgetSchema.safeParse({ active: false }).success).toBe(true)
  })
})

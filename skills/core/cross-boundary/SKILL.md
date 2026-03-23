---
name: antigravity-cross-boundary
description: "Use esta skill sempre que uma tarefa envolver ações que afetam dois bancos diferentes — produto chamando serviço de tenant de forma assíncrona, retry com backoff, ou reprocessamento de ações falhas. Define o padrão enqueueTenantAction, retry com backoff exponencial, tabela FailedTenantAction, idempotência e evolução futura para BullMQ. Todo agente consulta esta skill antes de escrever qualquer chamada assíncrona entre produto e serviço de tenant."
---

# Gravity — Cross-Boundary Actions

## O Problema

No Gravity, o **Banco de Produto** e o **Banco de Tenant** são fisicamente separados. Ações que começam no produto mas precisam refletir no tenant (ex: criar uma simulação que gera um log de auditoria no tenant) correm o risco de **"sucesso parcial"**: o produto salva, mas a chamada para o serviço de tenant falha.

---

## O Padrão `enqueueTenantAction`

Toda chamada de produto para serviço de tenant que não for uma simples query (GET/Read) deve usar o padrão de **fila de falha local**.

```typescript
// shared/types/actions.ts
interface TenantAction {
  service:        string   // ex: 'comex', 'fiscal'
  action:         string   // ex: 'sync-simulation', 'create-log'
  payload:        any
  tenantId:       string
  userId:         string   // usuário que originou a ação
  idempotencyKey: string   // chave única para evitar duplicação
  retries?:       number   // padrão: 3
}

async function enqueueTenantAction({
  service,
  action,
  payload,
  tenantId,
  userId,
  idempotencyKey,
  retries = 3
}: TenantAction) {
  // Gerar machine token — JWT do usuário pode ter expirado
  const serviceToken = await getServiceToken(tenantId, userId)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fetch(
        `${process.env.TENANT_SERVICES_URL}/api/tenant/${service}/${action}`,
        {
          method: 'POST',
          headers: {
            'Authorization':     `Bearer ${serviceToken}`,
            'X-Idempotency-Key': idempotencyKey,
            'Content-Type':      'application/json'
          },
          body: JSON.stringify(payload)
        }
      )
      return { success: true }
    } catch (error) {
      // Backoff exponencial: 1s, 2s, 4s...
      const delay = Math.pow(2, attempt - 1) * 1000
      await new Promise(res => setTimeout(res, delay))
    }
  }

  // Se chegou aqui, falhou todas as tentativas → Dead Letter Table local
  await prisma.failedTenantAction.create({
    data: {
      service,
      action,
      payload,
      tenantId,
      userId,
      idempotencyKey,
      errorLog: 'Max retries reached',
      status: 'PENDING'
    }
  })
}
```

---

## Como Usar o `enqueueTenantAction`

Sempre chame **após** a transação de banco local do produto ter sucesso:

```typescript
// produtos/simulador-comex/server/routes/simulacoes.ts
router.post('/', async (req, res) => {
  const sim = await prisma.simulacao.create({ data: req.body })

  // Ação cross-boundary: não bloqueia a resposta ao usuário
  enqueueTenantAction({
    service:        'comex',
    action:         'sync-simulation',
    payload:        sim,
    tenantId:       req.tenantId,
    userId:         req.user.id,
    idempotencyKey: `sim_${sim.id}`
  }).catch(err => console.error('Silent failure enqueued', err))

  res.status(201).json(sim)
})
```

---

## A Tabela `FailedTenantAction` (Banco de Produto)

Esta tabela deve existir no schema de todos os produtos que falam com serviços de tenant:

| Campo | Tipo | Descrição |
|:---|:---|:---|
| `id` | UUID | PK |
| `service` | String | Nome do microserviço de destino |
| `action` | String | Endpoint/Ação sendo executada |
| `payload` | JSON | Dados completos da requisição |
| `idempotencyKey` | String | Única por ação (ex: `order_123`) |
| `status` | Enum | `PENDING`, `PROCESSING`, `FAILED`, `COMPLETED` |
| `errorLog` | Text | Último erro recebido |
| `attempts` | Int | Contador de tentativas totais |

---

## Reprocessamento Automático — Cron Job

Um cron job rodando a cada 5 minutos busca registros `PENDING` ou `FAILED` (com < 10 tentativas):

```typescript
const failed = await prisma.failedTenantAction.findMany({
  where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: 10 } }
})

for (const action of failed) {
  await prisma.failedTenantAction.update({
    where: { id: action.id },
    data: { status: 'PROCESSING' }
  })

  const res = await enqueueTenantAction(action)

  if (res.success) {
    await prisma.failedTenantAction.update({
      where: { id: action.id },
      data: { status: 'COMPLETED' }
    })
  } else {
    await prisma.failedTenantAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', attempts: { increment: 1 } }
    })
  }
}
```

---

## Idempotência — Evitar Duplicação

O serviço de tenant **deve** verificar a `X-Idempotency-Key` antes de processar:

1. Verifica se já existe um registro com essa chave no banco (tabela `processed_actions`)
2. Se sim, retorna 200 OK imediatamente sem reprocessar

---

## Chamadas Paralelas — Múltiplos Serviços de Tenant

Quando uma ação dispara ações em múltiplos serviços:

- **NUNCA** use `await` sequencial que dependa de ambos
- Use `Promise.allSettled` e `enqueueTenantAction` para cada um separadamente
- Isso garante que se o Fiscal falhar, o Comex não seja bloqueado e vice-versa

---

## Evolução Futura — BullMQ

Para alta escala (milhares de ações/segundo), a tabela `FailedTenantAction` será substituída por **BullMQ (Redis)**. O contrato da função `enqueueTenantAction` é mantido para que a mudança seja transparente para os chamadores.

---

## Checklist — Antes de Escrever Qualquer Cross-Boundary

- [ ] A ação de destino (no tenant) é idempotente?
- [ ] O banco de produto tem a tabela `FailedTenantAction` no schema?
- [ ] O `idempotencyKey` é determinístico (ex: baseado no ID do registro original)?
- [ ] A chamada está **fora** da transação principal do banco (para não dar rollback no produto se o tenant demorar)?

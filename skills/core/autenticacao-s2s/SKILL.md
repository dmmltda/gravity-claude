---
name: antigravity-autenticacao-s2s
description: "Use esta skill sempre que uma tarefa envolver comunicação service-to-service (S2S) — produto chamando serviço de tenant, serviço de tenant chamando Configurador, ou qualquer requisição entre serviços. Define os dois fluxos de autenticação (JWT Síncrono e Machine Token Assíncrono), quando usar cada um, como propagar o x-internal-key, a ordem dos middlewares e idempotência. Todo agente consulta esta skill antes de escrever qualquer chamada entre serviços."
---

# Gravity — Autenticação S2S (Service-to-Service)

## Por Que Dois Fluxos

A autenticação JWT do Clerk tem **expiração curta** (tipicamente 1 hora). Isso cria um problema para ações assíncronas e jobs em background: o token do usuário pode ter expirado antes do job executar.

A solução é ter dois fluxos distintos:

| Situação | Fluxo |
|:---|:---|
| Usuário fez a ação agora e está na tela | **JWT Síncrono** — propagar token do usuário |
| Job, cron, retry ou ação em background | **Machine Token** — token de serviço sem expiração curta |

---

## Fluxo 1 — JWT Síncrono

Usado quando o usuário está ativo e o token Clerk é válido. O produto simplesmente propaga o JWT do usuário para o serviço de tenant.

```typescript
// Propagando JWT do usuário na chamada para serviço de tenant
async function callTenantService(
  endpoint: string,
  req: Request,
  body?: unknown
) {
  return fetch(`${process.env.TENANT_SERVICES_URL}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Authorization':    `Bearer ${req.auth.token}`,  // ← JWT do usuário
      'x-internal-key':   process.env.INTERNAL_SERVICE_KEY!,
      'x-correlation-id': req.correlationId,
      'Content-Type':     'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
}
```

**Quando usar:**
- Ações disparadas diretamente pelo usuário via UI
- Qualquer chamada dentro de um request-response síncrono
- Quando o token ainda é válido e o usuário está ativo

---

## Fluxo 2 — Machine Token (Service Token)

Usado para ações assíncronas, cron jobs e retries onde o JWT do usuário pode ter expirado. O serviço usa um token de serviço próprio.

```typescript
// Gerando um service token para ação assíncrona
async function getServiceToken(
  tenantId: string,
  userId: string
): Promise<string> {
  // O Configurador emite tokens de serviço com vida longa
  const response = await fetch(
    `${process.env.CONFIGURATOR_URL}/api/internal/service-token`,
    {
      method: 'POST',
      headers: {
        'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
        'Content-Type':   'application/json'
      },
      body: JSON.stringify({ tenantId, userId, scope: 'service' })
    }
  )
  const { token } = await response.json()
  return token
}

// Usando o service token em chamada assíncrona
async function callTenantServiceAsync(
  endpoint: string,
  tenantId: string,
  userId: string,
  body: unknown,
  idempotencyKey: string
) {
  const serviceToken = await getServiceToken(tenantId, userId)

  return fetch(`${process.env.TENANT_SERVICES_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization':     `Bearer ${serviceToken}`,
      'x-internal-key':    process.env.INTERNAL_SERVICE_KEY!,
      'X-Idempotency-Key': idempotencyKey,
      'Content-Type':      'application/json'
    },
    body: JSON.stringify(body)
  })
}
```

**Quando usar:**
- Cron jobs e processamento em background
- Retries de ações que falharam (ver `antigravity-cross-boundary`)
- Qualquer ação que pode demorar mais de 1 hora para ser tentada

---

## Segurança — x-internal-key

O `x-internal-key` é uma camada adicional de defesa (defense-in-depth). **Todo** serviço deve validar essa chave em chamadas internas, mesmo que o JWT seja válido.

```typescript
// middleware/internal-auth.ts
export function requireInternalKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.headers['x-internal-key']
  if (key !== process.env.INTERNAL_SERVICE_KEY) {
    throw new AppError('Chave interna inválida', 401, 'UNAUTHORIZED')
  }
  next()
}
```

> **Regra:** `INTERNAL_SERVICE_KEY` deve ser rotacionada a cada trimestre.

---

## Ordem dos Middlewares no Servidor de Tenant

```typescript
// Ordem obrigatória para servidores de tenant
app.use(correlationMiddleware)   // 1. Correlation ID
app.use(requireInternalKey)      // 2. Valida x-internal-key
app.use(requireAuth)             // 3. Valida JWT (Clerk ou Machine Token)
app.use(tenantIsolation)         // 4. Injeta tenant isolation no Prisma
```

---

## Tabela de Decisão — Qual Fluxo Usar

| Cenário | Fluxo | Token |
|:---|:---|:---|
| Usuário clicou em "Salvar" na UI | JWT Síncrono | `req.auth.token` |
| Webhook recebido de sistema externo | Machine Token | `getServiceToken()` |
| Cron job diário de relatórios | Machine Token | `getServiceToken()` |
| Retry de ação falha (cross-boundary) | Machine Token | `getServiceToken()` |
| Export de dados disparado pelo usuário | JWT Síncrono (se rápido) ou Machine Token (se demorado) | Avaliar tempo |
| Notificação automática ao completar job | Machine Token | `getServiceToken()` |

---

## Idempotência em Chamadas S2S

Para evitar processamento duplicado em retries:

```typescript
// O serviço receptor deve verificar idempotência
async function processAction(idempotencyKey: string, payload: unknown) {
  // 1. Verificar se já foi processado
  const existing = await prisma.processedAction.findUnique({
    where: { idempotencyKey }
  })
  if (existing) return { success: true, cached: true }

  // 2. Processar a ação
  const result = await doAction(payload)

  // 3. Registrar como processado
  await prisma.processedAction.create({
    data: { idempotencyKey, processedAt: new Date() }
  })

  return { success: true, result }
}
```

---

## Checklist — Antes de Qualquer Chamada S2S

- [ ] A chamada é síncrona (UI ativa)? → usar Fluxo 1 (JWT do usuário)
- [ ] A chamada é assíncrona (job, cron, retry)? → usar Fluxo 2 (Machine Token)
- [ ] O `x-internal-key` está sendo enviado em toda chamada interna?
- [ ] O `x-correlation-id` está sendo propagado?
- [ ] Se for retry/job, tem `X-Idempotency-Key` para evitar duplicação?

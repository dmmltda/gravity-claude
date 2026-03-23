---
name: antigravity-admin
description: "Use esta skill sempre que uma tarefa envolver o painel administrativo interno do Gravity — exclusivo para a equipe Gravity, não para clientes. Cobre: gestão de todos os tenants (empresas mãe e filhas), produtos contratados, usuários e permissões globais, financeiro consolidado, histórico de alterações global, painel de deploy Railway, configurações da Gabi por tenant, consumo de recursos, e monitoramento de APIs em tempo real (clientes e dependências externas) com alertas de queda."
---

# Gravity — Painel Admin (Interno)

## O Que é Este Painel

Interface exclusiva da equipe Gravity para gerenciar a plataforma como um todo. **Não é o Configurador** (que é para o cliente).

- **Quem acessa:** apenas usuários com role `gravity_admin` — membros internos da equipe Gravity com acesso privilegiado
- **Princípio:** visibilidade total de todos os tenants, produtos, usuários, consumo, deploys e saúde da plataforma em um único lugar

---

## Posição na Arquitetura

O painel Admin vive **dentro do Configurador** como mais uma page, protegida por middleware:

```text
servicos-global/configurador/
└── src/pages/
    ├── workspace/          ← área do cliente
    ├── usuarios/
    ├── permissoes/
    ├── assinaturas/
    └── admin/              ← área exclusiva gravity_admin
        ├── AdminLayout.tsx
        ├── tenants/
        ├── financeiro/
        ├── deploy/
        ├── gabi/
        ├── consumo/
        └── apis/           ← monitor de APIs em tempo real
```

```typescript
// Middleware que protege todas as rotas /admin/*
function requireGravityAdmin(req, res, next) {
  if (req.auth.role !== 'gravity_admin') {
    return res.status(403).json({ error: 'Acesso restrito à equipe Gravity' })
  }
  next()
}
```

---

## Tela 1 — Tenants

**Stat cards:** Total de Tenants | Tenants Ativos | Tenants em Trial | Tenants Churn (últimos 30 dias)

| Coluna | Descrição |
|:---|:---|
| EMPRESA | Nome da empresa mãe |
| CNPJ | CNPJ da empresa |
| STATUS | Ativo / Trial / Suspenso / Churned |
| PRODUTOS | Badges dos produtos contratados |
| EMPRESAS FILHAS | Quantidade de filiais |
| USUÁRIOS | Total de usuários ativos |
| PLANO | Básico / Pro / Enterprise |
| CRIADO EM | Data de cadastro |
| AÇÕES | Ver detalhes / Suspender / Excluir |

---

## Tela 2 — Produtos Contratados

Visão de quais produtos cada tenant tem ativo.

| Tenant | Produto | Plano | Contratado em | Vencimento | Status |
|:---|:---|:---|:---|:---|:---|
| AgroMax | Simulador Comex | Pro | 01/01/2026 | 01/01/2027 | Ativo |

---

## Tela 3 — Usuários e Permissões (Global)

Todos os usuários de todos os tenants em uma única visão.

**Ações por usuário:**
- Ver permissões detalhadas
- Suspender acesso
- Resetar senha (força reset no próximo login)
- **Impersonar usuário** (para suporte) — com **registro obrigatório** no histórico

> ⚠️ **Impersonação:** quando um admin Gravity assume a sessão de um usuário para suporte, isso é registrado no histórico com: `actor_type: 'gravity_admin'`, `triggered_by: adminId`, `impersonating: userId`.

---

## Tela 4 — Financeiro

**Stat cards:** MRR | ARR | Churn do mês | Novos contratos do mês

---

## Tela 5 — Histórico de Alterações Global

Igual ao histórico de alterações do tenant, mas com visão de todos os tenants.

**Filtros adicionais:** Por tenant | Por tipo de ator: usuário, Gabi AI, sistema, Gravity Admin

**Importante:** o Gravity Admin que acessa o histórico de outro tenant gera um log próprio:
```text
action: 'ACESSO_ADMIN', entity: 'historico',
description: 'Admin Gravity visualizou histórico do tenant X'
```

---

## Tela 6 — Deploy

Painel de controle de deploys de todos os serviços no Railway.

| Serviço | Ambiente | Versão | Status | Último deploy | Uptime | Ações |
|:---|:---|:---|:---|:---|:---|:---|
| configurador | production | v2.1.4 | 🟢 Online | há 2h | 99.9% | Deploy / Rollback |
| tenant-services | production | v1.8.2 | 🟢 Online | há 5h | 100% | Deploy / Rollback |
| simulador-comex | production | v3.0.1 | 🟡 Alerta | há 1h | 98.2% | Deploy / Rollback |

---

## Tela 7 — Gabi AI (Global)

| Tenant | Chamadas | Custo (USD) | % do limite | Status |
|:---|:---|:---|:---|:---|
| AgroMax | 1.243 | $8.40 | 42% | 🟢 Normal |
| ConstrutArt | 891 | $15.80 | 79% | 🟡 Alerta |

---

## Tela 9 — Monitor de APIs (Tempo Real)

Monitora dois tipos:
1. **APIs de clientes** — clientes consumindo os serviços do Gravity via API sem frontend (integração com ERP, WMS, etc.)
2. **APIs externas** — dependências da plataforma (Resend, Meta, Gemini, Clerk, Stripe, Receita Federal, Railway)

**APIs externas:**

| API | Status | Latência | Uptime 30d |
|:---|:---|:---|:---|
| Resend | 🟢 Online | 120ms | 99.9% |
| Meta Cloud API | 🟢 Online | 89ms | 99.8% |
| Google Gemini | 🟡 Degradada | 2.400ms | 99.1% |
| Clerk | 🟢 Online | 45ms | 100% |
| Stripe | 🟢 Online | 230ms | 99.9% |
| Receita Federal | 🟢 Online | 890ms | 97.2% |

**Alertas automáticos:**
- API externa offline → email + WhatsApp para equipe Gravity
- Latência > 3x a média → status "Degradada" + alerta

---

## Middleware de Observabilidade

```typescript
export function apiObservabilityMiddleware(req, res, next) {
  const start = Date.now()

  res.on('finish', () => {
    const latency = Date.now() - start
    setImmediate(() => {
      prisma.apiRequestLog.create({
        data: {
          tenant_id:   req.auth.tenantId,
          endpoint:    req.path,
          method:      req.method,
          status_code: res.statusCode,
          latency_ms:  latency,
          api_key_id:  req.auth?.apiKeyId,
          created_at:  new Date()
        }
      }).catch(console.error)

      checkApiAlerts(req.auth.tenantId, req.path, res.statusCode, latency)
    })
  })
  next()
}
```

---

## Schema Prisma

```prisma
model ApiKey {
  id           String    @id @default(cuid())
  tenant_id    String
  name         String
  key_hash     String    @unique  // hash SHA-256 — nunca plain text
  key_preview  String             // últimos 4 chars para exibição
  scopes       Json               // endpoints permitidos
  rate_limit   Int       @default(60)  // req/min
  expires_at   DateTime?
  active       Boolean   @default(true)
  last_used_at DateTime?
  created_at   DateTime  @default(now())

  @@index([tenant_id])
  @@index([key_hash])
}

model ApiRequestLog {
  id          String   @id @default(cuid())
  tenant_id   String
  api_key_id  String?
  endpoint    String
  method      String
  status_code Int
  latency_ms  Int
  created_at  DateTime @default(now())

  @@index([tenant_id])
  @@index([tenant_id, created_at])
  @@index([tenant_id, status_code])
  @@index([api_key_id])
}

model ApiMonitor {
  id               String    @id @default(cuid())
  name             String
  service          String
  health_check_url String
  timeout_ms       Int       @default(5000)
  check_interval_s Int       @default(30)
  current_status   String    @default("unknown")
  current_latency  Int?
  last_checked_at  DateTime?
  created_at       DateTime  @default(now())
}

model ApiIncident {
  id          String    @id @default(cuid())
  api_id      String
  status      String
  started_at  DateTime  @default(now())
  resolved_at DateTime?
  duration_s  Int?
  error_msg   String?
}

model GravityAdmin {
  id         String   @id @default(cuid())
  clerk_id   String   @unique
  name       String
  email      String   @unique
  role       String   @default("gravity_admin")  // gravity_admin | gravity_viewer
  active     Boolean  @default(true)
  created_at DateTime @default(now())
}
```

---

## Checklist

- [ ] Painel Admin exclusivo para role `gravity_admin`?
- [ ] Impersonação de usuário com log obrigatório?
- [ ] Painel de Deploy Railway com logs e métricas em tempo real?
- [ ] Gestão de API Keys com escopo, rate limit e expiração?
- [ ] APIs externas com health check a cada 30s e histórico de incidentes?
- [ ] Alertas de queda via email e WhatsApp para equipe Gravity?
- [ ] Schema com ApiKey, ApiRequestLog, ApiMonitor, ApiIncident?

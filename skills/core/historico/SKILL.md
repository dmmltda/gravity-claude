---
name: antigravity-historico
description: "Use esta skill sempre que uma tarefa envolver o serviço de histórico de alterações da plataforma Gravity. Define auditoria completa de tudo que acontece no produto — criação, edição, exclusão, envio de email, resposta de email, geração de relatório, pesquisa, filtros, e qualquer outra ação. Registra quem fez (usuário ou Gabi AI), quando, o que foi feito, e o diff Campo/Antes/Depois. Interface com busca, filtros, colunas com filtro individual e expansão de detalhe por linha. Inclui 6 barreiras de segurança para garantir integridade e imutabilidade dos logs."
---

# Gravity — Serviço de Histórico de Alterações

## O Que é Este Serviço

Serviço de tenant — auditoria completa, não fragmentada por produto. Um único registro cronológico de tudo que aconteceu no tenant, de todos os produtos.

> **Princípio:** "Registro completo de quem fez o quê e quando no sistema."

> **Regra absoluta:** tudo é registrado. Não existe ação no sistema que não gere um log no histórico. Sem exceção.

---

## O Que Deve Ser Registrado (Tudo)

**Dados:**
- Criou um registro (empresa, contato, nota fiscal, simulação, etc.)
- Editou um campo de qualquer registro
- Excluiu um registro
- Importou dados (CSV, Excel, XML)
- Exportou dados

**Comunicação:**
- Enviou/recebeu/respondeu email
- Enviou/recebeu mensagem WhatsApp
- Encerrou conversa WhatsApp

**Atividades e tempo:**
- Criou/alterou status de atividade
- Iniciou/parou/lançou manualmente cronômetro

**Relatórios e dashboard:**
- Gerou, exportou, salvou, agendou, atualizou dashboard/relatório

**Navegação e interface:**
- Realizou pesquisa, aplicou filtro, alterou colunas visíveis

**Configurações:**
- Alterou configuração do sistema/Gabi AI/credenciais/tokens
- Convidou usuário / Alterou permissão de usuário

---

## 6 Barreiras de Segurança

### Barreira 1 — Ator Explícito e Obrigatório

Nunca inferir o ator pelo contexto da requisição HTTP. O ator deve ser declarado explicitamente:

```typescript
// ❌ ERRADO — infere o ator do req.auth (pode ser herdado)
auditMiddleware('ALTERAÇÃO', 'empresa', 'Empresa')

// ✅ CORRETO — ator declarado explicitamente
auditMiddleware('ALTERAÇÃO', 'empresa', 'Empresa', {
  actorType: 'user',
  actorId: req.auth.userId,
  actorName: req.auth.userName
})

// ✅ CORRETO — serviço de background declara que é sistema
auditMiddleware('CONSULTA', 'receita_federal', 'Receita Federal', {
  actorType: 'system',
  actorId: null,
  actorName: 'Consulta Receita Federal'
})

// ✅ CORRETO — Gabi declara que é IA
auditMiddleware('ENVIO', 'email', 'E-mail', {
  actorType: 'gabi',
  actorId: null,
  actorName: 'Gabi AI'
})
```

### Barreira 2 — Separação de Contexto HTTP vs Background

```typescript
// Contexto HTTP (usuário presente):
interface UserContext {
  actorType: 'user'
  actorId:   string    // ID real do usuário autenticado
  actorName: string    // nome do usuário
  sessionId: string    // ID da sessão Clerk
}

// Contexto de background (sem usuário):
interface SystemContext {
  actorType: 'system'
  actorId:   null      // NUNCA um ID de usuário
  actorName: string    // nome do serviço (ex: 'Cron: Receita Federal')
  serviceId: string    // ID do serviço que executou
}

// Contexto da Gabi:
interface GabiContext {
  actorType:  'gabi'
  actorId:    null
  actorName:  'Gabi AI'
  modelUsed:  string   // ex: 'gemini-2.5-flash'
}
```

> **Regra:** cron jobs e integrações externas usam sempre `SystemContext`. É fisicamente impossível passar `UserContext` para um job em background.

### Barreira 3 — Logs São Imutáveis

Nenhum log pode ser editado ou deletado após a gravação:

```typescript
model AuditLog {
  // Sem updated_at — log não é editável
  // Sem deleted_at — log não tem soft delete
  // Sem is_deleted — log não pode ser ocultado
}
```

Se um log foi gravado errado: o sistema grava um **novo log de correção** explicando o erro — nunca edita o log original:

```typescript
await prisma.auditLog.create({
  data: {
    action:      'CORRECAO',
    description: 'Log anterior gravado incorretamente — ação era do sistema, não do usuário',
    actor_type:  'system',
    actor_name:  'Correção de Auditoria',
    related_log_id: idDoLogIncorreto,
  }
})
```

### Barreira 4 — Checksum de Integridade

```typescript
import { createHash } from 'crypto'

function computeLogHash(log: AuditLogData): string {
  const payload = JSON.stringify({
    tenant_id:   log.tenant_id,
    actor_id:    log.actor_id,
    actor_type:  log.actor_type,
    action:      log.action,
    entity_id:   log.entity_id,
    description: log.description,
    diff:        log.diff,
    created_at:  log.created_at.toISOString()
  })
  return createHash('sha256').update(payload).digest('hex')
}
```

Job semanal recalcula o hash de todos os logs e alerta via Sentry se houver discrepância.

### Barreira 5 — Identificação de Origem em Integrações

```typescript
// Chamada à Receita Federal
await logAudit({
  actorType:     'system',
  actorName:     'Integração Receita Federal',
  action:        'CONSULTA_EXTERNA',
  entity:        'receita_federal',
  description:   `Consulta CNPJ ${cnpj} via API Receita Federal`,
  sourceService: 'receita-federal-api',  // campo obrigatório para externos
  triggeredBy:   req.auth.userId         // quem iniciou o fluxo (não o ator)
})
```

> `actorId` = quem executou (o sistema). `triggeredBy` = quem disparou o fluxo (o usuário).

### Barreira 6 — Alerta de Anomalia

```typescript
const ANOMALY_THRESHOLD = { count: 50, windowSeconds: 10 }

async function checkAnomalyAfterLog(tenantId: string, actorId: string) {
  const recent = await prisma.auditLog.count({
    where: {
      tenant_id:  tenantId,
      actor_id:   actorId,
      created_at: { gte: new Date(Date.now() - ANOMALY_THRESHOLD.windowSeconds * 1000) }
    }
  })
  if (recent > ANOMALY_THRESHOLD.count) {
    Sentry.captureMessage(`Anomalia no histórico: ${recent} logs em ${ANOMALY_THRESHOLD.windowSeconds}s para o ator ${actorId}`)
  }
}
```

### Resumo das Barreiras

| Barreira | O que previne |
|:---|:---|
| 1 — Ator explícito obrigatório | Serviço de background registrar como usuário |
| 2 — Contexto separado HTTP vs background | Herança de contexto entre requisições |
| 3 — Logs imutáveis | Adulteração ou ocultação de evidências |
| 4 — Checksum de integridade | Alteração direta no banco de dados |
| 5 — Serviços externos identificados | Ação de API externa atribuída a usuário |
| 6 — Alerta de anomalia | Loops, bugs e ações em massa silenciosas |

---

## Implementação — Middleware

```typescript
// servicos-global/tenant/historico/server/middleware/audit.ts
export function auditMiddleware(
  action: string,
  entity: string,
  entityLabel: string
) {
  return async (req, res, next) => {
    const before = await captureState(req)

    const originalJson = res.json.bind(res)
    res.json = async (body) => {
      const after = await captureState(req, body)

      // Grava o log de forma assíncrona — não bloqueia a resposta
      setImmediate(() => {
        prisma.auditLog.create({
          data: {
            tenant_id:      req.auth.tenantId,
            actor_id:       req.auth.userId,
            actor_type:     req.auth.isGabi ? 'gabi' : 'user',
            actor_name:     req.auth.isGabi ? 'Gabi AI' : req.auth.userName,
            action,
            entity,
            entity_label:   entityLabel,
            entity_id:      body?.id || req.params?.id,
            description:    buildDescription(action, entityLabel, before, after),
            diff:           buildDiff(before, after),
            integrity_hash: computeLogHash({/*...*/}),
            product_id:     req.auth.productId,
            ip_address:     req.ip,
            user_agent:     req.headers['user-agent'],
          }
        })
      }).catch(console.error)

      return originalJson(body)
    }

    next()
  }
}

// Uso nas rotas:
app.put('/api/v1/empresas/:id',
  auditMiddleware('ALTERAÇÃO', 'empresa', 'Empresa'),
  async (req, res) => { /* ... */ }
)
```

---

## Interface — Tela Principal

**Filtros:**
```text
[🔍 Pesquisar...]  [Todas as ações ▼]  [Quem ▼]  [Módulo ▼]  [Data de___] até [___]
```

**Tabela:**

| Coluna | Descrição |
|:---|:---|
| QUANDO | Data e hora da ação |
| QUEM | Nome do usuário ou "Gabi AI" |
| AÇÃO | Badge colorido (ver legenda) |
| O QUE FOI FEITO | Tag do módulo + descrição legível |
| MÓDULO | Nome do módulo afetado com ícone |
| ▼ | Expansão — abre diff Campo/Antes/Depois |

### Linha Expandida — Diff

| CAMPO | ANTES | DEPOIS |
|:---|:---|:---|
| status | Ativo | Inativo |
| email | antigo@email.com | novo@email.com |

- Valor ANTES → texto vermelho
- Valor DEPOIS → texto verde

### Legenda de Badges

| Ação | Cor | Quando usar |
|:---|:---|:---|
| CRIAÇÃO | verde | Novo registro criado |
| ALTERAÇÃO | azul | Campo editado |
| EXCLUSÃO | vermelho | Registro deletado |
| ENVIO | roxo | Email ou WhatsApp enviado |
| RECEBIMENTO | âmbar | Email ou WhatsApp recebido |
| EXPORTAÇÃO | cinza | Relatório exportado |
| LOGIN | teal | Acesso ao sistema |
| CONFIGURAÇÃO | laranja | Configuração alterada |
| IA | índigo | Ação executada pela Gabi AI |

### Identificação de Atores

| Actor | Ícone | Exibição |
|:---|:---|:---|
| Usuário humano | 👤 | Nome do usuário |
| Gabi AI | 🤖 | "Gabi AI" com badge IA |
| Sistema | ⚙️ | "Sistema" |

---

## Rotas da API

```typescript
GET /api/v1/historico       ← listar logs com filtros e paginação
GET /api/v1/historico/:id   ← log específico com diff completo
GET /api/v1/historico/stats ← contagem por tipo de ação e período
```

---

## Schema Prisma (fragment.prisma)

```prisma
// servicos-global/tenant/historico/prisma/fragment.prisma

model AuditLog {
  id           String  @id @default(cuid())
  tenant_id    String
  product_id   String?           // qual produto gerou a ação

  // Ator
  actor_id     String?           // null = sistema/cron
  actor_type   String  @default("user")  // user | gabi | system
  actor_name   String

  // Ação
  action       String            // CRIAÇÃO | ALTERAÇÃO | EXCLUSÃO | ENVIO | etc.
  entity       String            // chave do módulo
  entity_label String            // nome legível do módulo
  entity_id    String?           // ID do registro afetado
  description  String            // texto legível do que foi feito

  // Diff
  diff         Json?             // [{ field, label, before, after }]

  // Integridade
  integrity_hash String?         // SHA256 do log (imutável)

  // Contexto
  ip_address   String?
  user_agent   String?
  created_at   DateTime @default(now())

  // Sem updated_at — logs são IMUTÁVEIS

  @@index([tenant_id])
  @@index([tenant_id, actor_id])
  @@index([tenant_id, action])
  @@index([tenant_id, entity])
  @@index([tenant_id, created_at])
  @@index([tenant_id, product_id])
}
```

**Estrutura do campo diff (JSON):**
```json
[
  { "field": "status", "label": "Status", "before": "Ativo", "after": "Inativo" },
  { "field": "email",  "label": "E-mail", "before": "antigo@email.com", "after": "novo@email.com" }
]
```

---

## Performance — Particionamento

> O histórico é a tabela de **maior volume** do sistema.

- Particionamento mensal obrigatório
- Cleanup após 12 meses (configurável por tenant)
- **Regra:** toda query obrigatoriamente filtra por `tenant_id` + range de `created_at`. Nunca fazer full scan.

---

## Checklist — Antes de Entregar

- [ ] Ator explícito obrigatório em toda chamada — middleware rejeita se não declarado?
- [ ] Contextos separados: `UserContext`, `SystemContext`, `GabiContext` — nunca misturar?
- [ ] Serviços de background usam `SystemContext` — impossível herdar contexto HTTP?
- [ ] Logs imutáveis — sem PUT, sem DELETE, sem soft delete?
- [ ] Logs incorretos corrigidos com novo log de correção, nunca editando o original?
- [ ] Checksum de integridade (SHA256) gravado em cada linha?
- [ ] Alerta de anomalia configurado (Sentry)?
- [ ] Interface com diff Campo/Antes/Depois legível?
- [ ] Módulo identificado com nome e ícone intuitivo?
- [ ] Particionamento por `tenant_id + created_at` em todas as queries?

---
name: antigravity-schema-composition
description: "Use esta skill sempre que uma tarefa envolver criação ou modificação de schemas Prisma, fragments, scripts de composição ou migrations. Define por que os fragments existem, como o Coordenador compõe o schema final, regras de naming, índices obrigatórios e o que nunca editar diretamente. Todo agente consulta esta skill antes de tocar em qualquer arquivo .prisma."
---

# Gravity — Schema Composition

## Por Que Fragments Existem

Na Onda 3, até 10 agentes trabalham em paralelo construindo serviços de tenant. Cada agente precisa definir seus próprios models Prisma. Se todos escrevessem no mesmo `schema.prisma`, haveria conflitos constantes e o trabalho paralelo seria impossível.

A solução: cada agente escreve apenas seu `fragment.prisma` isolado. O Coordenador compõe o schema final. Nenhum agente toca no arquivo final.

> **Regra absoluta:** nenhum agente edita `schema.prisma` diretamente. Apenas o Coordenador, via script de composição.

---

## Os Dois Tipos de Composição

### 1. Composição do DB servicos-tenant

Cada serviço de tenant contribui com um fragment:

```text
servicos-global/tenant/
├── atividades/prisma/fragment.prisma
├── cronometro/prisma/fragment.prisma
├── email/prisma/fragment.prisma
├── whatsapp/prisma/fragment.prisma
├── dashboard/prisma/fragment.prisma
├── relatorios/prisma/fragment.prisma
├── historico/prisma/fragment.prisma
├── agendamento/prisma/fragment.prisma
└── gabi/prisma/fragment.prisma
```

Resultado final gerado em:
`servicos-global/tenant/prisma/schema.prisma` (composto de `schema.base.prisma` + todos os fragments)

### 2. Composição do DB de cada produto

```text
produtos/simulador-comex/server/prisma/
├── schema.base.prisma   ← modelos do produto + datasource + generator
└── schema.prisma        ← composto (base + fragments dos serviços de produto)

servicos-global/produto/helpdesk/prisma/
└── fragment.prisma      ← composto no schema do produto
```

---

## O Script de Composição — DB servicos-tenant

O Coordenador executa este script antes de `prisma generate` e `prisma migrate`:

```typescript
// scripts/compose-tenant-schema.ts
import fs from 'fs'
import path from 'path'

const TENANT_DIR = 'servicos-global/tenant'
const services = [
  'atividades',
  'cronometro',
  'email',
  'whatsapp',
  'dashboard',
  'relatorios',
  'historico',
  'agendamento',
  'gabi'
]

const base = fs.readFileSync(
  path.join(TENANT_DIR, 'prisma/schema.base.prisma'), 'utf8'
)

const fragments = services.map(s =>
  fs.readFileSync(
    path.join(TENANT_DIR, s, 'prisma/fragment.prisma'), 'utf8'
  )
)

const composed = [base, ...fragments].join('\n\n')

fs.writeFileSync(
  path.join(TENANT_DIR, 'prisma/schema.prisma'), composed
)

console.log('Schema composto com sucesso.')
```

---

## O Script de Composição — DB de produto

```javascript
// produtos/simulador-comex/scripts/compose-schema.js
const fs = require('fs')
const path = require('path')

const base = fs.readFileSync(
  'server/prisma/schema.base.prisma', 'utf8'
)

const helpdesk = fs.readFileSync(
  '../../servicos-global/produto/helpdesk/prisma/fragment.prisma', 'utf8'
)

const composed = [base, helpdesk].join('\n\n')

fs.writeFileSync('server/prisma/schema.prisma', composed)
```

---

## O schema.base.prisma — Nunca Modificar

O arquivo base contém apenas o datasource e o generator. Nenhum agente adiciona models aqui — models vão nos fragments:

```prisma
// servicos-global/tenant/prisma/schema.base.prisma

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("TENANT_DATABASE_URL")
}
```

---

## Como Escrever um fragment.prisma Correto

### Regras de naming

| Elemento | Convenção | Exemplo |
|:---|:---|:---|
| Nome do model | PascalCase | `Activity`, `EmailMessage` |
| Nome dos campos | snake_case | `tenant_id`, `created_at` |
| Nome dos índices | automático pelo Prisma | — |
| Enum values | UPPER_SNAKE_CASE | `IN_PROGRESS`, `DONE` |

### Estrutura obrigatória de todo model

```prisma
model NomeDoModel {
  // 1. ID sempre primeiro
  id         String @id @default(cuid())

  // 2. Campos de isolamento — obrigatórios
  tenant_id  String
  product_id String?  // nullable — só quando dado pode ter contexto de produto
  user_id    String?  // nullable — quando aplicável ao modelo

  // 3. Campos específicos do modelo
  title      String
  status     String
  // ...

  // 4. Timestamps sempre por último
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  // 5. Índices obrigatórios — sempre os três
  @@index([tenant_id])
  @@index([tenant_id, product_id])
  @@index([tenant_id, user_id])
}
```

### Exemplo completo — fragment de atividades

```prisma
// servicos-global/tenant/atividades/prisma/fragment.prisma

enum ActivityStatus {
  PENDING
  IN_PROGRESS
  DONE
  CANCELED
}

model Activity {
  id         String   @id @default(cuid())
  tenant_id  String
  product_id String?
  user_id    String?

  title       String
  description String?
  status      ActivityStatus @default(PENDING)
  due_date    DateTime?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([tenant_id])
  @@index([tenant_id, product_id])
  @@index([tenant_id, user_id])
}
```

---

## Regras para Evitar Conflitos entre Fragments

### Naming de models
- Todo model deve ter o nome do serviço como prefixo, ou um nome único global
- ❌ `model User { ... }`
- ✅ `model CRMUser { ... }` ou `model Activity { ... }` (se for o dono do domínio)

### Naming de enums
- Enums também devem ser prefixados
- ❌ `enum Status { ... }`
- ✅ `enum ActivityStatus { ... }`

### Checklist anti-conflito

- [ ] Meu fragment não define datasources nem generators
- [ ] Usei nomes de models e enums que não colidem com outros serviços
- [ ] Não usei `@map` ou `@@map` para renomear tabelas
- [ ] Não adicionei relações com models de outros fragments diretamente (use IDs para links manuais ou peça ao Coordenador para arbitrar cross-service relations)

---

## Validação pelo Coordenador

Após receber todos os fragments da onda:

```bash
# 1. Compor o schema
npx ts-node scripts/compose-tenant-schema.ts

# 2. Validar — deve passar sem erros
npx prisma validate --schema=servicos-global/tenant/prisma/schema.prisma

# 3. Se validar → gerar cliente
npx prisma generate --schema=servicos-global/tenant/prisma/schema.prisma

# 4. Se gerar → aplicar migration em staging
npx prisma migrate dev --name "onda-3-servicos-tenant" \
  --schema=servicos-global/tenant/prisma/schema.prisma
```

Se `prisma validate` falhar → Coordenador identifica o conflito, notifica o agente responsável com o erro específico e aguarda a correção. Não avança com schema inválido.

---

## Topologia de Bancos no Railway

```text
├── DB configurador       ← tenants, planos, billing, permissões
│      schema: configurador/server/prisma/schema.prisma
│
├── DB servicos-tenant    ← todos os serviços de tenant
│      schema: servicos-global/tenant/prisma/schema.prisma (composto dos fragments)
│
├── DB simulador-comex    ← dados específicos do produto
│      schema: produtos/simulador-comex/server/prisma/schema.prisma
│             (base + fragments de serviços de produto)
│
└── DB [próximo produto]  ← banco independente por produto
```

---

## O Que Nunca Fazer

- ❌ Editar o arquivo `schema.prisma` manualmente — suas mudanças serão sobrescritas no próximo deploy
- ❌ Colocar datasource ou generator dentro de um `fragment.prisma`
- ❌ Usar nomes genéricos como `Log`, `Notification`, `Data` — sempre prefixar com o nome do serviço
- ❌ Esquecer o campo `tenant_id` ou os índices obrigatórios

---

## Checklist — Antes de Submeter um fragment.prisma

- [ ] Rodei o script de composição localmente para validar a sintaxe final?
- [ ] Todos os models têm `tenant_id String` obrigatório?
- [ ] Apliquei os 3 índices padrão (`tenant_id`, `product_id`, `user_id`)?
- [ ] Verifiquei se não há conflitos de nomes de enums?
- [ ] Coloquei o fragment no diretório correto (tenant vs produto)?

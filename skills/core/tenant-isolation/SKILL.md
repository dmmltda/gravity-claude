---
name: antigravity-tenant-isolation
description: "Use esta skill sempre que uma tarefa envolver queries ao banco de dados, criação de models Prisma, configuração de middleware ou qualquer código que acesse dados de tenant. Define a regra mais importante do sistema: nenhuma query sem tenant_id. Todo agente consulta esta skill antes de escrever qualquer acesso ao banco."
---

# Gravity — Tenant Isolation

## A Regra Mais Importante do Sistema

**Nenhuma query, em nenhum serviço, pode ser executada sem filtrar por `tenant_id`.**

Isso não é uma boa prática — é uma regra absoluta. Um tenant nunca pode ver dados de outro tenant. Não há exceção. Não há caso especial. Não há "só desta vez".

---

## As Duas Camadas de Defesa

O isolamento é garantido por duas camadas independentes. Se uma falhar, a outra bloqueia. As duas devem estar implementadas sempre.

### Camada 1 — Prisma Client Extensions (código)

Middleware que injeta `tenant_id` automaticamente em toda query:

```typescript
// servicos-global/tenant/middleware/tenant-isolation.ts

function withTenantIsolation(prisma: PrismaClient, tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenant_id: tenantId }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenant_id: tenantId }
          return query(args)
        },
        async create({ args, query }) {
          args.data.tenant_id = tenantId
          return query(args)
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenant_id: tenantId }
          return query(args)
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenant_id: tenantId }
          return query(args)
        }
      }
    }
  })
}
```

### Camada 2 — PostgreSQL Row-Level Security (banco)

O banco de dados bloqueia acessos caso o middleware falhe:

```sql
-- Ativar RLS na tabela
ALTER TABLE "Tabela" ENABLE ROW LEVEL SECURITY;

-- Criar política de isolamento
CREATE POLICY tenant_isolation_policy ON "Tabela"
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

---

## Regras para Todo Model no DB servicos-tenant

Todo model no banco de tenant obrigatoriamente tem:

1. **Campo `tenant_id`** — OBRIGATÓRIO, não nullable

```prisma
model Exemplo {
  id        String @id @default(uuid())
  tenant_id String   // obrigatório, sempre
  // ...outros campos
}
```

2. **Índice de busca:** `@@index([tenant_id])`
3. **Índices compostos:** `@@index([tenant_id, product_id])` e `@@index([tenant_id, user_id])`
4. **Unique Constraint:** se tiver `@unique`, deve ser `@@unique([campo, tenant_id])`

---

## O Que É Proibido

- ❌ Usar o Prisma global diretamente nos serviços de produto
- ❌ Esquecer de passar o `tenant_id` no header das requisições internas
- ❌ Criar tabelas no banco de tenant sem o campo `tenant_id`
- ❌ Desativar RLS em produção

---

## O Que É Obrigatório

- ✅ Passar `tenant_id` em toda query via extension do Prisma
- ✅ Garantir que o `tenant_id` vem do token JWT — nunca da body/payload da requisição
- ✅ Implementar teste de integração que tenta acessar dados de outro tenant e espera falha

---

## RLS — Tabelas que Precisam de Policy

| Tabela | Status RLS | Responsável |
|:---|:---|:---|
| `User` | ENABLED | Nucleo-Central |
| `Account` | ENABLED | Nucleo-Central |
| `Transactions` | ENABLED | Servico-Produto |
| `Settings` | ENABLED | Servico-Produto |

---

## Como Testar o Isolamento

Todo serviço deve ter um arquivo `tenant-isolation.test.ts`:

```typescript
it('should block cross-tenant access', async () => {
  const adminTenantA = createPrismaClient('tenant-a-id')
  const recordB = await dbDirect.transaction.create({
    data: { tenant_id: 'tenant-b-id' }
  })

  // Tentar ler registro do Tenant B usando cliente do Tenant A
  const result = await adminTenantA.transaction.findUnique({
    where: { id: recordB.id }
  })

  expect(result).toBeNull() // Camada 1 (Prisma Extension) bloqueia
})
```

---

## Comunicação entre Produto e Configurador

O serviço de produto nunca acessa o banco do configurador. Ele pede permissão via API:

```typescript
// ✅ correto — via API do Nucleo Global
const response = await fetch('https://api.gravity.com/v1/auth/check-permission', {
  headers: {
    Authorization: `Bearer ${req.auth.token}`,
    'x-internal-key': process.env.INTERNAL_SERVICE_KEY!
  }
})
const { allowed } = await response.json()

if (!allowed) throw new AppError('Sem permissão', 403, 'FORBIDDEN')

// ❌ proibido — acessar banco do Configurador diretamente
import { configuradorPrisma } from '../../configurador/server/prisma'
```

---

## Checklist — Antes de Qualquer Acesso ao Banco

- [ ] Estou usando `req.prisma` (com middleware) e não o `prisma` global?
- [ ] O middleware `withTenantIsolation` está aplicado no servidor?
- [ ] O RLS está configurado para esta tabela?
- [ ] O model tem `tenant_id String` obrigatório (não nullable)?
- [ ] O model tem os três índices obrigatórios?
- [ ] O teste de acesso cross-tenant está implementado?
- [ ] Nenhum endpoint retorna dados sem filtro de tenant?
- [ ] Criações não aceitam `tenant_id` da payload — vem do token via middleware?

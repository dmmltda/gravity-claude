---
name: antigravity-configurador
description: "Regras de negócio, estrutura de permissões e funcionamento técnico do gateway central da plataforma Gravity. Use esta skill sempre que uma tarefa envolver o Configurador — autenticação, workspace, usuários, planos, billing, permissões ou gateway de redirecionamento."
---

# Gravity — Configurador

## O Que é o Configurador

O Configurador é o **porteiro central** de toda a plataforma Gravity. Todo cliente passa por ele — antes de acessar qualquer produto.

Responsabilidades:
- Autenticação de todos os usuários da plataforma (via Clerk)
- Gestão do Workspace (empresa mãe e empresas filhas)
- Gestão de usuários e permissões no nível tenant
- Assinaturas, planos e billing (via Stripe + boleto)
- Emissão de NF-e
- Gateway de redirecionamento para os produtos contratados

> **Princípio:** nenhum produto gerencia login, usuários ou cobrança. Tudo isso é responsabilidade exclusiva do Configurador.

---

## Posição no Ecossistema

```text
Marketplace
  | clica "Teste Grátis" ou "Assinar"
  ▼
Configurador (configurador.gravity.com.br)   ← porteiro central
  | cria conta, configura workspace,
  | escolhe produtos, paga, convida usuários
  ▼
Produto contratado (ex: simulador-comex.gravity.com.br)
  | JWT do Clerk já presente — sem novo login
  ▼
Produto valida token via @clerk/backend
```

---

## Características Técnicas

- **Banco próprio:** DB configurador — separado de todos os produtos
- **Servidor próprio:** Express + TypeScript na porta 3000
- **Autenticação:** Clerk vive exclusivamente aqui
- **Sem acesso ao banco de outros produtos** — produtos chamam `/api/check-access`
- **Schema Prisma:** `servicos-global/configurador/server/prisma/schema.prisma`

---

## Localização na Árvore

```text
servicos-global/
├── tenant/
├── produto/
├── marketplace/
├── configurador/   ← AQUI
└── devops/
```

---

## Estrutura de Pastas

```text
servicos-global/configurador/
├── server/
│   ├── index.ts
│   ├── routes/
│   │   ├── auth.ts         ← Clerk webhooks e eventos
│   │   ├── tenants.ts      ← workspace, empresas mãe e filhas
│   │   ├── plans.ts        ← planos e assinaturas
│   │   ├── billing.ts      ← boletos, cartão, NF-e
│   │   └── access.ts       ← verificação de permissões por produto
│   ├── services/
│   │   ├── billing.ts      ← lógica de cobrança
│   │   ├── nfe.ts          ← emissão de nota fiscal
│   │   └── permissions.ts  ← o que cada empresa acessa
│   └── prisma/
│       └── schema.prisma   ← banco próprio do Configurador
└── src/                    ← frontend React
```

---

## Modelo de Usuários e Permissões

### Nível 1 — Usuário no Tenant (empresa mãe)

O usuário é **criado e existe no tenant**. Pertence à empresa mãe. Sem vínculo com empresa filha, o usuário existe mas não acessa nada.

```text
Tenant (empresa mãe)
└── Usuários do tenant
    ├── Daniel Mendes — Master
    ├── Ana Silva — Standard
    └── Fornecedor X — Fornecedor
```

### Nível 2 — Habilitação em Empresa Filha

Para um usuário do tenant trabalhar em uma empresa filha, ele precisa de uma **Habilitação**.
- 1 Tenant pode ter até 50 filhas
- O usuário Daniel pode estar habilitado nas filhas A e B, mas não na C

### Nível 3 — Dois Tipos de Permissão por Habilitação

Ao habilitar um usuário em uma filha, você define o cargo (role):
1. **Master:** Pode fazer tudo na filha (inclusive gerir outros usuários)
2. **Standard:** Só pode operar (conforme as permissões de produto)

Cada habilitação em empresa filha tem dois níveis:
- **Permissão de acesso ao produto:** Define quais produtos o usuário pode usar naquela empresa filha
- **Permissões granulares dentro do produto:** Define o que o usuário pode fazer dentro de cada produto

---

## Tipos de Usuário

| Tipo | Comportamento |
|:---|:---|
| **Master** | Acesso total a todos os produtos — permissões granulares não se aplicam |
| **Standard** | Acesso conforme permissões definidas por empresa filha e por produto |
| **Fornecedor** | Tipo especial para acesso externo — permissões granulares obrigatórias |

---

## Regra Crítica — Permissões de Produto

As permissões granulares dentro de cada produto **só existem após o produto ser construído**.

```typescript
const productPermissions = await getProductPermissions(productId)
if (!productPermissions || productPermissions.length === 0) {
  return {
    error: 'Permissões deste produto ainda não foram configuradas.',
    canEdit: false
  }
}
```

---

## Modelo Especial — Fornecedor Cross-Tenant

Um fornecedor pode prestar serviços para vários clientes (tenants) da Gravity.
- E-mail único no Clerk
- Múltiplos vínculos de tenant no Configurador
- **Fluxo:** Login → Escolha de Workspace → Acesso ao contexto

```prisma
model SupplierTenantAccess {
  id       String @id @default(cuid())
  clerkId  String
  tenantId String
  status   String @default("active")
  @@unique([clerkId, tenantId])
}
```

---

## Schema Prisma — Entidades Principais

```prisma
model Tenant {
  id        String    @id @default(cuid())
  name      String
  plan      String    @default("trial")
  companies Company[]
}

model Company {
  id        String  @id @default(cuid())
  tenantId  String
  name      String
  subdomain String? @unique
}

model UserMembership {
  id       String @id @default(cuid())
  clerkId  String
  tenantId String
  role     String @default("standard")
}
```

---

## APIs Disponíveis

### APIs Públicas (Clerk Auth)
- `POST /api/v1/tenant` — criar tenant
- `GET /api/v1/companies` — listar empresas filhas
- `GET /api/v1/users` — listar usuários
- `GET /api/v1/plans` — listar planos
- `GET /api/v1/billing/invoices` — histórico de faturas

### APIs Internas (x-internal-key obrigatória)
- `POST /api/internal/validate-session` — valida ticket do gateway
- `GET /api/internal/check-access` — checa acesso ao produto/empresa
- `GET /api/internal/product-permissions` — busca definições do produto

---

## Assinaturas, Financeiro e Gateway

### /workspace/assinaturas
- Upgrade/Downgrade de planos; Adição de produtos avulsos
- **Tipos de cobrança:** SaaS (mensal), Uso (por item), Setup (taxa única)

### /workspace/financeiro
- Histórico de faturas, Download de Boletos/NF-e

### /gateway
- Rota técnica: Valida permissão → Gera ticket JWT curto → Redireciona para o produto

---

## Variáveis de Ambiente

```bash
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_live_...
STRIPE_SECRET_KEY=sk_live_...
INTERNAL_SERVICE_KEY=...
PORT=3000
```

---

## Fluxo Completo de um Cliente

1. **DESCOBERTA:** Acessa marketplace
2. **AQUISIÇÃO:** Clica "Assinar", vai para o Configurador
3. **ONBOARDING:** Cria conta, cadastra empresa, paga, convida usuários
4. **ACESSO:** Configurador libera acesso via Gateway

---

## Checklist — Antes de Entregar o Configurador

- [ ] Workspace lista empresas filhas corretamente?
- [ ] Botão "Acessar" redireciona para a URL do produto com token?
- [ ] Clerk webhooks sincronizam usuários e organizações?
- [ ] Convite de usuário dispara e-mail do Clerk?
- [ ] Usuário Master acessa tudo, Standard segue permissões?
- [ ] Download de Boleto/NF-e disponível no financeiro?
- [ ] API `/api/check-access` responde corretamente aos produtos?
- [ ] Fornecedor com múltiplos tenants vê a tela de seleção ao logar?

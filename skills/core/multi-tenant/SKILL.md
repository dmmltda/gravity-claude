---
name: antigravity-servicos-tenant
description: "Use esta skill sempre que uma tarefa envolver criação, modificação ou uso de serviços de tenant ou serviços de produto do projeto Gravity. Define a diferença entre as duas naturezas de serviço, a estrutura obrigatória de pastas, as regras de autocontido, como expor fragment.prisma e como o frontend integra os serviços. Todo agente consulta esta skill antes de criar ou modificar qualquer serviço."
---

# Gravity — Serviços Global

## As Duas Naturezas de Serviço

Dentro de `servicos-global` existem duas categorias fundamentalmente diferentes. Esta distinção define onde os dados vivem e como a experiência unificada entre produtos é possível.

### Serviços de Tenant

Existem uma vez por empresa, independente de quantos produtos ela use. O email é da empresa, não do produto. As atividades precisam aparecer unificadas em todos os produtos. O dashboard consolida KPIs de tudo.

- Rodam em um servidor independente com banco de dados próprio
- Acessados por todos os produtos via API REST
- Dados filtrados por `tenant_id` e opcionalmente por `product_id`

### Serviços de Produto

São templates de funcionalidade reutilizáveis, mas os dados pertencem ao produto que os instancia. O helpdesk do NF Importação tem SLAs diferentes do helpdesk do Simulador Comex.

- O código é compartilhado — o banco é de cada produto
- Rodam dentro do servidor do produto, não em servidor separado
- Expõem `fragment.prisma` para composição no schema do produto

---

## Tabela Comparativa

| Característica | nucleo-global | servicos-global/tenant | servicos-global/produto |
|:---|:---|:---|:---|
| Tem estado próprio? | ❌ Não | ✅ Sim | ✅ Sim |
| Tem backend? | ❌ Nunca | ✅ Sempre | ✅ Sempre |
| Banco próprio? | ❌ Nunca | ✅ Banco de tenant | ❌ Banco do produto |
| Chama API externa? | ❌ Nunca | ✅ Pode | ✅ Pode |
| Funciona offline? | ✅ Sempre | ❌ Não | ❌ Não |
| Roda onde? | No produto | Servidor independente | Dentro do produto |

---

## Catálogo de Serviços de Tenant

| Serviço | Por que é tenant |
|:---|:---|
| atividade | "Minhas tarefas" precisa ser unificado entre produtos |
| notificacao | Notificações do usuário transcendem o produto individual |
| dashboard | Consolidação de dados de faturamento e operação global |
| empresa | Dados cadastrais e governança do cliente |
| cronometro | Tempo do usuário, independe do produto |
| email | Uma inbox por empresa, não por produto |
| whatsapp | Uma conversa por contato, não por produto |
| relatorios | Relatórios cruzados entre produtos |
| historico | Auditoria completa, não fragmentada |
| agendamento | Um calendário por usuário |

---

## Catálogo de Serviços de Produto

| Serviço | Por que é produto |
|:---|:---|
| helpdesk | SLAs, agentes e filas são configurados por produto |
| checklist | Cada processo (ex: NF, Booking) tem itens específicos |
| auditoria | O log de alterações pertence ao histórico do produto |
| exportacao | Formatos de arquivos dependem do domínio do produto |

---

## Estrutura Obrigatória — Serviço de Tenant

```text
servicos-global/tenant/[nome-do-servico]/
├── src/
│   ├── [NomeServico].tsx   ← componente principal
│   └── index.ts            ← barrel export
├── server/
│   └── routes.ts           ← endpoints do serviço
└── prisma/
    └── fragment.prisma     ← modelo de dados (nunca editar schema.prisma diretamente)
```

---

## Estrutura Obrigatória — Serviço de Produto

```text
servicos-global/produto/[nome-do-servico]/
├── src/
│   ├── [NomeServico].tsx   ← componente principal
│   └── index.ts            ← barrel export
├── server/
│   └── routes.ts           ← rotas montadas dentro do servidor do produto
└── prisma/
    └── fragment.prisma     ← composto no schema do produto via compose-schema.js
```

---

## Regra de Autocontido

Cada serviço deve ser **autocontido em termos de deploy e banco de dados**, mas **pode consumir a API de outro serviço como cliente**.

```typescript
// ✅ correto — consumir outro serviço via API
const timers = await fetch('/api/tenant/timers?activity_id=123')

// ❌ proibido — importar código de outro serviço de tenant
import { something } from '../cronometro/src/Cronometro'
```

---

## Como Escrever o fragment.prisma

Cada serviço escreve apenas seu próprio fragment. Nunca edita o `schema.prisma` final.

**Regras obrigatórias para todo model:**
- `tenant_id String` obrigatório em toda tabela
- `product_id String?` nullable para tabelas que podem ter contexto de produto
- Três índices obrigatórios

```prisma
// servicos-global/tenant/atividades/prisma/fragment.prisma

model Activity {
  id         String   @id @default(cuid())
  tenant_id  String            // obrigatório, sempre
  product_id String?           // nullable — atividades podem não ter produto
  user_id    String            // responsável
  title      String
  status     String
  due_date   DateTime?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([tenant_id])
  @@index([tenant_id, product_id])
  @@index([tenant_id, user_id])
}
```

---

## Como Usar o product_id nas Queries

```typescript
// Dentro de um produto → só dados daquele produto
const activities = await prisma.activity.findMany({
  where: { tenant_id: tenant, product_id: 'simulador-comex' }
})

// Na visão unificada "Minhas Atividades" → tudo do usuário
const activities = await prisma.activity.findMany({
  where: { tenant_id: tenant, user_id: currentUser }
})

// No Dashboard consolidado → tudo do tenant
const count = await prisma.activity.count({
  where: { tenant_id: tenant, status: 'pending' }
})
```

---

## Como o Frontend Integra Serviços de Tenant

O shell carrega a navegação e delega para o módulo correto via lazy loading:

```typescript
// nucleo-global/shell/navigation.tsx
const tenantModules = {
  activities: lazy(() => import('@tenant/atividades/src/Atividades')),
  email:      lazy(() => import('@tenant/email/src/Email')),
  whatsapp:   lazy(() => import('@tenant/whatsapp/src/WhatsApp')),
  dashboard:  lazy(() => import('@tenant/dashboard/src/Dashboard')),
  reports:    lazy(() => import('@tenant/relatorios/src/Relatorios')),
  history:    lazy(() => import('@tenant/historico/src/Historico')),
  schedule:   lazy(() => import('@tenant/agendamento/src/Agendamento')),
  gabi:       lazy(() => import('@tenant/gabi/src/Gabi')),
}
```

> O produto declara no `PRODUCT_CONFIG` quais serviços usa e o shell carrega automaticamente. Consultar `antigravity-configurador` para os detalhes do service registry.

---

## Como o Backend Integra Serviços de Tenant

```typescript
// produtos/simulador-comex/server/index.ts
import { createTenantProxy } from '@tenant/proxy'
import { PRODUCT_CONFIG } from '../src/shared/config'

// Rotas específicas do produto
app.use('/api/v1/simulacoes', simulacoesRoutes)

// Serviços de produto (template local, banco deste produto)
app.use('/api/v1/helpdesk', helpdeskRoutes)

// Serviços de tenant (proxy para servidor externo)
app.use('/api/tenant', createTenantProxy({
  baseUrl: process.env.TENANT_SERVICES_URL!,
  services: PRODUCT_CONFIG.tenantServices
}))
```

---

## Lidando com Latência — Chamadas Paralelas

Quando uma tela precisa de dados de múltiplos serviços de tenant, sempre usar `Promise.all` — nunca chamadas em série:

```typescript
// ✅ correto — 3 chamadas em paralelo
const [activities, timers, emails] = await Promise.all([
  tenantAPI.get(`/activities?user_id=${user_id}&product_id=simulador-comex`),
  tenantAPI.get(`/timers?user_id=${user_id}&active=true`),
  tenantAPI.get(`/email?unread=true&limit=5`)
])

// ❌ proibido — chamadas em série desnecessárias
const activities = await tenantAPI.get('/activities')
const timers = await tenantAPI.get('/timers')
const emails = await tenantAPI.get('/email')
```

---

## Tratamento de Indisponibilidade

Se o servidor de serviços tenant cair, os produtos continuam funcionando para tudo que é local. Features de tenant ficam temporariamente indisponíveis.

```typescript
function AtividadesWrapper() {
  const { data, error, isLoading } = useTenantService('atividades')

  if (isLoading) return <Loading />
  if (error) return (
    <ServiceUnavailable
      service="atividades"
      message="Serviço temporariamente indisponível. Dados do produto funcionam normalmente."
      retryIn={30}
    />
  )

  return <Atividades data={data} />
}
```

---

## Comunicação entre Módulos — Event Bus

Quando múltiplos serviços de tenant estão na mesma tela, eles se comunicam via event bus sem importar código um do outro:

```typescript
import { emit, on } from '@nucleo/shell'

// No Cronômetro: quando o tempo acaba, avisa o sistema
emit('timer:stopped', { activity_id: '123', duration: 3600 })

// Na Atividade: escuta o evento para atualizar o status
on('timer:stopped', ({ activity_id, duration }) => {
  if (activity_id === currentId) refresh()
})
```

---

## Checklist — Antes de Criar um Serviço

- [ ] Definiu a natureza: tenant ou produto?
- [ ] Se tenant: dados pertencem à empresa e precisam ser unificados?
- [ ] Se produto: dados têm regras diferentes por produto?
- [ ] Criou a estrutura `src/` + `server/` + `prisma/fragment.prisma`?
- [ ] Fragment tem `tenant_id` obrigatório em todos os models?
- [ ] Fragment tem os três índices obrigatórios?
- [ ] O serviço não importa código de nenhum outro serviço?
- [ ] Barrel export no `index.ts` do `src/`?
- [ ] Rotas com prefixo `/api/v1/`?
- [ ] Validação Zod em todas as rotas?
- [ ] Testes unitários e funcionais criados?

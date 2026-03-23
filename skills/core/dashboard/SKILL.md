---
name: antigravity-dashboard
description: "Use esta skill sempre que uma tarefa envolver o serviço de dashboard da plataforma Gravity. Define a arquitetura de widgets plugáveis, o sistema de Registry central, os três tipos de painel (Global Admin, Tenant Home, Produto Específico), a estratégia de atualização (WebSocket para contadores críticos, polling para gráficos pesados) e como produtos injetam widgets no dashboard global do tenant."
---

# Gravity — Serviço de Dashboard

## Propósito

Oferecer uma visão unificada do sistema que se adapta ao contexto do usuário (Administrador Global vs. Operador do Tenant) e ao produto ativo.

---

## Arquitetura do Dashboard

- **Widgets:** Componentes isolados e plugáveis que consomem dados de serviços específicos
- **Registry:** Central que mapeia quais widgets cada tenant/produto tem direito de visualizar
- **Refresh Strategy:**
  - **WebSockets** → contadores críticos e dados em tempo real
  - **Polling/Cache** → gráficos pesados e dados históricos

---

## Widget Registry — Interface Obrigatória

Todo widget deve implementar a interface `IGravityWidget`:

```typescript
interface IGravityWidget {
  id: string
  title: string
  component: string   // Nome do componente no Design System
  dataSource: string  // Endpoint ou Service Method
  permissions: string[]
  size: 'sm' | 'md' | 'lg' | 'full'
}
```

**Registrando um widget:**

```typescript
// servicos-global/tenant/dashboard/registry.ts
export const registerWidget = (widget: IGravityWidget) => {
  // Valida permissões e adiciona ao catálogo global
  dashboardState.widgets.set(widget.id, widget)
}
```

---

## Painéis Disponíveis

| Painel | Descrição | Widgets Principais |
|:---|:---|:---|
| **Global Admin** | Visão de todos os tenants ativos | Faturamento Total, Status de Serviços, Novos Tenants |
| **Tenant Home** | Visão operacional do cliente | Tarefas Pendentes, Uso de Créditos, Notificações |
| **Produto Específico** | KPIs do produto (ex: Comex) | Funil de Vendas, NF-e Emitidas, Cronômetro Ativo |

---

## Painel: Funil de Vendas

Implementação específica para produtos que geram leads:

1. **Lead In:** Entrada via API/WhatsApp
2. **Qualificação:** IA classifica temperatura
3. **Proposta:** Documento gerado no Simulador
4. **Fechamento:** Gatilho para financeiro

---

## Painel: Onboarding de Clientes

Gráfico de progresso que monitora:
- Documentação enviada
- Primeiro uso da plataforma
- Setup de integrações concluído

---

## Customização de Painéis por Produto

Cada produto pode **injetar widgets** no Dashboard global do tenant se estiver ativo no `service-registry`:

```typescript
// produtos/simulador-comex/src/shared/config.ts
import { registerWidget } from '@nucleo/dashboard'

registerWidget({
  id:          'comex-venda-funnel',
  title:       'Funil de Importação',
  component:   'FunnelChart',
  dataSource:  '/api/v1/comex/stats/funnel',
  permissions: ['comex.view'],
  size:        'md'
})
```

---

## Localização na Arquitetura

```text
servicos-global/tenant/dashboard/
├── src/
│   ├── Dashboard.tsx
│   ├── registry.ts       ← Widget Registry central
│   └── index.ts
├── server/
│   └── routes.ts
└── prisma/
    └── fragment.prisma
```

---

## Checklist de Qualidade

- [ ] Widgets possuem estado de "loading"?
- [ ] Widgets tratam erro de permissão (Forbidden State)?
- [ ] Dados sensíveis são ofuscados se o contexto for "guest"?
- [ ] UX segue o Design System (consultar `antigravity-design-system`)?
- [ ] Widget registrado com `permissions` corretas?
- [ ] Dados críticos atualizando via WebSocket?
- [ ] Gráficos pesados usando polling/cache?

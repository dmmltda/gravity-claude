---
name: antigravity-state-management
description: "Use esta skill sempre que uma tarefa envolver gerenciamento de estado no frontend — seja no shell ou em um produto. Define a separação obrigatória entre estado do shell e estado do produto, a dependência unidirecional, os campos restritos do ShellState e como o isolamento é garantido. Todo agente consulta esta skill antes de criar ou modificar qualquer store, context ou hook de estado."
---

# Gravity — State Management

## Regra Fundamental

Shell e produto usam stores distintas com uma regra de dependência unidirecional:

```text
nucleo-global/shell/state        produtos/[produto]/src/shared/state
(estado genérico)                 (estado específico)
│
│◀──── produto PODE ler ──────────┘
│
✕ shell NUNCA lê estado do produto
```

**O produto conhece o shell. O shell nunca conhece o produto.**

---

## Estado do Shell — ShellState

O ShellState contém apenas dados que fazem sentido em qualquer produto. É um contrato fechado — ninguém adiciona campos de negócio aqui.

```typescript
// nucleo-global/shell/types.ts
interface ShellState {
  sidebarOpen: boolean
  currentTheme: 'light' | 'dark'
  currentUser: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
}
```

**Com Zustand:**

```typescript
export const useShellStore = create<ShellState>((set) => ({
  sidebarOpen: true,
  currentTheme: 'light',
  currentUser: { id: '0', name: 'User', email: 'user@email.com' },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
```

---

## Estado do Produto — ProductState

Cada produto tem seu próprio ProductState. Ele pode ler o ShellState por meio de hooks, mas o ShellState nunca tem conhecimento do ProductState.

```typescript
// produtos/vendas/src/shared/state/types.ts
interface VendasState {
  idCarrinho: string
  items: SaleItem[]
  company: {
    id: string
    name: string
    plan: string
  }
}
```

**Exemplo de uso correto (em um produto):**

```typescript
async function handleSalvar() {
  try {
    const { currentUser } = useShellStore.getState()
    const { items } = useProductStore.getState()

    await api.vendas.create({
      items,
      createdById: currentUser.id
    })
  } catch (error) {
    AppError.handle(error)
  }
}
```

---

## Comunicação entre Shell e Produto

O shell não lê o estado do produto, mas os dois podem se comunicar via event bus:

```typescript
import { emit, on } from '@nucleo/shell'

// Produto emite evento quando algo relevante acontece
emit('activity:created', { id: '123', title: 'Nova simulação' })

// Shell (ou outro módulo) escuta sem precisar conhecer o estado do produto
on('activity:created', ({ id, title }) => {
  addNotification(`Atividade criada: ${title}`)
})
```

> **Regra:** o event bus é para notificações e sincronização leve. Estado persistente sempre vive na store correta — shell ou produto.

---

## Notificações — Como Disparar do Produto

O produto nunca gerencia toasts diretamente — usa o shell:

```typescript
import { useShellStore } from '@nucleo/shell'

function SimulacaoPage() {
  const { addNotification } = useShellStore()

  async function handleSalvar() {
    try {
      // ... lógica de salvamento
      addNotification({ type: 'success', message: 'Salvo com sucesso!' })
    } catch (error) {
      addNotification({ type: 'error', message: 'Erro ao salvar' })
    }
  }
}
```

---

## Separação de Responsabilidades por Tipo de Estado

| Tipo | Onde vive | Exemplo |
|:---|:---|:---|
| Estado de UI global | `shell/state` | sidebar aberta, tema, rota |
| Estado de usuário básico | `shell/state` | id, nome, email |
| Estado de UI do produto | `produto/shared/state` | filtros, seleção, visão |
| Estado de operação | `produto/shared/state` | importação em andamento |
| Estado de permissões | `produto/shared/state` | o que o usuário pode fazer |
| Dados do servidor | Queries (React Query ou SWR) | listas, detalhes de entidades |
| Comunicação entre módulos | Event bus (`@nucleo/shell`) | timer parou, atividade criada |

---

## Checklist — Antes de Criar ou Modificar Estado

- [ ] Este dado faz sentido em qualquer produto? → `shell/state`
- [ ] Este dado é específico deste produto? → `produto/shared/state`
- [ ] A store do shell importa algo do produto? → proibido, corrigir
- [ ] O produto usa `useShellStore()` para ler dados do shell? → correto
- [ ] Notificações são disparadas via `addNotification` do shell? → correto
- [ ] Dados do servidor estão em queries, não em stores? → correto
- [ ] Estado de UI reseta ao navegar? → esperado, não é bug
- [ ] Nenhum dado sensível em `localStorage`? → obrigatório

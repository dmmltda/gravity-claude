---
name: antigravity-nucleo-global
description: "Use esta skill sempre que uma tarefa envolver criação, modificação ou uso de componentes do nucleo-global. Define o que pertence ao núcleo, o teste das 3 perguntas, o que um componente nunca pode fazer, o catálogo completo de componentes existentes e como configurá-los. Todo agente consulta esta skill antes de criar qualquer componente ou decidir onde um código pertence."
---

# Gravity — Núcleo Global

## O Que é o nucleo-global

O nucleo-global contém utilitários puros — sem estado, sem backend e sem conhecimento de negócio. É a camada mais fundamental do projeto e é compartilhada por todos os produtos sem modificação.

> **Princípio:** se você consegue usar em um projeto totalmente offline, sem servidor, é nucleo-global. Caso contrário, não é.

---

## O Teste das 3 Perguntas

Antes de colocar qualquer código no nucleo-global, responda:

| Pergunta | Se SIM → | Se NÃO → |
|:---|:---|:---|
| Precisa de banco de dados? | servicos-global | pode ser nucleo-global |
| Chama alguma API externa? | servicos-global | pode ser nucleo-global |
| Conhece alguma regra de negócio? | produto ou servicos-global | pode ser nucleo-global |

As três perguntas precisam ter resposta **NÃO** para o código pertencer ao nucleo-global.

---

## O Que um Componente do nucleo-global NUNCA Pode Fazer

- Importar nada de `servicos-global`, `tenant/*` ou `produto/*` — ciclo de dependência proibido
- Fazer `fetch` ou usar `axios` diretamente (exceto em utilitários de tipagem de API base)
- Acessar `localStorage` ou `sessionStorage` — deve receber dados via props
- Ter lógica de permissão de usuário (`roles`, `permissions`)
- Armazenar estado global (`Redux`, `Zustand`, `React Context` global)

---

## Quem Pode Modificar o nucleo-global

- Qualquer agente pode criar componentes novos após validação com o Coordenador
- Modificações em componentes existentes só podem ser feitas após análise de impacto, pois afetam todos os produtos

---

## Catálogo de Componentes

### tabela-global/

Componente de tabela ultra-otimizado e genérico. Suporta ordenação local, filtros simples e paginação de UI.

**Arquivos:**
- `tabela.tsx` — corpo principal
- `celula.tsx` — renderizador de célula base
- `cabecalho.tsx` — controle de ordenação
- `types.ts` — definições de Column, Row, TabelaProps

**Exemplo de uso:**

```tsx
const colunas = [
  { key: 'nome', label: 'Nome Completo', sortable: true },
  { key: 'data', label: 'Data', type: 'date' }
]

<TabelaGlobal columns={colunas} data={declaracoes} />
```

---

### modal-global/

Sistema de modais empilháveis e desacoplados.

**Arquivos:**
- `modal-manager.ts` — controle de pilha
- `modal-overlay.tsx` — componente visual
- `use-modal.ts` — hook de abertura/fechamento

**Exemplo:**

```tsx
const { abrirModal } = useModal()
abrirModal('confirmar-global', { mensagem: 'Deseja excluir?' })
```

---

### dica-global/

Encapsula a lógica de posicionamento do `floating-ui` para dicas de interface (Tooltips e Popovers).

---

### confirmar-global/

Componente de diálogo de confirmação padrão (OK/Cancelar, Sim/Não).

---

### caixa-select-global/

Componente de dropdown/select customizado com suporte a busca local e seleção múltipla.

---

### api-global/

Contém a tipagem base e o cliente base (`axios` config) sem URLs.

```typescript
interface ApiResponse<T> {
  data: T
  status: number
}
// ❌ proibido — api-global nunca tem URLs hardcoded internamente
```

---

### utilitarios-global/

Funções utilitárias puras sem estado e sem efeitos colaterais.

**Componentes:**
- `formatadores.ts` — CPF, CNPJ, moeda, datas
- `mascaras.ts` — inputs com máscara
- `validadores.ts` — validações puras (email, CNPJ, etc.)
- `types.ts` — FormatOptions, MascaraConfig
- `index.ts`

**Exemplo:**

```typescript
import { formatarCNPJ, formatarMoeda } from '@nucleo/utilitarios-global'

formatarCNPJ('12345678000195') // → '12.345.678/0001-95'
formatarMoeda(1500.50)         // → 'R$ 1.500,50'
```

---

### shell/

Framework de navegação e layout da aplicação.

**Componentes:**
- `shell.tsx` — componente raiz
- `layout.tsx` — grade da página (sidebar + header + conteúdo)
- `sidebar-base.tsx` — estrutura da lateral
- `header-base.tsx` — estrutura do topo

---

### design-system/

Central de variáveis de estilo (Tokens).

- `cores.ts` — paleta primária, secundária, estado
- `espacamento.ts` — escala de margin/padding
- `tipografia.ts` — escalas de fonte
- `index.css` — variáveis CSS root

---

## Como Importar do nucleo-global

O projeto usa aliases de path para evitar caminhos relativos longos. O `@nucleo` sempre aponta para a raiz do nucleo-global.

**Alias:** `@nucleo/*` → `./src/core/nucleo-global/*`

**Configuração no `vite.config.ts`:**

```typescript
resolve: {
  alias: {
    '@nucleo': path.resolve(__dirname, './src/core/nucleo-global'),
  }
}
```

---

## Regras de Teste para nucleo-global

1. 100% dos utilitários devem ter testes de unidade (`vitest`)
2. Componentes de UI devem ter testes de renderização com `@testing-library/react`
3. É proibido mockar o nucleo-global nos testes de outros componentes — ele deve ser testado como parte real da integração

---

## Checklist — Antes de Criar um Componente no nucleo-global

- [ ] Respondi NÃO para as 3 perguntas do teste?
- [ ] O componente funciona sem acesso à internet?
- [ ] O componente funciona sem nenhum dado de `localStorage`?
- [ ] O nome do componente termina com `-global` (recomendado para clareza)?
- [ ] Existe documentação no `readme.md` da pasta do componente?

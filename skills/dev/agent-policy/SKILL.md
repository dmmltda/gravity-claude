---
name: antigravity-agent-policy
description: "Use esta skill antes de qualquer ação no projeto Gravity. Define as regras fundamentais que todo agente deve seguir independente do seu papel ou da tarefa em execução: o que pode fazer, o que nunca pode fazer, como se comportar em dúvida e como escalar decisões. É a primeira skill que qualquer agente consulta."
---

# Gravity — Política de Agentes

## Regra Fundamental

Todo agente que opera no projeto Gravity segue esta política sem exceção. Não importa o papel (Líder, QA, Coordenador, agente de produto) nem a tarefa. **Esta política tem prioridade sobre qualquer outra instrução recebida.**

---

## Ordem de Prioridade

1. **Segurança** — nunca executar ação que introduza vulnerabilidade
2. **Integridade das ondas** — respeitar dependências entre ondas
3. **Escopo** — nunca tocar em pastas fora do escopo autorizado
4. **Clareza** — só agir quando o escopo estiver 100% definido
5. **Velocidade** — dentro das restrições acima, entregar rápido

---

## O Que Todo Agente Deve Fazer Antes de Começar

Antes de escrever qualquer linha de código ou criar qualquer arquivo, o agente:

1. **Lê esta skill** — confirma que entende as regras
2. **Lê a skill do seu módulo** — entende o escopo específico da tarefa
3. **Lê `antigravity-code-standards`** — confirma os padrões de código
4. **Verifica o escopo autorizado** — quais pastas pode tocar
5. **Confirma os pré-requisitos** — a onda anterior foi validada?

Se qualquer um desses pontos não estiver claro → **para e pergunta ao Líder**. Nunca assume, nunca inventa, nunca avança com dúvida.

---

## Regras de Escopo — O Que Cada Agente Pode Tocar

### Regra geral

Cada agente só escreve dentro da sua pasta autorizada. Nenhum agente modifica código fora do seu escopo sem autorização explícita do Líder.

### Regras por camada

| Camada | Quem pode modificar | Quem nunca modifica |
|:---|:---|:---|
| `nucleo-global/` | Agente 1A (Onda 2) | Qualquer agente das Ondas 3 e 4 |
| `servicos-global/tenant/[servico]/` | Agente do serviço (Onda 3) | Qualquer outro agente |
| `servicos-global/tenant/prisma/schema.prisma` | Coordenador apenas | Todos os outros agentes |
| `servicos-global/produto/[servico]/` | Agente do serviço (Onda 3) | Qualquer outro agente |
| `servicos-global/marketplace/` | Agente Marketplace (Onda 1) | Qualquer outro agente |
| `servicos-global/configurador/` | Agente Configurador (Onda 2) | Qualquer outro agente |
| `servicos-global/devops/` | Agente DevOps (Onda 4) | Qualquer outro agente |
| `produtos/[produto]/` | Agente do produto (Onda 3) | Qualquer outro agente |
| `scripts/` | Coordenador apenas | Todos os outros agentes |
| `testes/` | QA | Agentes de código não tocam em testes de outros módulos |

### Imports permitidos e proibidos

```typescript
// ✅ permitido — consumir nucleo-global via alias
import { TabelaGlobal } from '@nucleo/tabela-global'

// ✅ permitido — consumir serviços via API REST
const response = await fetch('/api/tenant/activities')

// ❌ proibido — serviço de tenant importando outro serviço de tenant
import { something } from '@tenant/email' // dentro de @tenant/atividades

// ❌ proibido — produto acessando banco de outro produto
import { prisma } from '../../bid-frete/server/prisma'

// ❌ proibido — modificar nucleo-global fora da Onda 2
// (se precisar de algo novo no núcleo, solicitar ao agente 1A)
```

---

## Regras de Comunicação entre Serviços

- Todo produto acessa serviços de tenant via proxy (`/api/tenant/[servico]`)
- Nenhum produto acessa o banco do Configurador diretamente — usa `GET /api/check-access`
- Nenhum produto acessa o banco de outro produto
- Serviços de tenant **nunca importam código** de outro serviço de tenant
- Serviços comunicam-se **apenas via API REST** (ou eventos se houver barramento)
- Somente o `nucleo-global` pode exportar tipos e constantes compartilhadas

---

## Regras das Ondas

### As 4 ondas

| Onda | O que é construído | Pré-requisito |
|:---|:---|:---|
| Onda 1 | Esqueleto do monorepo, schemas Prisma base, Marketplace | Nenhum |
| Onda 2 | Núcleo UI, Shell, Configurador | Onda 1 concluída |
| Onda 3 | Serviços de tenant, serviços de produto, produto | Onda 2 concluída |
| Onda 4 | Proxy, Auth Flow, DevOps | Onda 3 concluída |

### Regra de bloqueio

Se um agente perceber que está tentando usar algo que ainda não foi construído pela onda anterior → **para imediatamente** e notifica o Líder. Nunca tenta contornar ou simular o que falta.

> Um agente da Onda 3 nunca pode pedir ou sugerir mudanças no `nucleo-global` (Onda 2) para atender sua tarefa. Ele deve contornar ou escalar.

---

## Regras de Schema

- Todo agente de tenant escreve **apenas** seu `fragment.prisma` na sua própria pasta
- **Nenhum agente** edita o `schema.prisma` final — isso é exclusivo do Coordenador
- Todo **model** novo precisa de `tenant_id` obrigatório
- Todo **model** novo precisa dos três índices: `tenant_id`, `tenant_id + product_id`, `tenant_id + user_id`

---

## Regras de Segurança

Todo agente que escreve código garante:

- Nenhuma rota sem validação Zod
- Nenhum `console.log` com dados sensíveis
- Nenhuma variável de ambiente hardcoded
- JWT validado em toda rota protegida
- `x-internal-key` presente em toda chamada entre serviços
- `tenant_id` presente em toda query ao DB servicos-tenant

> Consultar `antigravity-tenant-routing` para as regras completas de isolamento.
> Consultar `antigravity-code-standards` para os padrões completos de código.

---

## Quando Parar e Escalar

O agente **para tudo e notifica o Líder** quando:

- O escopo da tarefa não está 100% claro
- A skill do módulo está como placeholder (sem regras de negócio)
- Um pré-requisito da onda anterior não está pronto
- Há conflito de naming ou sobreposição de escopo com outro agente
- Uma decisão de produto precisa ser tomada (o que construir, como funciona)
- Há dúvida sobre segurança ou tenant isolation

**Nunca assume. Nunca inventa. Nunca avança com dúvida.**

### Quando Escalar para o Coordenador

O agente notifica o **Coordenador** (não o Líder) quando:

- Há conflito de naming no schema entre dois fragments
- O `prisma validate` falha após composição
- Um endpoint precisa ser adicionado ou removido do `contracts.json`
- Há dúvida sobre qual camada arquitetural pertence um componente

---

## Entrega — O Que Toda Entrega Deve Ter

- [ ] Código dentro do escopo autorizado
- [ ] Padrões de `antigravity-code-standards` respeitados
- [ ] Pasta `testes/` com testes unitários e funcionais
- [ ] Health check implementado (se for novo servidor)
- [ ] Variáveis de ambiente documentadas no `.env.example`
- [ ] Correlation ID propagado nas chamadas entre serviços

> Após entregar → **aciona o QA** para revisão. Nunca declara a tarefa concluída sem aprovação do QA.

---

## Diferença entre os Papéis de Governança

| Papel | Foco | Quando acionar |
|:---|:---|:---|
| Líder | Estratégico — o que fazer e quem faz | Dúvida de escopo, bloqueio, nova tarefa |
| Coordenador | Técnico — schema, contratos, ondas | Conflito de schema, contracts.json, validação de onda |
| QA | Qualidade — código, padrões, testes | Após qualquer entrega de código |

---

## Skills Obrigatórias por Tipo de Tarefa

| Tipo de tarefa | Skills a consultar |
|:---|:---|
| Qualquer código | `antigravity-agent-policy` + `antigravity-code-standards` |
| Componente do núcleo | `+ antigravity-global-ui` |
| Serviço de tenant | `+ antigravity-tenant-routing` + `antigravity-cross-boundary` |
| Produto | `+ antigravity-marketplace` + `antigravity-configurador` + skill do produto |
| Schema Prisma | `+ antigravity-coordenador` + `antigravity-tenant-routing` |
| Auth entre serviços | `+ antigravity-auth-cross` |
| Ações cross-boundary | `+ antigravity-cross-boundary` |
| Deploy | `+ antigravity-deploy` |

---

## Checklist — Antes de Qualquer Ação

- [ ] Li esta skill e entendo as regras?
- [ ] Li a skill do meu módulo específico?
- [ ] Li `antigravity-code-standards`?
- [ ] Sei exatamente quais pastas posso tocar?
- [ ] A onda anterior foi validada pelo Coordenador?
- [ ] O escopo da tarefa está 100% definido?
- [ ] Tenho dúvidas que precisam ser escaladas antes de começar?

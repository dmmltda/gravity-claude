---
name: antigravity-qa
description: "Use esta skill quando o agente estiver operando no papel de QA do projeto Gravity. O QA é acionado após qualquer entrega de código e realiza revisão completa: código, padrões, segurança, tenant isolation e validação dos três tipos de testes (Unitários, Integração e E2E) antes da aprovação final."
---

# Gravity — QA

## Papel e Responsabilidade

- Atuar como o guardião final da qualidade.
- Revisar cada arquivo alterado na onda.
- Garantir que as regras de isolamento de tenant nunca sejam violadas.
- Validar se o plano de testes E2E cobre todas as categorias obrigatórias.

---

## Ordem de Prioridade na Revisão

1. **Segurança e Tenant Isolation** — Crítico. Falha aqui reprova imediatamente.
2. **Padrões de Código e Arquitetura** — Importante. Correções obrigatórias.
3. **Cobertura de Testes** — Obrigatório. Mínimo 80% em lógica crítica.
4. **UX/UI e Layout** — Percy deve estar limpo.

---

## Fluxo de Trabalho do QA

1. **Trigger:** Recebe a notificação de "Pronto para QA".
2. **Análise de Diff:** Compara o estado atual com o anterior.
3. **Checklist:** Percorre a lista completa abaixo.
4. **Execução de Testes:** Roda o pipeline de CI/CD local ou remoto.
5. **Veredito:** Reporta `Aprovado` ou `Reprovado` com a lista de pendências.

---

## Checklist Completo de Revisão

### 1 — Segurança

- [ ] Nenhuma rota aceita `req.body` sem validação Zod
- [ ] Nenhum dado sensível exposto em logs ou respostas
- [ ] JWT validado em toda rota protegida via `@clerk/backend`
- [ ] `x-internal-key` presente em toda chamada entre serviços internos
- [ ] Nenhuma variável de ambiente hardcoded no código
- [ ] Nenhum `console.log` expondo dados de usuário ou tenant

### 2 — Tenant Isolation

> Consultar `antigravity-tenant-routing` como referência base.

- [ ] Toda query ao DB servicos-tenant filtra por `tenant_id`
- [ ] Middleware `withTenantIsolation` está aplicado no servidor
- [ ] RLS policy existe para cada tabela nova criada
- [ ] Nenhuma query usa `findMany` sem `where: { tenant_id }`
- [ ] Criações sempre injetam `tenant_id` automaticamente via middleware
- [ ] Nenhum endpoint retorna dados de múltiplos tenants misturados

### 3 — Padrões de Código

> Consultar `antigravity-api-design` como referência base.

- [ ] Todo arquivo é `.ts` ou `.tsx` — nenhum `.js` novo aceito
- [ ] `strict: true` no tsconfig sem supressões com `@ts-ignore`
- [ ] Nenhum `any` explícito — tipos definidos para tudo
- [ ] ESModules em todo arquivo (`import/export`, não `require`)
- [ ] Toda rota tem schema Zod antes de tocar o banco
- [ ] Error handler global registrado no servidor Express
- [ ] Erros lançados via `AppError` — não `res.status().json()` direto nas rotas
- [ ] Naming: PascalCase para componentes e models, camelCase para funções, snake_case para campos de banco

### 4 — Testes

- [ ] Pasta `testes/` na raiz contém os arquivos do módulo na estrutura correta
- [ ] Testes unitários presentes e passando
- [ ] Testes funcionais presentes e passando
- [ ] Cobertura unitária ≥ 80% para `nucleo-global`, ≥ 70% para demais módulos
- [ ] Teste de cross-tenant implementado para serviços de tenant
- [ ] Plano de testes E2E criado e aprovado pelo dono antes da execução
- [ ] Specs E2E implementam exatamente o plano aprovado
- [ ] Categoria 11 (testes específicos do produto) preenchida e aprovada pelo dono
- [ ] Snapshots Percy capturados para todos os estados principais
- [ ] Resultados salvos em `testes/[tipo]/resultados/`
- [ ] Todos os testes passam sem warnings ou erros

### 5 — Arquitetura e Escopo

- [ ] O agente só tocou nas pastas autorizadas na tarefa distribuída pelo Líder
- [ ] Nenhum componente do `nucleo-global` foi modificado por agente fora da Onda 2
- [ ] Nenhum serviço de tenant importa código de outro serviço de tenant
- [ ] Serviços de produto não acessam o banco do Configurador diretamente
- [ ] Produtos não acessam o banco de outros produtos
- [ ] Imports usam aliases configurados (`@nucleo/`, `@tenant/`, `@produto/`)
- [ ] `Fragment.prisma` não modifica o `schema.prisma` final diretamente

### 6 — Qualidade Geral

- [ ] Nenhuma função com mais de 50 linhas sem justificativa
- [ ] Nenhum bloco de código comentado esquecido
- [ ] Todas as exportações tipadas — sem exportações implícitas
- [ ] Correlation ID propagado em toda chamada entre serviços
- [ ] Health check implementado no servidor se for novo serviço
- [ ] Variáveis de ambiente documentadas no template `.env.example`

---

## Cobertura Obrigatória do Plano E2E

O plano de testes deve cobrir **todas** as categorias abaixo sem exceção. Se uma categoria não se aplica, deve ser marcada como "não aplicável" com justificativa — nunca omitida.

### Categoria 1 — Operações CRUD
- [ ] Criar um registro — caminho feliz
- [ ] Criar múltiplos registros em sequência
- [ ] Criar com dados inválidos — validação de erro
- [ ] Visualizar detalhes de um registro
- [ ] Editar um registro — caminho feliz
- [ ] Editar com dados inválidos — validação de erro
- [ ] Deletar um registro
- [ ] Deletar múltiplos registros (operação em massa)
- [ ] Tentar deletar registro inexistente — tratamento de erro

### Categoria 2 — Filtros e Busca
- [ ] Aplicar cada filtro individualmente
- [ ] Combinar dois ou mais filtros simultaneamente
- [ ] Busca por texto — resultado encontrado
- [ ] Busca por texto — resultado não encontrado
- [ ] Limpar filtros e confirmar que lista volta ao estado original
- [ ] Paginação com filtro ativo

### Categoria 3 — Selects e Dropdowns
- [ ] Abrir o select e confirmar que todas as opções aparecem
- [ ] Selecionar cada opção individualmente e confirmar o efeito
- [ ] Select com busca interna — filtrar opções
- [ ] Select múltiplo — selecionar mais de uma opção
- [ ] Desmarcar uma opção selecionada
- [ ] Selecionar tudo / desmarcar tudo (quando disponível)

### Categoria 4 — Importação e Exportação
- [ ] Importar arquivo no formato correto — sucesso
- [ ] Importar arquivo com formato incorreto — erro tratado
- [ ] Importar arquivo com dados inválidos — erro por linha reportado
- [ ] Exportar lista completa em todos os formatos disponíveis (CSV, Excel, JSON, XML)
- [ ] Exportar com filtro ativo — confirmar que exporta apenas o filtrado
- [ ] Baixar modelo de importação

### Categoria 5 — Navegação e Layout
- [ ] Menu lateral expandindo e retraindo
- [ ] Navegação entre todas as seções do produto
- [ ] Navegação entre produto e serviços de tenant
- [ ] Breadcrumb ou indicador de rota ativa correto
- [ ] Botão voltar funciona corretamente
- [ ] Rota direta via URL — acesso autorizado e não autorizado

### Categoria 6 — Modais e Formulários
- [ ] Abrir modal — conteúdo correto
- [ ] Fechar modal pelo botão X
- [ ] Fechar modal clicando fora (quando aplicável)
- [ ] Submeter formulário vazio — validações aparecem
- [ ] Submeter formulário parcialmente preenchido — validações corretas
- [ ] Submeter formulário completo — sucesso
- [ ] Campos obrigatórios marcados corretamente
- [ ] Tabs dentro do modal — todas navegáveis

### Categoria 7 — Estados de Interface
- [ ] Estado de loading durante operações assíncronas
- [ ] Estado vazio (lista sem registros) — mensagem e ação correta
- [ ] Estado de erro (serviço indisponível) — mensagem e retry
- [ ] Toast de sucesso após operações
- [ ] Toast de erro após falha
- [ ] Confirmação antes de deletar — cancelar e confirmar

### Categoria 8 — Operações em Massa
- [ ] Selecionar um registro via checkbox
- [ ] Selecionar vários registros
- [ ] Selecionar todos via checkbox global
- [ ] Desmarcar todos
- [ ] Ação em massa sobre selecionados (editar, deletar, exportar)
- [ ] Confirmação antes de ação destrutiva em massa

### Categoria 9 — Visualizações
- [ ] Alternar entre visualização lista e kanban (quando disponível)
- [ ] Estado correto preservado ao voltar para a visualização
- [ ] Ordenação por coluna — crescente e decrescente
- [ ] Colunas visíveis/ocultas (quando configurável)

### Categoria 10 — Validação Visual com Percy
- [ ] Screenshot do estado padrão — sem dados
- [ ] Screenshot do estado com dados preenchidos
- [ ] Screenshot de modal aberto
- [ ] Screenshot de estado de erro
- [ ] Screenshot de filtros aplicados
- [ ] Validar tipografia: fonte correta, tamanhos, pesos conforme design system
- [ ] Validar ícones: presentes, tamanho correto, posição correta
- [ ] Validar espaçamentos: padding, margin, gap entre elementos
- [ ] Validar responsividade: tela cheia e tela reduzida

### Categoria 11 — Testes Específicos do Produto

Esta categoria só existe após a criação do produto e não pode ser antecipada.

**Fluxo obrigatório:**
1. Produto é criado e entregue pelo agente responsável
2. QA lista os fluxos específicos do domínio e submete ao dono
3. Dono aprova ou ajusta a lista
4. QA incorpora os fluxos aprovados ao plano de testes E2E
5. Somente após aprovação: QA cria os specs e executa

> **Regra:** nenhum produto é considerado validado sem esta categoria preenchida e aprovada pelo dono — mesmo que todas as outras 10 categorias passem.

---

## Template do Plano de Testes E2E

```markdown
# Plano de Testes E2E — [nome do módulo]

**Data:** [data]
**Versão:** [versão]
**Status:** aguardando aprovação do dono

## Escopo
[O que será testado e o que está fora do escopo]

## Entidades testadas
[Lista de entidades/telas cobertas]

## Categorias cobertas
- [ ] CRUD
- [ ] Filtros e Busca
- [ ] Selects e Dropdowns
- [ ] Importação e Exportação
- [ ] Navegação e Layout
- [ ] Modais e Formulários
- [ ] Estados de Interface
- [ ] Operações em Massa
- [ ] Visualizações
- [ ] Validação Visual (Percy)
- [ ] Testes específicos do produto (definidos após criação, aprovados pelo dono)

## Fluxos detalhados

### Fluxo [N] — [nome]
**Categoria:** [categoria]
**Pré-condição:** [estado inicial necessário]
**Passos:**
1. [passo]
2. [passo]
**Resultado esperado:** [o que deve acontecer]
**Critério de falha:** [o que caracteriza falha]

## Dados de teste necessários
[Quais dados precisam existir antes de rodar]

## Categorias não aplicáveis
[Lista com justificativa para cada categoria omitida]

## Ambiente
Staging — nunca produção
```

---

## Como Reportar o Resultado

### ✅ Aprovado

```text
### QA — [nome do módulo] — APROVADO

**Revisado em:** [data]
**Agente que entregou:** [nome]

**Testes executados:**
- Unitários: [X] passaram, cobertura [Y]%
- Funcionais: [X] passaram
- E2E: [X] fluxos validados em [X] categorias (plano aprovado em [data])
- Visual (Percy): [X] snapshots aprovados

Todos os itens do checklist passaram. Entrega liberada.
```

### ❌ Reprovado

```text
### QA — [nome do módulo] — REPROVADO

**Revisado em:** [data]
**Agente que entregou:** [nome]

**Itens que falharam:**

#### [categoria] — [item específico]
**Problema:** [descrição clara do que está errado]
**Arquivo:** [caminho do arquivo]
**Linha:** [número se aplicável]
**Correção esperada:** [o que precisa ser feito]

---
[repetir para cada item que falhou]

**Próximo passo:** retornar ao agente [nome] para correção.
Após correção, QA deve ser acionado novamente.
```

---

## Regras que o QA nunca viola

- **Nunca aprova entrega com falha de tenant isolation** — bloqueio imediato
- **Nunca aprova entrega com falha de segurança** — bloqueio imediato
- **Nunca aprova sem os três tipos de teste presentes e passando**
- **Nunca cria specs E2E sem plano aprovado pelo dono** — bloqueio absoluto
- **Nunca omite categoria do plano** sem justificativa explícita
- **Nunca corrige o código ele mesmo** — identifica e devolve ao agente
- **Sempre referencia arquivo e linha** ao reportar um problema
- **Sempre aciona o Líder** ao concluir a revisão, aprovada ou não

---

## Skills de Referência Obrigatórias

| Para validar | Consultar |
|:---|:---|
| Tenant isolation | `antigravity-tenant-routing` |
| Padrões de código | `antigravity-api-design` |
| Como escrever testes | `antigravity-database` |

---

## Checklist — Antes de Emitir o Veredito Final

- [ ] Todas as 6 categorias do checklist de revisão foram percorridas?
- [ ] Segurança e tenant isolation: nenhuma falha encontrada?
- [ ] Os três tipos de testes estão presentes e passando?
- [ ] O plano E2E foi aprovado pelo dono antes de rodar?
- [ ] Todas as 11 categorias do plano E2E estão cobertas ou justificadas?
- [ ] O template de reporte (Aprovado ou Reprovado) foi preenchido?
- [ ] O Líder foi acionado com o resultado?

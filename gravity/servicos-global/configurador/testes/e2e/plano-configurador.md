# Plano de Testes E2E — Configurador

**Data:** 2026-03-22
**Versão:** 0.1.0
**Status:** aguardando aprovação do dono

---

## Escopo

**Dentro do escopo:**
- Admin Panel do Configurador (interface de gestão de workspace)
- Formulários de criação de tenant, empresa filha e usuário
- Modais de confirmação e feedback de operações
- Estados de interface: loading, vazio, erro e sucesso

**Fora do escopo (Onda 2 — infraestrutura base):**
- Fluxo de billing e Stripe (frontend ainda não implementado)
- Gateway de redirecionamento para produtos (sem produto ativo)
- Notificações por e-mail (serviço de e-mail não configurado nesta onda)
- Testes de permissões granulares por produto (produtos não existem ainda)

---

## Entidades testadas

- Tenant (empresa mãe)
- Company (empresa filha)
- UserMembership (vínculo usuário ↔ tenant)
- UserEnablement (habilitação de usuário em empresa filha)

---

## Categorias cobertas

- [ ] CRUD — **não aplicável** (ver justificativa abaixo)
- [ ] Filtros e Busca — **não aplicável**
- [ ] Selects e Dropdowns — **não aplicável**
- [ ] Importação e Exportação — **não aplicável**
- [x] Navegação e Layout — **aplicável**
- [x] Modais e Formulários — **aplicável**
- [x] Estados de Interface — **aplicável**
- [ ] Operações em Massa — **não aplicável**
- [ ] Visualizações — **não aplicável**
- [ ] Validação Visual (Percy) — **não aplicável**
- [ ] Testes específicos do produto — **não aplicável**

---

## Fluxos detalhados

### Fluxo 1 — Navegação entre seções do Admin Panel
**Categoria:** Navegação e Layout
**Pré-condição:** Usuário autenticado via Clerk com role admin no tenant
**Passos:**
1. Acessar `/workspace`
2. Clicar em "Empresas" no menu lateral
3. Clicar em "Usuários" no menu lateral
4. Clicar em "Assinaturas" no menu lateral
5. Clicar em "Configurações" no menu lateral
**Resultado esperado:** Cada seção carrega sem erro; rota ativa destacada no menu
**Critério de falha:** Qualquer seção retorna erro 404, tela em branco ou rota ativa incorreta

---

### Fluxo 2 — Acesso direto via URL autorizado e não autorizado
**Categoria:** Navegação e Layout
**Pré-condição:** Dois usuários: um com role admin, outro sem autenticação
**Passos:**
1. Usuário admin acessa `/workspace/empresas` diretamente pela URL
2. Usuário não autenticado tenta acessar `/workspace/empresas` diretamente
**Resultado esperado:** Admin acessa normalmente; não autenticado é redirecionado para login
**Critério de falha:** Usuário não autenticado consegue visualizar qualquer dado

---

### Fluxo 3 — Criar empresa filha via modal (caminho feliz)
**Categoria:** Modais e Formulários
**Pré-condição:** Tenant existente com pelo menos uma empresa mãe
**Passos:**
1. Navegar para `/workspace/empresas`
2. Clicar em "Nova Empresa"
3. Modal abre com formulário de criação
4. Preencher "Nome" e "Subdomínio" com dados válidos
5. Clicar em "Salvar"
**Resultado esperado:** Modal fecha; nova empresa aparece na lista; toast de sucesso exibido
**Critério de falha:** Empresa não aparece na lista após salvar, ou toast de erro é exibido

---

### Fluxo 4 — Criar empresa filha com dados inválidos
**Categoria:** Modais e Formulários
**Pré-condição:** Modal de criação de empresa aberto
**Passos:**
1. Submeter formulário com campo "Nome" vazio
2. Submeter formulário com subdomínio já existente
**Resultado esperado:** Mensagens de validação inline; formulário não fecha; nenhum registro criado
**Critério de falha:** Formulário fecha sem criar registro, ou erro genérico sem indicar o campo

---

### Fluxo 5 — Fechar modal de criação sem salvar
**Categoria:** Modais e Formulários
**Pré-condição:** Modal de criação de empresa aberto com dados preenchidos
**Passos:**
1. Preencher o formulário parcialmente
2. Clicar no botão X do modal
3. Repetir clicando fora do modal
**Resultado esperado:** Modal fecha; dados preenchidos são descartados; nenhum registro criado
**Critério de falha:** Dados persistem ao reabrir o modal, ou modal não fecha

---

### Fluxo 6 — Convidar usuário para o tenant (caminho feliz)
**Categoria:** Modais e Formulários
**Pré-condição:** Tenant existente; e-mail do novo usuário válido e não cadastrado
**Passos:**
1. Navegar para `/workspace/usuarios`
2. Clicar em "Convidar Usuário"
3. Preencher e-mail e selecionar role "Standard"
4. Clicar em "Enviar Convite"
**Resultado esperado:** Modal fecha; usuário aparece na lista com status "Pendente"; toast de sucesso
**Critério de falha:** Usuário não aparece na lista, ou status incorreto

---

### Fluxo 7 — Estado de loading durante criação
**Categoria:** Estados de Interface
**Pré-condição:** Modal de criação preenchido com dados válidos
**Passos:**
1. Clicar em "Salvar"
2. Observar estado imediatamente após o clique enquanto request está em andamento
**Resultado esperado:** Botão desabilitado ou spinner visível; formulário não pode ser submetido novamente
**Critério de falha:** Duplo submit possível; nenhum indicador visual de carregamento

---

### Fluxo 8 — Estado vazio (sem empresas filhas)
**Categoria:** Estados de Interface
**Pré-condição:** Tenant sem nenhuma empresa filha cadastrada
**Passos:**
1. Navegar para `/workspace/empresas`
**Resultado esperado:** Mensagem de estado vazio exibida (ex: "Nenhuma empresa cadastrada"); botão de criação visível
**Critério de falha:** Tela em branco sem mensagem; ou lista exibe itens fantasma

---

### Fluxo 9 — Estado de erro (serviço indisponível)
**Categoria:** Estados de Interface
**Pré-condição:** API do configurador offline ou retornando 500
**Passos:**
1. Navegar para `/workspace/empresas` com API indisponível
**Resultado esperado:** Mensagem de erro amigável exibida; botão de retry disponível
**Critério de falha:** Tela em branco; erro de JavaScript exposto; sem opção de retry

---

### Fluxo 10 — Toast de sucesso e de erro
**Categoria:** Estados de Interface
**Pré-condição:** Tenant configurado
**Passos:**
1. Criar empresa com sucesso → observar toast
2. Criar empresa com subdomínio duplicado → observar toast
**Resultado esperado:** Toast verde para sucesso; toast vermelho para erro; ambos desaparecem automaticamente
**Critério de falha:** Nenhum toast exibido; toast permanece na tela indefinidamente

---

## Dados de teste necessários

- Tenant de staging já criado com ID conhecido
- Usuário admin com Clerk ID ativo no tenant de staging
- Ao menos uma empresa filha para testes de edição e estado preenchido
- Subdomínio reservado para teste de duplicidade

---

## Categorias não aplicáveis

| Categoria | Justificativa |
|:---|:---|
| CRUD | Onda 2 entrega apenas a API REST. O frontend Admin Panel não foi implementado nesta onda — operações CRUD via interface ainda não existem. |
| Filtros e Busca | Nenhuma tela de listagem com filtros foi implementada no frontend nesta onda. |
| Selects e Dropdowns | Componentes de select são parte do frontend que será construído na Onda 3. |
| Importação e Exportação | Funcionalidade não prevista para o Configurador em nenhuma onda atual. |
| Operações em Massa | Seleção múltipla de registros não faz parte do escopo do Configurador nesta onda. |
| Visualizações | Alternância entre visualizações (lista/kanban) não se aplica ao Admin Panel do Configurador. |
| Validação Visual (Percy) | Frontend ainda não implementado — sem snapshots possíveis nesta onda. |
| Testes específicos do produto | Categoria 11 aplicável somente após produto completo ser entregue e aprovado pelo dono. |

---

## Ambiente

Staging — nunca produção

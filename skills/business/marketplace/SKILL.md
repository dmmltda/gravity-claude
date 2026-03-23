---
name: antigravity-marketplace
description: "Use esta skill sempre que uma tarefa envolver o Marketplace da plataforma Gravity. O Marketplace é a vitrine pública de vendas — 100% frontend, sem backend de negócio, sem autenticação e funciona como ponto de entrada do ecossistema. Documenta: localização na árvore (servicos-global/marketplace/), estrutura de pastas, 5 telas obrigatórias (home, produtos, preços, trial, checkout), jornada completa do usuário com 3 fluxos críticos de conversão (onboarding silencioso, pagamento sem fricção e recuperação de atenção), redirecionamentos para o Configurador com parâmetros de query string e o que o Marketplace NUNCA faz."
---

# Gravity — Marketplace

## O Que é o Marketplace

A vitrine pública de vendas da plataforma Gravity. Primeiro ponto de contato de um potencial cliente com o ecossistema.

> **Princípio:** o Marketplace vende. O Configurador converte.
> **Modelo:** Product-Led Growth — o usuário vivencia o valor antes de pagar.

---

## Posição no Ecossistema

```text
Visitante
  ↓
Marketplace (marketplace.gravity.com.br)  ← vitrine, sem autenticação
  ↓ clica em "Teste Grátis" ou "Assinar"
Configurador (configurador.gravity.com.br)  ← cria conta, escolhe plano, paga
  ↓
Produto (produto.gravity.com.br)  ← trabalho real começa aqui
```

---

## Características Técnicas

- **100% frontend** — sem servidor de negócio
- **Estático ou SSR** — Next.js ou Astro para SEO otimizado
- **Sem autenticação** — nenhuma tela exige login
- **Sem acesso a banco de dados** — apenas conteúdo, demos e links
- **Porta:** 3004 no Railway
- **Independente:** deployável a qualquer momento, sem dependência de outros serviços

---

## Localização na Árvore

```text
servicos-global/
├── tenant/
├── produto/
├── marketplace/    ← AQUI
├── configurador/
└── devops/
```

## Estrutura de Pastas

```text
servicos-global/marketplace/
├── home/                     ← landing page geral do Gravity
├── produtos/                 ← landing pages específicas
│   ├── simulador-comex/
│   └── nf-importacao/
├── precos/                   ← tabela de planos
├── trial/                    ← onboarding de teste
└── checkout/                 ← resumo antes de ir para o Configurador
```

---

## A Jornada do Usuário — Macro Fluxo A/A/R/R/R

| Estágio | Ação no Marketplace |
|:---|:---|
| **Aquisição** | Visitante chega no `/` via busca ou anúncio |
| **Ativação** | Ele inicia um `trial` e vê o sistema funcionando com *mock data* em < 60s |
| **Retenção** | Ele volta para ler documentação de um produto específico |
| **Receita** | Ele clica em "Assinar" e é redirecionado para o checkout do Configurador |
| **Recomendação** | Exportação de código gera tração natural entre desenvolvedores |

---

## Fluxo A — Onboarding B2B Silencioso (Time-to-Value Rápido)

Ninguém quer tutorial. O usuário precisa sentir valor em menos de 60 segundos.

```text
1. Usuário clica "Iniciar Preview" na Landing Page
2. Modal enxuto abre:
   - "Qual o tema da sua empresa?"
   - Usuário seleciona 1 cor base
   - Sistema inteiro se repinta em tempo real (dopamina imediata)
3. Wizard de 3 passos:
   - Passo 1: Upload/Setup → concluído automaticamente
   - Passo 2: "Você é Dev, Designer ou Manager?" → 3 botões grandes
   - Passo 3: Dashboard com mock data habitado → entrega imediata de valor
4. Usuário está dentro do produto — sem pedir cartão
```

> **Regra:** nenhum passo pode exigir mais de 1 clique ou 1 input. Se precisar de mais, simplificar.

---

## Fluxo B — Pagamento / Upgrade (Fricção Zero)

```text
1. Usuário tenta usar feature premium
2. Micro-bloqueio suave: Toast warning ou badge âmbar
   "Feature Pro: Destrave o filtro avançado para sua equipe"
3. Modal de Checkout abre IN-APP (não redireciona):
   ┌─────────────────────┬─────────────────────┐
   │ O componente exato  │ Formulário de cartão │
   │ que ele quer usar   │ com validação        │
   │ (demo/sandbox)      │ em tempo real        │
   └─────────────────────┴─────────────────────┘
4. Validação visual imediata (borda verde ao digitar número válido)
5. Pagamento confirmado → redireciona para o Configurador
```

> **Regra:** nunca redirecionar para página externa para pagar. O checkout acontece dentro do contexto onde o usuário já está.

---

## Fluxo C — Recuperação de Atenção (Intervenção Ativa)

Se o usuário tenta fechar a guia sem converter após interagir com a demo.

```text
Gatilho: mouseleave do cursor saindo da área do browser (topo da tela)
  ↓
Drawer lateral (não modal bloqueante) abre à direita
  ↓
Mensagem personalizada: "Vimos que você gostou do Simulador Comex.
Quer salvar seu progresso para testar depois?"
  ↓
CTA: "Salvar por e-mail" (apenas 1 campo de texto)
  ↓
Envia link direto para a sessão salva no Configurador
```

---

## Telas Obrigatórias

### Home — `/`
- Hero principal com promessa de valor clara
- Social proof (logos de empresas e depoimentos reais)
- Showcase interativo (usuário mexe em algum componente real)
- Tabela de preços resumida
- Footer global

### Página de Produto — `/produtos/[nome-do-produto]`
- Nome e descrição do produto
- Funcionalidades principais em cards
- Demo interativa ou screenshots reais
- Para quem é indicado
- **CTA:** "Teste Grátis" → `/trial?produto=[id]`
- **CTA:** "Assinar" → `/checkout?produto=[id]&plano=[plano]`

### Preços — `/precos`
- Tabela comparativa de planos (básico, profissional, enterprise)
- O que está incluído em cada plano
- Destaque do plano mais popular
- CTA por plano → redireciona para o Configurador
- **Lei de Hick:** máximo 3 planos visíveis. Enterprise oculto atrás de "Falar com vendas"

### Trial — `/trial`
- O que está incluído no trial (lista clara)
- Duração do período gratuito
- **Sem pedido de cartão**
- CTA: "Mão na massa" → redireciona para o Configurador

### Checkout — `/checkout`
- Item selecionado e valor
- Resumo de benefícios (bullet points de segurança)
- Botão "Confirmar e Ir para Setup" → leva ao Configurador

---

## Redirecionamentos para o Configurador

Todos os links de conversão usam parâmetros de query string:

| Parâmetro | Valores | Quando usar |
|:---|:---|:---|
| `produto` | simulador-comex, nf-importacao, etc. | Produto específico |
| `plano` | basico, profissional, enterprise | Plano selecionado |
| `trial` | true | Trial gratuito |

**Exemplos:**
- `configurador.gravity.com.br/checkout?produto=simulador-comex&plano=profissional`
- `configurador.gravity.com.br/trial?produto=simulador-comex&trial=true`

---

## O Que o Marketplace NUNCA Faz

- Nunca processa pagamento
- Nunca cria conta de usuário
- Nunca acessa banco de dados de negócio
- Nunca valida se o visitante já é cliente
- Nunca exige autenticação
- Nunca redireciona para página externa para fechar compra
- Nunca usa modal bloqueante para intervenção de atenção

---

## Variáveis de Ambiente

```bash
# servicos-global/marketplace/.env.example
CONFIGURADOR_URL=https://configurador.gravity.com.br
PORT=3004
```

---

## Arquitetura de Informação

### Hierarquia Tipográfica Obrigatória

| Tamanho | Uso |
|:---|:---|
| **text-micro** 10.5px uppercase | Labels, headers de tabela, status — nunca leitura longa |
| **text-small** 14px | Micro cópias de suporte |
| **text-body** 16px | Centro da leitura — onde as ações normais acontecem |

### Lei de Hick em Menus
- Máximo 5 itens visíveis em qualquer navegação
- Ações secundárias ocultas em ícones de três pontos
- Selects nativos substituídos por Advanced Select

---

## Checklist — Antes de Entregar

- [ ] Home com hero, social proof, showcase interativo, pricing e footer?
- [ ] Página individual para cada produto com demo interativa?
- [ ] Página de preços com máximo 3 planos visíveis?
- [ ] Trial sem pedido de cartão?
- [ ] Checkout com resumo claro antes de redirecionar?
- [ ] Fluxo A (onboarding) funcional em menos de 3 cliques?
- [ ] Fluxo B (paywall) in-app sem redirecionamento externo?
- [ ] Fluxo C (recuperação) via drawer, nunca modal bloqueante?
- [ ] Todos os CTAs redirecionam para o Configurador com parâmetros corretos?
- [ ] Nenhum acesso a banco de dados ou API de negócio?
- [ ] SEO: title, description e og:tags em cada página?
- [ ] `CONFIGURADOR_URL` via variável de ambiente?
- [ ] Serviço criado no Railway na porta 3004?

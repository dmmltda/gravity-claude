---
name: antigravity-simulador-comex
description: "Use esta skill quando uma tarefa envolver o produto Simulador Comex. ATENÇÃO: esta skill é um placeholder ativo. Ao ser invocada, o agente deve parar imediatamente e solicitar todas as regras de negócio ao dono do projeto antes de criar qualquer arquivo, estrutura ou código."
---

# Gravity — Simulador Comex

## ⚠️ BLOQUEIO OBRIGATÓRIO

Esta skill está incompleta. **Nenhum código pode ser criado.**

Ao invocar esta skill, o agente deve **parar imediatamente** e enviar o questionário abaixo ao dono do projeto antes de qualquer ação.

---

## Simulador Comex — Coleta de Regras de Negócio

Antes de iniciar o desenvolvimento do Simulador Comex, preciso que você responda as perguntas abaixo. Nenhum arquivo será criado antes de todas as respostas serem coletadas e confirmadas.

### 1 — Visão Geral
- O que é o Simulador Comex? Qual problema ele resolve?
- Quem são os usuários que vão usar?
- Qual é o fluxo principal de uso (do início ao fim)?

### 2 — Telas e Páginas
- Quais são as telas/páginas do produto?
- O que o usuário pode fazer em cada tela?
- Qual é a tela principal (home do produto)?

### 3 — Entidades e Dados
- Quais são as entidades principais do domínio? (ex: simulação, item, tarifa)
- Quais campos cada entidade tem?
- Como as entidades se relacionam entre si?

### 4 — Regras de Negócio
- Quais são os cálculos que o produto precisa fazer?
- Quais são as validações obrigatórias?
- Há integrações com sistemas externos (Receita Federal, tabelas de tarifas)?
- Há regras de permissão específicas por papel de usuário?

### 5 — Serviços
- Quais serviços de tenant este produto usa? (atividades, email, whatsapp, dashboard, relatórios, histórico, agenda, gabi)
- Precisa de helpdesk?
- Há algum serviço específico que não está no catálogo padrão?

### 6 — Integrações e Importações
- O produto precisa importar dados? Em qual formato?
- O produto precisa exportar dados? Em qual formato?
- Há integração com outras ferramentas ou APIs externas?

### 7 — Estados e Fluxos
- Quais são os status possíveis das entidades principais?
- Há aprovações ou fluxos de trabalho com múltiplos passos?
- Há notificações automáticas? Para quem e quando?

> Após receber todas as respostas, esta skill será atualizada com as regras definidas e somente então o desenvolvimento pode ser iniciado.

---

## Status

| Campo | Valor |
|:---|:---|
| **Status** | 🔴 Placeholder — aguardando regras de negócio |
| **Responsável** | Dono do projeto |
| **Próximo passo** | Dono responde o questionário acima |
| **Pode iniciar código?** | ❌ NÃO |

---

## O Que Será Preenchido Após Coleta

Quando o dono responder o questionário, esta skill será atualizada com:

- Visão geral e objetivo do produto
- Lista completa de telas e o que cada uma faz
- Entidades do domínio com seus campos e relacionamentos
- Regras de negócio e cálculos
- `PRODUCT_CONFIG` específico (serviços e navegação)
- Integrações externas necessárias
- Fluxos e status das entidades
- Qualquer regra específica que diferencie este produto dos demais

---

## Regra Absoluta

**Nenhum agente cria qualquer arquivo do Simulador Comex sem esta skill estar completa e aprovada pelo dono do projeto.**

Se um agente receber uma tarefa relacionada ao Simulador Comex sem esta skill estar preenchida → **parar**, enviar o questionário ao dono e aguardar.

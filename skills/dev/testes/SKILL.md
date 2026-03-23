---
name: antigravity-testes
description: "Use esta skill sempre que uma tarefa envolver criação ou execução de testes no projeto Gravity. Define a estrutura de pastas central, configurações técnicas de Vitest e Playwright, exemplos de código, cobertura obrigatória por módulo e contract tests com Zod. Para o processo de revisão, papel do QA e categorias obrigatórias do plano E2E, consultar antigravity-qa."
---

# Gravity — Testes

## Responsabilidades

| Tipo | Ferramenta | Responsável |
|:---|:---|:---|
| Unitários | Vitest | Agente que entregou o código |
| Funcionais | Vitest | Agente que entregou o código |
| E2E — plano | Playwright + Percy | QA cria, dono aprova |
| E2E — execução | Playwright + Percy | QA executa após aprovação do dono |

---

## Estrutura de Pastas — Central na Raiz

Todos os testes ficam em uma única pasta na raiz do monorepo. Nunca dentro de cada módulo — sempre centralizado.

```text
Gravity/
  └── testes/                       ← raiz do monorepo
      ├── testes-unitarios/          ← ÚNICO lugar de testes unitários
      │   ├── nucleo-global/
      │   │   ├── tabela-global/
      │   │   ├── modal-global/
      │   │   ├── shell/
      │   │   └── utilitarios-global/
      │   └── servicos-tenant/
      │       ├── atividades/
      │       ├── cronometro/
      │       ├── email/
      │       ├── whatsapp/
      │       ├── dashboard/
      │       ├── relatorios/
      │       ├── historico/
      │       ├── agendamento/
      │       ├── gabi/
      │       ├── produtos/
      │       └── simulador-comex/
      ├── testes-funcionais/
      │   ├── nucleo-global/
      │   ├── servicos-tenant/
      │   └── produtos/
      └── testes-e2e/
          ├── nucleo-global/
          ├── servicos-tenant/
          ├── produtos/
          └── simulador-comex/
              ├── plano-de-testes.md
              ├── funcional/
              ├── visual/
              └── resultados/
```

**Por que central:** um único lugar para rodar todos os testes, CI/CD aponta para um caminho só, visão consolidada de cobertura total, imports via aliases sem caminhos relativos frágeis.

---

## Testes Unitários — Vitest

### O que testar
- Toda função pura: formatadores, validadores, utilitários, helpers
- Todo componente do `nucleo-global` isolado
- Todo schema Zod — casos válidos, inválidos, de borda
- Toda lógica de negócio isolada nos services

### Cobertura mínima obrigatória
- `nucleo-global/`: **80%**
- Demais módulos: **70%**

### Regras
- Cada função pública tem pelo menos um teste para o caminho feliz e um para o caminho de erro
- Componentes React testados com `@testing-library/react` — testar comportamento, não implementação
- Mocks apenas para dependências externas — nunca mockar o que está sendo testado
- Nenhum `describe.skip` ou `it.skip` sem justificativa documentada no próprio teste

### Configuração padrão

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',   // 'jsdom' para componentes React
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './testes/testes-unitarios/resultados',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
      }
    },
  }
})
```

### Exemplo

```typescript
// testes/testes-unitarios/nucleo-global/utilitarios-global/formatadores.test.ts
import { describe, it, expect } from 'vitest'
import { formatarCNPJ, formatarMoeda } from '@nucleo/utilitarios-global'

describe('formatarCNPJ', () => {
  it('formata CNPJ válido corretamente', () => {
    expect(formatarCNPJ('12345678000195')).toBe('12.345.678/0001-95')
  })

  it('retorna string vazia para CNPJ inválido', () => {
    expect(formatarCNPJ('123')).toBe('')
  })

  it('lida com CNPJ já formatado', () => {
    expect(formatarCNPJ('12.345.678/0001-95')).toBe('12.345.678/0001-95')
  })
})
```

---

## Testes Funcionais — Vitest

### O que testar
- Toda rota da API com banco de teste real — nunca mock de banco
- Middleware de tenant isolation — tentativa de acesso cross-tenant obrigatória
- Fluxos de negócio completos no backend
- Autenticação e autorização: token válido, inválido, expirado, sem permissão
- Composição de schema — fragment compila e gera models corretos

### Cobertura obrigatória
- Rotas críticas (auth, financeiro, tenant isolation): **100%**
- Demais rotas: mínimo **70%**
- Nenhuma rota sobe para a onda seguinte sem teste funcional correspondente

### Regras
- Banco de teste isolado por suite — nunca compartilhar estado entre testes
- Cada teste limpa seus dados ao final (`afterEach` ou `afterAll`)
- Testar caminho feliz, caminho de erro e caso de borda
- **NUNCA** mockar o banco de dados nos testes funcionais
- Validar o estado final do banco de dados após a operação

### Configuração padrão

```typescript
// vitest.config.ts (testes funcionais)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./testes/testes-funcionais/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './testes/testes-funcionais/resultados',
    },
    outputFile: './testes/testes-funcionais/resultados/relatorio.json'
  }
})
```

### Setup obrigatório

```typescript
// testes/testes-funcionais/setup.ts
import { beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } }
})

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

### Exemplo

```typescript
// testes/testes-funcionais/servicos-tenant/atividades/activities.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '@tenant/atividades/server'
import { prisma } from '@tenant/prisma'

describe('GET /api/v1/activities', () => {
  afterEach(async () => {
    await prisma.activity.deleteMany({ where: { tenant_id: 'tenant-teste' } })
  })

  it('retorna atividades do tenant autenticado', async () => {
    await prisma.activity.create({
      data: {
        tenant_id: 'tenant-teste',
        title: 'Teste',
        user_id: 'user-1',
        status: 'PENDING'
      }
    })

    const response = await request(app)
      .get('/api/v1/activities')
      .set('Authorization', `Bearer ${tokenTenantTeste}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
  })

  it('não retorna atividades de outro tenant', async () => {
    await prisma.activity.create({
      data: {
        tenant_id: 'outro-tenant',
        title: 'Não deve aparecer',
        user_id: 'user-2',
        status: 'PENDING'
      }
    })

    const response = await request(app)
      .get('/api/v1/activities')
      .set('Authorization', `Bearer ${tokenTenantTeste}`)

    expect(response.body).toHaveLength(0)
  })
})
```

---

## Testes E2E — Playwright + Percy

> Para o processo completo de E2E (plano, 11 categorias obrigatórias, fluxo de aprovação do dono), consultar `antigravity-qa`.

### Configuração padrão do Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './testes/testes-e2e',
  outputDir: './testes/testes-e2e/resultados',
  reporter: [
    ['html', { outputFolder: './testes/testes-e2e/resultados/relatorio' }],
    ['json', { outputFile: './testes/testes-e2e/resultados/resultados.json' }]
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
})
```

### Configuração do Percy — validação visual

```typescript
import percySnapshot from '@percy/playwright'

test('estado padrão da tela principal', async ({ page }) => {
  await page.goto('/simulacoes')
  await percySnapshot(page, 'Simulações — estado padrão')
})

test('modal de criação aberto', async ({ page }) => {
  await page.goto('/simulacoes')
  await page.getByRole('button', { name: 'Nova simulação' }).click()
  await percySnapshot(page, 'Simulações — modal de criação')
})
```

### Regras
- Nenhum spec criado sem plano aprovado pelo dono
- Testes E2E rodam em staging — nunca em produção
- Screenshots e traces salvos automaticamente em falhas
- Resultados salvos em `testes/testes-e2e/[modulo]/resultados/`
- Todo teste E2E deve ter pelo menos um snapshot do Percy em pontos críticos
- Não usar seletores CSS frágeis — preferir `data-testid`
- O QA é o único que executa testes E2E em staging

---

## Contract Tests — Zod

Cada serviço de tenant exporta os schemas Zod dos seus endpoints. O mesmo schema que valida a rota serve como contrato da API. O CI valida que os contratos não foram quebrados antes do merge.

```typescript
// servicos-global/tenant/atividades/server/schemas.ts
import { z } from 'zod'

export const createActivitySchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']),
  due_date: z.string().datetime().optional(),
  user_id: z.string().cuid(),
  product_id: z.string().optional(),
})

export const activityResponseSchema = z.object({
  id: z.string().cuid(),
  tenant_id: z.string(),
  title: z.string(),
  status: z.string(),
  created_at: z.string().datetime(),
})

export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type ActivityResponse = z.infer<typeof activityResponseSchema>
```

Se um endpoint mudar o payload sem versionar, o contract test falha e bloqueia o merge no CI.

---

## Meta de Cobertura por Módulo

| Módulo | Unitário | Funcional | E2E |
|:---|:---|:---|:---|
| nucleo-global | 80% | N/A | Smoke tests |
| servicos-tenant (cada) | 70% | 100% rotas críticas | Por produto |
| produtos | 70% | 100% rotas críticas | 11 categorias obrigatórias |
| configurador | 70% | 100% auth + billing | Fluxo completo de onboarding |

---

## Checklist — Antes de Entregar Código com Testes

- [ ] Arquivos de teste na pasta `testes/` central na raiz do monorepo?
- [ ] Testes unitários cobrem funções puras e componentes?
- [ ] Cobertura unitária atinge o mínimo (80% nucleo, 70% demais)?
- [ ] Testes funcionais cobrem todas as rotas?
- [ ] Teste de cross-tenant implementado para serviços de tenant?
- [ ] Banco de teste limpo após cada suite funcional?
- [ ] Todos os testes passam sem warnings?
- [ ] Schemas Zod exportados como contratos de API?
- [ ] Para E2E: plano criado e enviado ao dono para aprovação?

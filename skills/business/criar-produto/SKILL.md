---
name: antigravity-criar-produto
description: "Use esta skill sempre que uma tarefa envolver a criação de um novo produto na plataforma Gravity. Define o checklist completo de criação: estrutura de pastas, PRODUCT_CONFIG, aliases Vite, tsconfig, server setup e composição do schema Prisma. Use no início da Onda 3, para preparar o terreno técnico de um novo produto."
---

# Gravity — Criar Produto

## Regra Fundamental

Antes de criar qualquer arquivo de produto, verificar:

1. A skill específica do produto existe e tem regras de negócio definidas?
2. O dono do projeto aprovou o início do desenvolvimento?
3. A Onda 2 foi concluída e validada pelo Coordenador?

Se qualquer resposta for **NÃO** → parar e notificar o Líder. Nunca criar estrutura de produto sem regras de negócio definidas.

---

## Estrutura Obrigatória de Todo Produto

```text
produtos/[nome-do-produto]/
├── index.html                    ← entrada do produto
├── package.json
├── tsconfig.json                 ← configuração TypeScript
├── vite.config.ts                ← bundler com aliases
│
├── src/
│   ├── App.tsx                   ← componente raiz, inicializa shell e rotas
│   └── main.tsx                  ← entry point React
│
├── pages/                        ← uma subpasta por tela específica do produto
│   └── [nome-da-tela]/
│       └── [NomeDaTela].tsx
│
├── shared/
│   ├── config.ts                 ← PRODUCT_CONFIG — service registry do produto
│   ├── state.ts                  ← estado local do produto
│   ├── api.ts                    ← endpoints específicos deste produto
│   └── types.ts                  ← tipos do domínio do produto
│
├── public/
└── assets/
```

---

## Passo a Passo de Criação

### Passo 1 — Criar a estrutura de pastas

```bash
mkdir -p produtos/[nome-do-produto]/src/pages
mkdir -p produtos/[nome-do-produto]/src/shared
mkdir -p produtos/[nome-do-produto]/public/assets
mkdir -p produtos/[nome-do-produto]/server/routes
mkdir -p produtos/[nome-do-produto]/server/services
mkdir -p produtos/[nome-do-produto]/server/prisma
```

---

### Passo 2 — Configurar package.json

```json
{
  "name": "[nome-do-produto]",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "server": "tsx watch server/index.ts",
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "test:functional": "vitest run --config vitest.functional.config.ts"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "express": "^4.18.0",
    "@clerk/backend": "^1.0.0",
    "@prisma/client": "^5.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "prisma": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

### Passo 3 — Configurar vite.config.ts com aliases obrigatórios

```typescript
// produtos/[nome-do-produto]/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@nucleo': path.resolve(__dirname, '../../nucleo-global'),
      '@tenant': path.resolve(__dirname, '../../servicos-global/tenant'),
      '@produto': path.resolve(__dirname, '../../servicos-global/produto'),
    }
  }
})
```

---

### Passo 4 — Configurar tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@nucleo/*": ["../../nucleo-global/*"],
      "@tenant/*": ["../../servicos-global/tenant/*"],
      "@produto/*": ["../../servicos-global/produto/*"]
    }
  },
  "include": ["src", "server"]
}
```

---

### Passo 5 — Criar o PRODUCT_CONFIG

> O PRODUCT_CONFIG é a fonte de verdade do produto — declara quais serviços usa e como a navegação é montada. Consultar `antigravity-configurador` para as regras completas de service registry.

```typescript
// produtos/[nome-do-produto]/src/shared/config.ts

export interface NavigationItem {
  id: string
  label: string
  icon: string
  source: 'product' | 'tenant'
}

export const PRODUCT_CONFIG = {
  id: '[nome-do-produto]',
  name: '[Nome do Produto]',

  tenantServices: [
    'activities', 'email', 'whatsapp',
    'dashboard', 'reports', 'history', 'gabi'
  ],

  productServices: ['helpdesk'],

  navigation: [
    // pages do produto
    { id: '[pagina-1]', label: '[Label 1]', icon: '[icon]', source: 'product' },
    // serviços de tenant
    { id: 'activities', label: 'Atividades',  icon: 'check-circle',   source: 'tenant' },
    { id: 'email',      label: 'Email',       icon: 'mail',           source: 'tenant' },
    { id: 'whatsapp',   label: 'WhatsApp',    icon: 'message-circle', source: 'tenant' },
    { id: 'helpdesk',   label: 'Helpdesk',    icon: 'headphones',     source: 'product' },
    { id: 'dashboard',  label: 'Dashboard',   icon: 'layout',         source: 'tenant' },
  ] satisfies NavigationItem[]
} as const
```

---

### Passo 6 — Criar App.tsx com Shell

```typescript
// produtos/[nome-do-produto]/src/App.tsx
import { Shell } from '@nucleo/shell'
import { PRODUCT_CONFIG } from './shared/config'
import { lazy } from 'react'

const productPages = {
  '[pagina-1]': lazy(() => import('./pages/[pagina-1]/[Pagina1]')),
}

export function App() {
  return (
    <Shell
      config={PRODUCT_CONFIG}
      productPages={productPages}
    />
  )
}
```

---

### Passo 7 — Criar o servidor Express

```typescript
// produtos/[nome-do-produto]/server/index.ts
import express from 'express'
import * as Sentry from '@sentry/node'
import { correlationMiddleware } from '@tenant/middleware/correlation'
import { requireInternalKey } from '@tenant/middleware/internal-auth'
import { createTenantProxy } from '@tenant/proxy'
import { PRODUCT_CONFIG } from '../src/shared/config'
import { prisma } from './prisma/client'
import pagina1Routes from './routes/[pagina-1]'
import helpdeskRoutes from '@produto/helpdesk/server/routes'

const app = express()

// 1. Sentry
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV })
app.use(Sentry.Handlers.requestHandler())

// 2. Body parser
app.use(express.json())

// 3. Correlation ID
app.use(correlationMiddleware)

// 4. Sentry context
app.use((req, res, next) => {
  Sentry.setTag('correlation_id', req.correlationId)
  next()
})

// 5. Auth
app.use(requireInternalKey)

// 6. Health check — sem autenticação
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: '[nome-do-produto]' })
  } catch {
    res.status(503).json({ status: 'down', service: '[nome-do-produto]' })
  }
})

// 7. Rotas específicas do produto
app.use('/api/v1/[pagina-1]', pagina1Routes)

// 8. Serviços de produto (template local)
app.use('/api/v1/helpdesk', helpdeskRoutes)

// 9. Proxy para serviços de tenant
app.use('/api/tenant', createTenantProxy({
  baseUrl: process.env.TENANT_SERVICES_URL!,
  services: PRODUCT_CONFIG.tenantServices
}))

// 10. Sentry error handler
app.use(Sentry.Handlers.errorHandler())

// 11. Error handler global
app.use(errorHandler)

app.listen(process.env.PORT || 3002, () => {
  console.log(`[nome-do-produto] rodando na porta ${process.env.PORT || 3002}`)
})
```

---

### Passo 8 — Criar schema.base.prisma

```prisma
// produtos/[nome-do-produto]/server/prisma/schema.base.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Models específicos do produto aqui
// (helpdesk e outros serviços de produto são adicionados via fragment)
```

---

### Passo 9 — Criar script de composição do schema

```javascript
// produtos/[nome-do-produto]/scripts/compose-schema.js
const fs = require('fs')
const path = require('path')

const base = fs.readFileSync('server/prisma/schema.base.prisma', 'utf8')
const helpdesk = fs.readFileSync(
  '../../servicos-global/produto/helpdesk/prisma/fragment.prisma', 'utf8'
)

const composed = [base, helpdesk].join('\n\n')
fs.writeFileSync('server/prisma/schema.prisma', composed)
console.log('Schema composto com sucesso.')
```

---

### Passo 10 — Criar .env.example

```bash
# produtos/[nome-do-produto]/.env.example

DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_live_...
TENANT_SERVICES_URL=http://tenant-services.railway.internal:3001
CONFIGURATOR_URL=http://configurador.railway.internal:3000
INTERNAL_SERVICE_KEY=...
SENTRY_DSN=https://...
PORT=3002
TEST_DATABASE_URL=postgresql://..._teste
E2E_BASE_URL=https://staging.[nome-do-produto].gravity.com.br
```

---

### Passo 11 — Registrar no Railway

Adicionar novo serviço no Railway com:
- Nome: `[nome-do-produto]`
- Banco: `[nome-do-produto]-db`
- Porta: próxima disponível (ver topologia em `antigravity-deploy`)
- Variáveis: copiar do `.env.example` e preencher

---

## Checklist Completo de Criação

### Estrutura
- [ ] Pasta `produtos/[nome-do-produto]/` criada com estrutura completa?
- [ ] `package.json` com `"type": "module"` e scripts obrigatórios?
- [ ] `vite.config.ts` com aliases `@nucleo`, `@tenant`, `@produto`?
- [ ] `tsconfig.json` com `strict: true` e paths dos aliases?

### Produto
- [ ] `PRODUCT_CONFIG` criado em `src/shared/config.ts`?
- [ ] Serviços de tenant declarados em `tenantServices`?
- [ ] Serviços de produto declarados em `productServices`?
- [ ] Navegação completa declarada com `source` correto para cada item?
- [ ] `App.tsx` inicializa o Shell com o `PRODUCT_CONFIG`?

### Backend
- [ ] Servidor Express com ordem correta de middlewares (11 passos)?
- [ ] Health check implementado com nome correto do serviço?
- [ ] Proxy de tenant configurado com `createTenantProxy`?
- [ ] `schema.base.prisma` criado?
- [ ] Script `compose-schema.js` criado?
- [ ] `.env.example` com todas as variáveis documentadas?

### Infraestrutura
- [ ] Serviço criado no Railway com banco próprio?
- [ ] Variáveis de ambiente configuradas em staging?
- [ ] Monitor UptimeRobot adicionado para o health check?

### Qualidade
- [ ] Skill do produto existe com regras de negócio definidas e aprovadas?
- [ ] QA acionado após criação da estrutura base?

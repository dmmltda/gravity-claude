---
name: antigravity-code-standards
description: "Use esta skill sempre que um agente for escrever qualquer código no projeto Gravity — frontend ou backend. Define os padrões obrigatórios de linguagem, validação, tratamento de erros, convenções de naming e estrutura de resposta. Todo agente consulta esta skill antes de criar ou modificar qualquer arquivo de código."
---

# Gravity — Padrões de Código

## Regra Geral

Todo código do projeto Gravity — frontend e backend — segue estes padrões sem exceção. Nenhum agente pode criar código que viole estas regras. O QA bloqueia qualquer entrega que não esteja em conformidade.

---

## Linguagem — TypeScript Obrigatório

- Todo arquivo é `.ts` ou `.tsx` — nenhum arquivo `.js` novo é aceito no projeto
- `strict: true` em todo `tsconfig.json` — sem exceções e sem supressões com `@ts-ignore`
- Nenhum `any` explícito — todo tipo deve ser definido
- Todas as exportações são tipadas — sem exportações implícitas

### tsconfig.json base obrigatório

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@nucleo/*": ["../../nucleo-global/*"],
      "@tenant/*": ["../../servicos-global/tenant/*"],
      "@produto/*": ["../../servicos-global/produto/*"]
    }
  }
}
```

---

## Módulos — ESModules como Padrão

- Todo arquivo usa `import`/`export` — nunca `require()` ou `module.exports`
- Todo `package.json` de produto e servidor deve conter `"type": "module"`
- Imports sempre via aliases configurados — nunca caminhos relativos frágeis como `../../../`

```typescript
// ✅ correto
import { TabelaGlobal } from '@nucleo/tabela-global'
import { withTenantIsolation } from '@tenant/middleware/tenant-isolation'

// ❌ proibido
import { TabelaGlobal } from '../../../nucleo-global/tabela-global'
const something = require('../utils')
```

---

## Validação de Dados — Zod em Toda Rota

Nenhuma rota aceita `req.body` sem validação Zod. Todo endpoint valida a entrada antes de tocar o banco ou executar qualquer lógica.

```typescript
import { z } from 'zod'

const createActivitySchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(['pending', 'in_progress', 'done']),
  due_date: z.string().datetime().optional(),
  user_id: z.string().cuid(),
})

app.post('/api/activities', async (req, res, next) => {
  const result = createActivitySchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: result.error.flatten()
      }
    })
  }
  // só chega aqui com dados validados
  const activity = await prisma.activity.create({ data: result.data })
  res.json(activity)
})
```

> **Regra:** se não tem schema Zod, a rota não vai para o ar.

---

## Tratamento de Erros — Handler Global

Cada servidor Express registra um error handler centralizado. As rotas apenas lançam erros — o handler decide o formato da resposta.

### Classe AppError — obrigatória em todo servidor

```typescript
// shared/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BAD_REQUEST'
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

### Error handler global — registrado por último no servidor

```typescript
// server/index.ts — registrado após todas as rotas
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    })
  }
  // erro inesperado — não expor detalhes internos
  console.error('[INTERNAL_ERROR]', err)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor'
    }
  })
})
```

### Como lançar erros nas rotas

```typescript
// ✅ correto — lança AppError, handler trata
app.get('/api/activities/:id', async (req, res, next) => {
  try {
    const activity = await prisma.activity.findFirst({
      where: { id: req.params.id }
    })
    if (!activity) throw new AppError('Atividade não encontrada', 404, 'NOT_FOUND')
    res.json(activity)
  } catch (err) {
    next(err)
  }
})

// ❌ proibido — res.status direto na rota
app.get('/api/activities/:id', async (req, res) => {
  const activity = await prisma.activity.findFirst(...)
  if (!activity) return res.status(404).json({ message: 'não encontrado' })
})
```

---

## Formato de Resposta de Erro

Todo erro retorna neste formato — sem variações:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Atividade não encontrada",
    "details": {}
  }
}
```

Para erros de validação Zod, o campo `details` é incluído:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": {
      "fieldErrors": {
        "title": ["String must contain at least 1 character(s)"],
        "status": ["Invalid enum value"]
      }
    }
  }
}
```

---

## Convenções de Naming

| Contexto | Convenção | Exemplo |
|:---|:---|:---|
| Componentes React | PascalCase | `TabelaGlobal`, `ModalCriacao` |
| Arquivos de Componentes | PascalCase | `TabelaGlobal.tsx`, `InputTexto.tsx` |
| Hooks | camelCase (prefixo `use`) | `useAuth.ts`, `useFetchVendas.ts` |
| Funções e Variáveis | camelCase | `buscarDados()`, `totalVendas` |
| Constantes Globais | UPPER_SNAKE_CASE | `API_URL`, `MAX_RETRY_ATTEMPTS` |
| Interfaces/Types | PascalCase | `Usuario`, `IRelatorioFisico` |
| Pastas | kebab-case | `nucleo-global`, `servicos-global` |
| Models Prisma | PascalCase | `Activity`, `TenantUser` |
| Campos de banco | snake_case | `tenant_id`, `created_at` |
| Arquivos de server | kebab-case | `tenant-isolation.ts` |
| Aliases de import | camelCase com `@` | `@nucleo`, `@tenant`, `@produto` |

---

## Tamanho de Funções

- Nenhuma função ultrapassa 50 linhas sem justificativa documentada no próprio código
- Funções grandes devem ser decompostas em funções menores com nomes descritivos
- Se uma função precisa de comentário para explicar o que faz, o nome está errado

---

## Comentários e Código Morto

- Nenhum bloco de código comentado esquecido — código morto é deletado
- Comentários explicam o **porquê**, nunca o **o quê** (o código já diz o quê)
- TODOs devem ter nome e data: `// TODO(daniel, 2026-03): mover para BullMQ`

---

## Logs

- Nenhum `console.log` expondo dados de usuário, tenant ou variáveis de ambiente
- Logs de erro usam `console.error` com correlation ID e código do erro
- Dados sensíveis nunca aparecem em logs — mesmo em desenvolvimento

```typescript
// ✅ correto
console.error(`[${err.code}] correlation:${req.correlationId}`, err.message)

// ❌ proibido
console.log('user data:', req.body)
console.log('tenant:', tenantId, 'token:', token)
```

---

## Variáveis de Ambiente

- Nenhuma variável de ambiente hardcoded no código
- Todo serviço tem um template `.env.example` com todas as variáveis documentadas
- Acesso via `process.env.NOME_DA_VARIAVEL` — nunca inline

```typescript
// ✅ correto
const tenantUrl = process.env.TENANT_SERVICES_URL!

// ❌ proibido
const tenantUrl = 'http://tenant-services.railway.internal:3001'
```

---

## Estrutura Obrigatória de um Servidor Express

Todo servidor do projeto segue esta ordem de registro de middlewares:

```typescript
// server/index.ts
import express from 'express'
import { correlationMiddleware } from '@tenant/middleware/correlation'
import { requireInternalKey } from '@tenant/middleware/internal-auth'
import { withTenantIsolation } from '@tenant/middleware/tenant-isolation'

const app = express()

// 1. Parse de body
app.use(express.json())

// 2. Correlation ID — deve ser o primeiro middleware de negócio
app.use(correlationMiddleware)

// 3. Autenticação
app.use(requireInternalKey)

// 4. Health check — sempre disponível, sem autenticação
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'nome-do-servico' })
  } catch {
    res.status(503).json({ status: 'down' })
  }
})

// 5. Rotas de negócio
app.use('/api/v1/activities', activitiesRoutes)

// 6. Error handler — sempre o último
app.use(errorHandler)

export { app }
```

---

## Versionamento de API

Todos os endpoints usam prefixo de versão desde o início:
- `/api/v1/activities`
- `/api/v1/email`
- `/api/v1/whatsapp`

**Regras de versionamento:**
- Adicionar campos ao response **não** requer nova versão
- Remover campos, renomear endpoints ou mudar payload → nova versão `/api/v2/`
- Versão antiga mantida por pelo menos 1 ciclo de release

---

## Checklist — Antes de Entregar Qualquer Código

- [ ] Todo arquivo é `.ts` ou `.tsx`?
- [ ] Nenhum `any` explícito?
- [ ] Toda rota tem schema Zod?
- [ ] Erros lançados via `AppError`, nunca `res.status()` direto?
- [ ] Error handler global registrado no servidor?
- [ ] Imports via aliases `@nucleo/`, `@tenant/`, `@produto/`?
- [ ] Nenhum `console.log` com dados sensíveis?
- [ ] Nenhuma variável de ambiente hardcoded?
- [ ] Funções com menos de 50 linhas?
- [ ] Nenhum código comentado esquecido?
- [ ] Endpoints com prefixo `/api/v1/`?
- [ ] Health check implementado em servidores novos?

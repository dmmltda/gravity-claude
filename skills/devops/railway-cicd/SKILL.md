---
name: antigravity-deploy
description: "Use esta skill sempre que uma tarefa envolver deploy, migrations, variáveis de ambiente, configuração de infraestrutura no Railway, CI/CD ou rollback. Todo agente consulta esta skill antes de qualquer operação que afete ambientes de staging ou produção."
---

# Gravity — Deploy

## Regra Fundamental

Nenhuma operação de deploy é feita sem seguir este documento. Nenhuma migration destrutiva sem backup e plano de rollback documentado. Nenhum deploy em produção sem passar por staging primeiro.

---

## Topologia de Serviços no Railway

**Railway Project: Gravity**

| Serviço | Porta | Banco |
|:---|:---|:---|
| `configurador` | 3000 | configurador-db |
| `tenant-services` | 3001 | tenant-db |
| `simulador-comex` | 3002 | simulador-comex-db |
| `nf-importacao` | 3003 | nf-importacao-db |
| `marketplace` | 3004 | — (estático ou SSR) |

> **Regra:** cada produto tem seu próprio serviço e banco no Railway. Nenhum produto compartilha banco com outro produto.

---

## Ambientes

| Ambiente | Uso | Banco |
|:---|:---|:---|
| **staging** | Testes antes de produção, QA, validação | Banco separado com dados de teste |
| **production** | Clientes reais | Banco de produção |

**Fluxo obrigatório:**
```text
feature branch → PR → merge na main → deploy automático em staging
→ testes E2E rodam → aprovação manual → promote para production
```

Serviços compartilhados (configurador, tenant-services) têm staging próprio. Produtos apontam para o staging dos serviços compartilhados no ambiente de staging.

---

## Variáveis de Ambiente

Padrão de naming: `SERVICO_PROVIDER_TIPO`

```bash
# === configurador ===
DATABASE_URL=postgresql://...configurador-db...
CLERK_SECRET_KEY=sk_live_...
STRIPE_SECRET_KEY=sk_live_...

# === tenant-services ===
TENANT_DATABASE_URL=postgresql://...tenant-db...
CLERK_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
META_WHATSAPP_TOKEN=...
OPENAI_API_KEY=sk-...

# === simulador-comex (primeiro produto) ===
DATABASE_URL=postgresql://...simulador-comex-db...
CLERK_SECRET_KEY=sk_live_...
TENANT_SERVICES_URL=http://tenant-services.railway.internal:3001
CONFIGURATOR_URL=http://configurador.railway.internal:3000
INTERNAL_SERVICE_KEY=...

# === nf-importacao (próximo produto) ===
DATABASE_URL=postgresql://...nf-importacao-db...
CLERK_SECRET_KEY=sk_live_...
TENANT_SERVICES_URL=http://tenant-services.railway.internal:3001
CONFIGURATOR_URL=http://configurador.railway.internal:3000
INTERNAL_SERVICE_KEY=...
```

**Regras:**
- Toda variável de ambiente está documentada no `.env.example` do serviço
- Nenhuma variável hardcoded no código
- `INTERNAL_SERVICE_KEY` rotacionada trimestralmente
- Variáveis de staging e produção são sempre diferentes

---

## Ordem de Deploy entre Serviços

A ordem importa. Serviços dependentes só sobem após os serviços que dependem estarem saudáveis.

1. **configurador** — sem dependências
2. **tenant-services** — depende do configurador para auth
3. **produtos** — dependem do configurador + tenant-services
4. **marketplace** — sem dependências, pode subir a qualquer momento

Verificar health check antes de subir o próximo:
```bash
curl https://[servico].railway.app/health
# esperado: { "status": "ok", "service": "nome-do-servico" }
```

---

## Protocolo de Migrations

### Antes de qualquer migration
1. **Backup manual obrigatório** — mesmo que Railway faça backup automático
2. Verificar se há conexões ativas no banco
3. Comunicar o time antes de migrations destrutivas

### Migrations não destrutivas (adicionar coluna, nova tabela)

```bash
# 1. Compor schema (se tenant-services)
npx ts-node scripts/compose-tenant-schema.ts

# 2. Validar schema
npx prisma validate

# 3. Gerar migration
npx prisma migrate dev --name descricao-clara-da-migration

# 4. Revisar o arquivo de migration gerado antes de aplicar em produção
# 5. Aplicar em staging
npx prisma migrate deploy

# 6. Validar em staging — só então aplicar em produção
```

### Migrations destrutivas (remover coluna, renomear, mudar tipo)

Nunca em um único passo. Sempre em duas fases:

**Fase A — retrocompatível (deploy sem quebrar nada):**
- Adicionar coluna/tabela nova
- Deploy do código que usa a nova estrutura
- Validar em staging e produção

**Fase B — limpeza (só após validação completa):**
- Remover coluna/tabela antiga
- Deploy final

> **Regra:** se a Fase A falhar → rollback do deploy e restore do backup. Fase B só começa após Fase A validada em produção.

---

## Backup

Automático: Railway faz backup diário com retenção de 7 dias.

**Manual obrigatório antes de:**
- Qualquer migration destrutiva
- Qualquer alteração de schema em produção
- Qualquer operação de limpeza de dados

**Backup semanal:** exportado para storage externo (redundância fora do Railway).
**Teste de restauração:** mensal — um backup só tem valor se funciona.

```bash
# Backup manual via Railway CLI
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Rollback

Railway suporta rollback instantâneo para o deploy anterior.

**Procedimento:**
1. Detectar falha (Sentry alert ou health check down)
2. Railway Dashboard → Service → Deployments → Rollback
3. Serviço reverte para a imagem anterior em < 30s
4. Verificar health check após rollback
5. Reportar o incidente com causa e solução

**Para migrations destrutivas que falharam:**
1. Rollback do deploy (Railway Dashboard)
2. Restore do backup manual feito antes da migration
3. Validar que o serviço voltou ao estado anterior
4. Investigar a causa antes de tentar novamente

---

## Private Networking no Railway

Comunicação entre serviços usa rede interna do Railway — nunca internet pública.

```bash
# Endereços internos (usar nas variáveis de ambiente)
configurador.railway.internal:3000
tenant-services.railway.internal:3001
simulador-comex.railway.internal:3002
```

> **Regra:** tráfego público só no marketplace. Todos os outros serviços acessíveis apenas via rede interna ou API Gateway autenticado.

---

## CI/CD com GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:functional

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-github-action@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: ${{ env.SERVICE_NAME }}
          environment: staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # requer aprovação manual
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-github-action@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: ${{ env.SERVICE_NAME }}
          environment: production
```

---

## Monitoramento

| Ferramenta | O que monitora |
|:---|:---|
| **Sentry** | Erros de aplicação (backend e frontend), stack traces, contexto do tenant |
| **UptimeRobot** | Health check de cada serviço a cada 5 minutos |
| **Railway Metrics** | CPU, memória, conexões de banco |

> **Regra P0:** se um serviço cair, o responsável é notificado em menos de 5 minutos.

**Health check obrigatório em todo servidor:**

```typescript
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'nome-do-servico' })
  } catch (e) {
    res.status(503).json({ status: 'down' })
  }
})
```

---

## Protocolo de Emergência

Se um serviço em produção estiver fora do ar:

1. Verificar UptimeRobot — qual serviço caiu?
2. Verificar Sentry — qual erro gerou a queda?
3. Railway Dashboard → verificar logs do serviço
4. Se causa identificada e fix < 15min → corrigir e fazer novo deploy
5. Se causa não identificada → rollback imediato para deploy anterior
6. Comunicar o time com status e ETA de resolução

---

## Checklist de Deploy

### Antes de qualquer deploy em produção
- [ ] Todos os testes passam em staging?
- [ ] Health check de todos os serviços dependentes está ok?
- [ ] Variáveis de ambiente de produção estão configuradas?
- [ ] Migration (se houver) foi testada em staging?
- [ ] Backup manual feito (se migration destrutiva)?
- [ ] Plano de rollback documentado?

### Após deploy em produção
- [ ] Health check do serviço deployado está ok?
- [ ] Sentry não reportou novos erros críticos?
- [ ] UptimeRobot confirma serviço ativo?
- [ ] Fluxo principal do serviço validado manualmente?

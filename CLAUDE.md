# Gravity — CLAUDE.md

## Antes de qualquer coisa

Leia sempre a skill `antigravity-visao-geral` antes de iniciar qualquer tarefa. Ela contém o mapa completo do projeto: o que é o Gravity, a stack, o monorepo, as quatro ondas e qual skill consultar para cada assunto.

---

## Regras de comportamento obrigatórias

1. **Nunca execute código sem antes ler a skill relevante** para a tarefa.
2. **Nunca edite `schema.prisma` diretamente.** Apenas o Coordenador compõe o schema via script, a partir dos `fragment.prisma` de cada serviço.
3. **Nunca use `any` em TypeScript.** `strict: true` em todo o projeto.
4. **Nunca use `require()` ou `module.exports`.** O projeto usa ESModules (`import`/`export`) em todo lugar.
5. **Toda rota Express deve ter schema Zod.** Sem exceções.
6. **Toda rota lança `AppError`.** O handler global registrado por último no Express responde.
7. **Todo model Prisma de tenant deve ter `tenant_id` obrigatório** e os três índices: `@@index([tenant_id])`, `@@index([tenant_id, product_id])`, `@@index([tenant_id, user_id])`.
8. **Serviços de tenant não importam código de outros serviços.** Apenas comunicam via API REST.
9. **Todo endpoint segue o prefixo `/api/v1/`.** Sem exceções.
10. **Antes de criar qualquer arquivo**, verifique se já existe algo equivalente no monorepo.

---

## Skills disponíveis

### Visão geral e entrada
| Skill | Quando usar |
|:---|:---|
| `antigravity-visao-geral` | **Sempre primeiro** — visão geral, stack completa, ondas, mapa de skills |

### Agentes
| Skill | Quando usar |
|:---|:---|
| `antigravity-agent-policy` | Regras gerais de comportamento antes de qualquer ação |
| `antigravity-coordenador` | Papel do Coordenador, checklists de onda, composição de schema |
| `antigravity-lider` | Papel do Líder, distribuição de tarefas, modos proativo e reativo |
| `antigravity-qa` | Revisão de qualidade pós-entrega |

### Desenvolvimento
| Skill | Quando usar |
|:---|:---|
| `antigravity-code-standards` | Padrões TypeScript, Zod, AppError, naming conventions, estrutura Express |
| `antigravity-test-strategy` | Estratégia de testes — o que testar e como priorizar |
| `antigravity-testes` | Implementação de testes unitários com Vitest e E2E com Playwright |

### Banco de dados
| Skill | Quando usar |
|:---|:---|
| `antigravity-schema-composition` | Fragment.prisma, script de composição, schema base |

### Core — Arquitetura
| Skill | Quando usar |
|:---|:---|
| `antigravity-servicos-tenant` | Diferença entre serviço de tenant e serviço de produto, estrutura de pastas |
| `antigravity-tenant-isolation` | Isolamento de tenant, RLS, middleware, `withTenantIsolation` |
| `antigravity-autenticacao-s2s` | Auth entre serviços — JWT propagação, `x-internal-key` |
| `antigravity-cross-boundary` | Ações cross-boundary entre serviços |
| `antigravity-multi-tenant` | Roteamento multi-tenant, tenant lookup, request context |

### Core — Serviços de tenant
| Skill | Quando usar |
|:---|:---|
| `antigravity-api-cockpit` | Serviço api-cockpit |
| `antigravity-cronometro` | Serviço cronômetro |
| `antigravity-dashboard` | Serviço dashboard |
| `antigravity-email` | Serviço de email (Resend) |
| `antigravity-gabi` | Gabi — assistente de IA com permissões espelhadas do usuário |
| `antigravity-historico` | Serviço de histórico |
| `antigravity-notificacoes` | Serviço de notificações |
| `antigravity-relatorios` | Serviço de relatórios |
| `antigravity-whatsapp` | Serviço de WhatsApp (Meta Cloud API) |
| `antigravity-conector-erp` | Serviço conector ERP |

### Business
| Skill | Quando usar |
|:---|:---|
| `antigravity-configurador` | Configurador — Clerk, Stripe, billing, permissões, Admin Panel |
| `antigravity-marketplace` | Marketplace — landing e catálogo de produtos |
| `antigravity-admin` | Painel admin global |
| `antigravity-service-registry` | Registro de serviços e descoberta de endpoints |
| `antigravity-criar-produto` | Como criar um novo produto no Gravity |

### Produtos
| Skill | Quando usar |
|:---|:---|
| `antigravity-simulacusto` | SimulaCusto — primeiro produto real (Simulador Comex) |
| `antigravity-simulador-comex` | Regras de negócio do Simulador Comex |

### UX e Frontend
| Skill | Quando usar |
|:---|:---|
| `antigravity-design-system` | Design system — cores, tipografia, tokens CSS, dark mode |
| `antigravity-global-ui` | Componentes globais — TabelaGlobal, ModalGlobal, SelectGlobal |
| `antigravity-componentes` | Biblioteca de componentes reutilizáveis |
| `antigravity-state-management` | State management no frontend |

### DevOps e Infraestrutura
| Skill | Quando usar |
|:---|:---|
| `antigravity-deploy` | Deploy no Railway, migrations, rollback |
| `antigravity-observabilidade` | Sentry, UptimeRobot, monitoramento |

---

## Estrutura esperada do monorepo

```
gravity/
├── nucleo-global/
├── servicos-global/
│   ├── tenant/
│   ├── produto/
│   ├── configurador/
│   ├── marketplace/
│   └── devops/
├── produtos/
│   ├── simulador-comex/
│   └── nf-importacao/
└── scripts/
```

---

## Skills path

Todas as skills estão em:
```
skills/
├── agentes/
├── business/
├── core/
├── database/
├── dev/
├── devops/
├── produtos/
├── ux/
└── visao-geral/
```

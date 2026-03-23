# Agente 1A — Núcleo UI | Onda 2

Você é o Agente 1A — Núcleo UI do projeto Gravity.
Sua responsabilidade é construir todos os componentes globais
reutilizáveis do nucleo-global. Estes componentes serão usados
por todos os produtos e serviços da Onda 3 em diante.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTES DE COMEÇAR — leia estas skills na ordem:
1. skills/dev/agent-policy/SKILL.md
2. skills/visao-geral/SKILL.md
3. skills/ux/global-ui/SKILL.md
4. skills/dev/code-standards/SKILL.md
5. skills/ux/design-system/SKILL.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRA FUNDAMENTAL DO NÚCLEO:
Antes de criar qualquer componente, responda as 3 perguntas:
1. Precisa de banco de dados? → se SIM, não pertence aqui
2. Chama alguma API externa? → se SIM, não pertence aqui
3. Conhece alguma regra de negócio? → se SIM, não pertence aqui
As 3 respostas devem ser NÃO.

PASTA DE TRABALHO: gravity/nucleo-global/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENTES A CRIAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── 1. tabela-global/ ────────────────────────────────────────────

gravity/nucleo-global/tabela-global/
├── tabela.tsx          ← componente principal
├── celula.tsx          ← renderizador de célula base
├── cabecalho.tsx       ← controle de ordenação com ícone
├── types.ts            ← Column, Row, TabelaProps, SortConfig
└── index.ts            ← exportações públicas

Funcionalidades obrigatórias:
- Ordenação local por coluna (asc/desc) via estado interno
- Paginação de UI (sem chamada a servidor)
- Filtro simples por texto via prop opcional
- Suporte a tipos de coluna: text, date, number, badge, actions
- Props: columns, data, loading?, emptyMessage?
- TypeScript strict — sem any — props 100% tipadas
- Sem fetch, sem axios, sem chamada externa

── 2. modal-global/ ─────────────────────────────────────────────

gravity/nucleo-global/modal-global/
├── modal-manager.ts    ← pilha de modais (push/pop)
├── modal-overlay.tsx   ← componente visual com backdrop
├── use-modal.ts        ← hook: abrirModal, fecharModal
├── types.ts            ← ModalConfig, ModalState
└── index.ts

Funcionalidades obrigatórias:
- Modais empilháveis (vários ao mesmo tempo)
- Fechar com ESC e clique no backdrop
- Suporte a título, conteúdo (children) e footer com ações
- Animação de entrada/saída via CSS transition
- Sem estado global externo — gerenciado internamente via useReducer

── 3. caixa-select-global/ ──────────────────────────────────────

gravity/nucleo-global/caixa-select-global/
├── caixa-select.tsx    ← componente principal
├── opcao.tsx           ← item de lista
├── types.ts            ← SelectOption, SelectProps
└── index.ts

Funcionalidades obrigatórias:
- Busca local (filtra opções pelo texto digitado)
- Seleção única e múltipla (prop multiple?)
- Props: options, value, onChange, placeholder?, disabled?, multiple?
- Acessibilidade: aria-expanded, aria-selected, navegação por teclado
- Sem dependência de biblioteca externa de select

── 4. confirmar-global/ ─────────────────────────────────────────

gravity/nucleo-global/confirmar-global/
├── confirmar.tsx       ← diálogo OK/Cancelar ou Sim/Não
├── use-confirmar.ts    ← hook: confirmar(mensagem) → Promise<boolean>
├── types.ts            ← ConfirmarProps, ConfirmarConfig
└── index.ts

Funcionalidades obrigatórias:
- Uso via hook: const ok = await confirmar('Deseja excluir?')
- Configurável: título, mensagem, texto dos botões
- Variante de perigo (botão confirmar em vermelho)
- Integrado ao modal-global para exibição

── 5. dica-global/ ──────────────────────────────────────────────

gravity/nucleo-global/dica-global/
├── dica.tsx            ← Tooltip posicionado
├── popover.tsx         ← Popover com conteúdo rico
├── types.ts            ← DicaProps, PopoverProps
└── index.ts

Funcionalidades obrigatórias:
- Posicionamento: top, bottom, left, right (prop placement)
- Abertura por hover (Tooltip) ou clique (Popover)
- Delay de abertura configurável

── 6. api-global/ ───────────────────────────────────────────────

gravity/nucleo-global/api-global/
├── client.ts           ← instância base do axios sem URL
├── interceptors.ts     ← injeção de Authorization header
├── types.ts            ← ApiResponse<T>, ApiError, RequestConfig
└── index.ts

Funcionalidades obrigatórias:
- ApiResponse<T> tipada: { data: T, status: number, message?: string }
- Interceptor para injetar Authorization: Bearer [token]
- Interceptor de erro que lança ApiError padronizado
- SEM URLs hardcoded — baseURL é configurada por quem instancia
- SEM chamadas diretas aqui — apenas tipagem e configuração base

── 7. utilitarios-global/ ───────────────────────────────────────

gravity/nucleo-global/utilitarios-global/
├── formatadores.ts     ← CPF, CNPJ, moeda BRL, datas pt-BR
├── mascaras.ts         ← inputs com máscara (phone, CEP, CNPJ)
├── validadores.ts      ← email, CNPJ, CPF, CEP (validação pura)
├── types.ts            ← FormatOptions, MascaraConfig, ValidadorResult
└── index.ts

Funções obrigatórias em formatadores.ts:
- formatarCNPJ('12345678000195') → '12.345.678/0001-95'
- formatarCPF('12345678901') → '123.456.789-01'
- formatarMoeda(1500.50) → 'R$ 1.500,50'
- formatarData(date, 'dd/MM/yyyy') → '22/03/2026'
- formatarTelefone('11999998888') → '(11) 99999-8888'

Funções obrigatórias em validadores.ts:
- validarEmail(email) → boolean
- validarCNPJ(cnpj) → boolean (validação com dígitos verificadores)
- validarCPF(cpf) → boolean (validação com dígitos verificadores)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TESTES OBRIGATÓRIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para cada componente criar arquivo de teste:
- utilitarios-global → utilitarios.test.ts (Vitest)
- tabela-global → tabela.test.tsx (Vitest + @testing-library/react)
- modal-global → modal.test.tsx
- use-confirmar → use-confirmar.test.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- TypeScript strict — zero any — props 100% tipadas
- ESModules em tudo — sem require()
- Nenhum componente importa de servicos-global, tenant/* ou produto/*
- Nenhum componente faz fetch ou acessa localStorage diretamente
- Nenhum estado global (Redux, Zustand, Context global)
- Todo componente funciona offline, sem servidor, sem regra de negócio
- Nenhum arquivo .js — apenas .ts e .tsx
- Exportações sempre via index.ts de cada pasta

QUANDO TERMINAR:
Responda com a lista de todos os arquivos criados e o resultado
dos testes. Confirme que as 3 perguntas do nucleo-global foram
respondidas NÃO para cada componente.

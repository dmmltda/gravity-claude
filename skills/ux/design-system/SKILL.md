---
name: antigravity-design-system
description: "Use esta skill sempre que uma tarefa envolver qualquer aspecto visual do projeto Gravity — cores, tipografia, espaçamentos, sombras, bordas, componentes visuais ou tokens de design. Define o tema Solid Slate (Material 3 Adaptation), todas as variáveis CSS obrigatórias, escala tipográfica com Plus Jakarta Sans, sistema de botões pill, campos de formulário, badges, toasts, KPI cards, kanban, tabs, popover de filtro, select customizado, wizard timeline, modais complexos e modal de permissões. Todo agente consulta esta skill antes de escrever qualquer CSS ou componente visual."
---

# Gravity — Design System

## Tema: Solid Slate (Material 3 Adaptation)

Dark mode é o padrão. Light theme é ativado via `body.light-theme`.

---

## 1 — Variáveis Globais (Root CSS)

```css
:root {
  /* === Backgrounds === */
  --bg-body-dark:    #0f172a;
  --bg-base:         #1e293b;
  --bg-surface:      #334155;
  --bg-elevated:     #475569;

  /* === Acento principal (Sky 400) === */
  --accent:          #38bdf8;
  --accent-hover:    #0ea5e9;

  /* === Texto === */
  --text-primary:    #f1f5f9;
  --text-secondary:  #94a3b8;
  --text-muted:      #64748b;

  /* === Status === */
  --success:         #22c55e;
  --warning:         #f59e0b;
  --danger:          #ef4444;

  /* === Geometria === */
  --radius-sm:       4px;
  --radius-md:       8px;
  --radius-lg:       12px;
  --radius-pill:     9999px;

  /* === Focus ring === */
  --focus-ring:      0 0 0 2px #38bdf8;

  /* === Sombras === */
  --shadow-sm:       0 1px 3px rgba(0,0,0,0.4);
  --shadow-md:       0 4px 12px rgba(0,0,0,0.5);
}

body.light-theme {
  --bg-body-dark:    #f8fafc;
  --bg-base:         #ffffff;
  --bg-surface:      #f1f5f9;
  --bg-elevated:     #e2e8f0;
  --text-primary:    #0f172a;
  --text-secondary:  #475569;
  --text-muted:      #94a3b8;
}
```

---

## 2 — Escala Tipográfica

**Fontes:** Plus Jakarta Sans (UI) e DM Mono (código). Carregar via Google Fonts.

```css
/* Tipografia — Plus Jakarta Sans obrigatório */
body { font-family: 'Plus Jakarta Sans', sans-serif; }
code, pre { font-family: 'DM Mono', monospace; }

.text-display  { font-size: 2.25rem;  font-weight: 700; line-height: 1.2; }
.text-h1       { font-size: 1.875rem; font-weight: 700; line-height: 1.3; }
.text-h2       { font-size: 1.5rem;   font-weight: 600; line-height: 1.3; }
.text-h3       { font-size: 1.25rem;  font-weight: 600; line-height: 1.4; }
.text-body-lg  { font-size: 1rem;     font-weight: 400; line-height: 1.6; }
.text-body     { font-size: 0.875rem; font-weight: 400; line-height: 1.6; }
.text-sm       { font-size: 0.8125rem;font-weight: 400; line-height: 1.5; }
.text-micro    { font-size: 0.75rem;  font-weight: 600; line-height: 1.4; letter-spacing: 0.06em; text-transform: uppercase; }
```

> **Regra:** `.text-micro` é sempre UPPERCASE. Nunca use para corpo de texto corrido.

---

## 3 — Sistema de Botões (Pill System)

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-pill);  /* OBRIGATÓRIO — sempre pill */
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-primary {
  background: var(--accent);
  color: #0f172a;
}
.btn-primary:hover { background: var(--accent-hover); }

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--bg-elevated);
}
.btn-secondary:hover { background: var(--bg-elevated); }

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

---

## 4 — Campos de Formulário

```css
.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.input-group label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.input-group input,
.input-group textarea,
.input-group select {
  background: var(--bg-base);
  border: 1px solid var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.input-group input:focus,
.input-group textarea:focus {
  outline: none;
  box-shadow: var(--focus-ring);
  border-color: var(--accent);
}
```

---

## 5 — Badges de Status

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-success { background: rgba(34,197,94,0.15); color: var(--success); }
.badge-warning { background: rgba(245,158,11,0.15); color: var(--warning); }
.badge-danger  { background: rgba(239,68,68,0.15);  color: var(--danger);  }
```

---

## 6 — Toasts (Notificações do Sistema)

> **Regra:** nunca criar elementos de toast manualmente. Usar sempre `addNotification` via Shell.

```typescript
const { addNotification } = useShellStore()
addNotification({ type: 'success', message: 'Operação concluída com sucesso' })
addNotification({ type: 'error',   message: 'Erro ao processar requisição' })
addNotification({ type: 'warning', message: 'Atenção: campo obrigatório' })
```

---

## 7 — KPI Cards (Dashboard)

```css
.kpi-card {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.kpi-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--text-primary);
}
```

---

## 9 — Navigation Tabs

```css
/* Pill Tabs — para seções de página */
.tabs-pill { display: flex; gap: 0.25rem; padding: 0.25rem; background: var(--bg-surface); border-radius: var(--radius-pill); }
.tab-pill { padding: 0.375rem 1rem; border-radius: var(--radius-pill); font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.tab-pill.active { background: var(--bg-base); color: var(--text-primary); box-shadow: var(--shadow-sm); }

/* Underline Tabs — para conteúdo aninhado em modais */
.tabs-underline { display: flex; gap: 0; border-bottom: 1px solid var(--bg-elevated); }
.tab-underline { padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
.tab-underline.active { color: var(--accent); border-bottom-color: var(--accent); }
```

---

## 11 — Select Box Customizada

> **Regra:** nunca usar `<select>` nativo do HTML. Usar sempre o componente `advanced-select`.

```typescript
import { CaixaSelectGlobal } from '@nucleo/caixa-select-global'
```

---

## 12 — Wizard Timeline (Stepper)

```css
.stepper { display: flex; align-items: flex-start; gap: 0; }
.step { display: flex; flex-direction: column; align-items: center; flex: 1; }

.step-circle {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;   /* OBRIGATÓRIO — sem isso o círculo deforma */
  flex-shrink: 0;    /* OBRIGATÓRIO — sem isso o círculo encolhe */
  border-radius: 50%;
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-circle.active { background: var(--accent); color: #0f172a; }
.step-circle.done { background: var(--success); color: white; }

.step-connector { flex: 1; height: 2px; background: var(--bg-elevated); margin-top: 1rem; }
.step-connector.done { background: var(--success); }
```

---

## 14 — Layout Profundo de Modal

```css
/* Header do Modal — sempre --bg-surface */
.modal-header {
  background: var(--bg-surface);
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--bg-elevated);
}

/* Body do Modal — sempre --bg-base */
.modal-body {
  background: var(--bg-base);
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

/* Footer do Modal */
.modal-footer {
  background: var(--bg-surface);
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--bg-elevated);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
```

---

## 15 — Modal de Permissões (Grid de Checkboxes)

```css
.permissions-grid {
  display: grid;
  grid-template-columns: 1fr repeat(4, auto);
  gap: 0.5rem 1.5rem;
  align-items: center;
}

.permission-module-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.permission-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  text-align: center;
}
```

---

## Regras de Uso Obrigatórias

1. **Sem cores hardcoded** — sempre usar variáveis CSS
2. **Sem `<select>` nativo** — usar `advanced-select` / `CaixaSelectGlobal`
3. **Botões sempre pill** — `border-radius: var(--radius-pill)` obrigatório
4. **Modais complexos:** header e footer em `--bg-surface`, body em `--bg-base`
5. **Ícones:** exclusivamente **Phosphor Icons**
6. **Tipografia:** exclusivamente **Plus Jakarta Sans** (UI) e **DM Mono** (código)
7. **`.text-micro`:** sempre uppercase; nunca para corpo de texto corrido
8. **Steppers:** `min-width` e `flex-shrink: 0` obrigatórios nos círculos
9. **Toasts:** usar `addNotification` via Shell; nunca criar elementos manualmente
10. **Tema:** dark é o padrão; light theme via `body.light-theme`

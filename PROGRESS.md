# PROGRESS

## Status
EM_ANDAMENTO

## Instruções fixas
- Leia o `CLAUDE.md` antes de qualquer coisa.
- Execute apenas o PRIMEIRO item não marcado. Um item por rodada.
- Leia a story referenciada e os documentos que ela citar antes de codar.
- Só marque `[x]` depois que `pnpm verify` passar (até o F0-14 ele equivale a `pnpm check`; depois inclui E2E).
- Itens `GATE-*`: não escreva código; escreva `TAREFA_BLOQUEADA` no Status com o resumo da fase.
- Se o item precisar de variável de ambiente ausente (ex.: chaves do Clerk), escreva `TAREFA_BLOQUEADA` dizendo qual.
- Itens "(API)" entregam domínio + persistência + endpoints + testes. Itens "(UI)" entregam telas + testes de componente e E2E do fluxo principal, consumindo a API já pronta.

## Backlog

### Fase 0 — Fundação (`docs/backlog/fase-0-fundacao.md`)
- [x] F0-01 — Scaffold do monorepo → fase-0#F0-01
- [ ] F0-02 — Estrutura de libs e fronteiras → fase-0#F0-02 · ADR-002
- [ ] F0-03 — Banco, roles e migrations → fase-0#F0-03 · ADR-001
- [ ] F0-04 — Shared kernel (Money, ids, erros, CPF/CNPJ) → fase-0#F0-04 · ADR-005
- [ ] F0-05 — Tenancy e isolamento RLS → fase-0#F0-05 · ADR-001
- [ ] F0-06 — Convenções da API e observabilidade → fase-0#F0-06
- [ ] F0-07 — Verificação de token do Clerk e resolução de tenant → fase-0#F0-07 · ADR-004 · dominio/platform.md
- [ ] F0-08 — Autorização RBAC → fase-0#F0-08 · ADR-004
- [ ] F0-09 — Auditoria → fase-0#F0-09 · dominio/platform.md
- [ ] F0-10 — Outbox e worker → fase-0#F0-10 · ADR-003
- [ ] F0-11 — Sincronização Clerk: webhooks e JIT → fase-0#F0-11 · ADR-004
- [ ] F0-12 — Front: autenticação e troca de organização (Clerk) → fase-0#F0-12
- [ ] F0-13 — Front: layout, menu por permissão, i18n, formatação → fase-0#F0-13
- [ ] F0-14 — Infraestrutura E2E e `pnpm verify` completo → fase-0#F0-14
- [ ] F0-15 — CI no GitHub Actions → fase-0#F0-15
- [ ] GATE-F0 — Revisão humana da Fase 0

### Fase 1 — Cadastros e núcleo de Projetos (`docs/backlog/fase-1-cadastros-projetos.md`)
- [ ] F1-01 — US-ORG-001 Empresas e filiais (API) · dominio/cadastros.md
- [ ] F1-02 — US-ORG-002 Centros de custo (API)
- [ ] F1-03 — US-ORG-001/002 Empresas e centros de custo (UI)
- [ ] F1-04 — US-PAR-001 Parceiros (API) · dominio/cadastros.md
- [ ] F1-05 — US-PAR-002 Colaboradores, custo/hora e PartnersQueryFacade (API)
- [ ] F1-06 — US-PAR-001/002 Parceiros e colaboradores (UI)
- [ ] F1-07 — US-PRJ-001 Criar projeto + workflow e quadro padrão (API) · dominio/projects.md · ADR-007
- [ ] F1-08 — US-PRJ-002 Ciclo de vida do projeto (API)
- [ ] F1-09 — US-PRJ-003 TAP (API)
- [ ] F1-10 — US-PRJ-004 Equipe e visibilidade (API)
- [ ] F1-11 — US-PRJ-001 a 004 Lista, criação, detalhe, TAP e equipe (UI)
- [ ] F1-12 — US-PRJ-005 Hierarquia de work items / EAP (API) · ADR-007
- [ ] F1-13 — US-PRJ-006 Backlog: rank, estimativa, DoR (API)
- [ ] F1-14 — US-PRJ-005/006 Árvore EAP e backlog (UI)
- [ ] F1-15 — US-PRJ-007 Planejar e iniciar sprint (API)
- [ ] F1-16 — US-PRJ-008 Encerrar sprint (API)
- [ ] F1-17 — US-PRJ-009 Quadro kanban e WIP (API)
- [ ] F1-18 — US-PRJ-007 a 009 Sprints e quadro (UI)
- [ ] F1-19 — US-PRJ-010 Apontar horas (API)
- [ ] F1-20 — US-PRJ-011 Enviar e aprovar folha + evento (API) · ADR-003
- [ ] F1-21 — US-PRJ-010/011 Timesheet e aprovação (UI)
- [ ] F1-22 — US-PRJ-012 Métricas (API)
- [ ] F1-23 — US-PRJ-012 Gráficos de burndown, velocidade e % concluído (UI)
- [ ] F1-24 — E2E do fluxo completo: criar projeto → TAP → equipe → backlog → sprint → quadro → horas → aprovação
- [ ] GATE-F1 — Revisão humana da Fase 1 (e detalhamento da Fase 2)

## Log de decisões
(uma entrada por rodada: data, item, o que foi feito, decisões menores, pendências)

### 2026-09-21 — F0-01 Scaffold do monorepo

**Feito**
- Workspace Nx 23 + pnpm (monorepo integrado: dependências no `package.json` da raiz).
- Apps `api` (NestJS 12, prefixo `/api/v1`, `GET /api/v1/health`), `worker` (NestJS standalone,
  `WorkerService` onde os consumidores de fila entram no F0-10) e `web` (React 19 + Vite 8).
- `tsconfig.base.json` com `strict` e `noUncheckedIndexedAccess`; ESLint 10 (flat config) + Prettier;
  Vitest 5 em todos os projetos. Alvos `build`, `serve`, `lint`, `typecheck` e `test` em cada `project.json`.
- Carregamento de `.env` (dotenv) validado com zod no boot de `api` e `worker`, com erro listando as
  variáveis ausentes. 10 testes passando (4 api, 5 worker, 1 web).
- `.nvmrc` (Node 24 LTS), seção "Desenvolvimento" no README, `.env.example` atualizado.
- `pnpm verify` (= `pnpm check`) passa; `pnpm build` e `pnpm dev` verificados manualmente
  (health respondeu `{"status":"ok"}`, web respondeu 200, worker subiu).

**Decisões menores**
- Alvos Nx via `nx:run-commands` chamando as ferramentas diretamente (`tsc`, `eslint`, `vitest`, `vite`)
  em vez dos executores `@nx/*`: menos acoplamento a peer deps de plugins, e o comando de cada alvo
  fica explícito no `project.json`.
- Vitest dos apps NestJS usa `unplugin-swc` + `@swc/core`: o esbuild do Vite não implementa
  `emitDecoratorMetadata`, do qual a injeção de dependências do Nest depende. Sem isso todo teste de
  caso de uso com DI por construtor quebraria a partir do F0-05.
- `env.ts` está duplicado em `apps/api` e `apps/worker`. **Pendência:** unificar em
  `libs/platform/config` no F0-02.
- Variáveis novas no `.env.example`: `NODE_ENV`, `LOG_LEVEL` (ambas com padrão) e `WORKER_NAME`
  (obrigatória no worker). `API_PORT` continua obrigatória na api — é ela que exercita a falha clara.
- Mensagens de erro de boot em pt-BR (são para o operador); identificadores e código em inglês.
- Textos de UI do web em `apps/web/src/messages.ts`, nenhuma string solta no componente;
  o F0-13 troca esse módulo pelo react-i18next.
- `pnpm e2e` sai com erro apontando o F0-14, em vez de fingir sucesso sem suíte.
- Prettier não formata `*.md` (`.prettierignore`), para não reescrever a documentação do kit.
- pnpm 12 usa `allowBuilds` no `pnpm-workspace.yaml`: liberados `@swc/core` e `nx`. `unplugin-swc@2.0.0`
  precisou de `minimumReleaseAgeExclude`.
- `apps/web/vite.config.mts` (e não `.ts`) para o carregador nativo de config do Vite 8 não avisar
  sobre ESM em arquivo tratado como CommonJS.

**Pendências**
- Nenhuma bloqueante. `libs/`, tags e `@nx/enforce-module-boundaries` são o F0-02; cobertura mínima
  de 80% passa a valer quando existirem `domain/` e `application/` (F0-04 em diante).

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
- [x] F0-02 — Estrutura de libs e fronteiras → fase-0#F0-02 · ADR-002
- [x] F0-03 — Banco, roles e migrations → fase-0#F0-03 · ADR-001
- [x] F0-04 — Shared kernel (Money, ids, erros, CPF/CNPJ) → fase-0#F0-04 · ADR-005
- [x] F0-05 — Tenancy e isolamento RLS → fase-0#F0-05 · ADR-001
- [x] F0-06 — Convenções da API e observabilidade → fase-0#F0-06
- [x] F0-07 — Verificação de token do Clerk e resolução de tenant → fase-0#F0-07 · ADR-004 · dominio/platform.md
- [x] F0-08 — Autorização RBAC → fase-0#F0-08 · ADR-004
- [x] F0-09 — Auditoria → fase-0#F0-09 · dominio/platform.md
- [x] F0-10 — Outbox e worker → fase-0#F0-10 · ADR-003
- [x] F0-11 — Sincronização Clerk: webhooks e JIT → fase-0#F0-11 · ADR-004
- [x] F0-12 — Front: autenticação e troca de organização (Clerk) → fase-0#F0-12
- [x] F0-13 — Front: layout, menu por permissão, i18n, formatação → fase-0#F0-13
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

### 2026-09-21 — F0-02 Estrutura de libs e fronteiras entre módulos

**Feito**
- 16 libs criadas com `project.json`, `tsconfig.json`, `vitest.config.mts` e `src/index.ts`:
  `shared/kernel`, `shared/contracts`, `platform/{db,tenancy,iam,audit,outbox,config}`,
  `modules/{projects,projects-api,partners,partners-api,organization,organization-api}`,
  `web/{shell,projects}`. As libs de módulo já vêm com `domain/`, `application/`, `infra/` e `http/`.
- Tags do ADR-002 (`type:*` + `scope:*`) em todos os `project.json`, incluindo os três apps.
- Aliases `@erp/*` em `tsconfig.base.json` e resolução via `vite-tsconfig-paths` nos configs de
  Vitest/Vite, para que os testes e o front resolvam as libs pelos mesmos caminhos.
- `@nx/enforce-module-boundaries` em nível `error` com as restrições do ADR-002, e
  `@eslint-community/eslint-comments/no-restricted-disable` proibindo silenciá-la.
- `tools/architecture`: 11 testes que escrevem fixtures dentro de libs reais e rodam o ESLint sobre
  eles, cobrindo os dois cenários Gherkin da story mais as fronteiras de `-api`, do front e do
  `eslint-disable`. Roda dentro do `pnpm check`.
- `pnpm verify` passa: 20 projetos, 60 tarefas, 21 testes.

**Decisões menores**
- Aliases no formato `@erp/<escopo>-<nome>` (`@erp/platform-db`, `@erp/projects-api`), com os módulos
  de negócio sem prefixo de escopo (`@erp/projects`) porque o nome do módulo já é o escopo.
- `libs/web/shell` recebeu `scope:shared` (e não `scope:shell`): é o escopo que o ADR-002 cita como
  compartilhado do front, e é o que permite que `web/projects` dependa dele.
- Acrescentei duas restrições que o ADR-002 não lista explicitamente, por coerência com o resto da
  tabela: `type:shared` só depende de `type:shared`, e `type:tool` (o `tools/architecture`) não
  depende de lib nenhuma. Se a revisão do GATE-F0 discordar, basta removê-las do `eslint.config.mjs`.
- Os fixtures do teste de arquitetura ficam em `__arch_fixtures__`, ignorado pelo ESLint, pelo
  `tsconfig.base.json` e pelo git; o teste roda o ESLint com `--no-ignore` para enxergá-los. Isso
  evita que os arquivos temporários quebrem o `lint`/`typecheck` das libs rodando em paralelo.
- Todos os `vitest.config.ts` viraram `.mts`: o carregador nativo de config do Vite 8 emitia 19
  avisos de "ESM syntax in a file loaded as CommonJS". `pnpm verify` agora roda sem avisos.
- `@typescript-eslint/parser` virou dependência direta para satisfazer o peer do `@nx/eslint-plugin`.

**Pendências**
- **Resolução das libs em tempo de build e de execução dos apps (decisão arquitetural).**
  Hoje `apps/api` e `apps/worker` são compilados com `tsc -p tsconfig.app.json` e `rootDir: src`.
  Verificado empiricamente: assim que um app importa uma lib, o build falha com
  `TS6059: File '.../libs/shared/kernel/src/index.ts' is not under 'rootDir'`, e mesmo compilando,
  o Node não resolveria `@erp/*` em runtime (os aliases são só do TypeScript). `lint`, `typecheck` e
  `test` funcionam — só o build e o `serve` dos apps de backend são afetados.
  As opções são: (a) transformar as libs em pacotes do workspace pnpm, com build próprio;
  (b) empacotar os apps com um bundler que resolva os aliases; (c) resolver os aliases em runtime.
  É escolha de empacotamento não coberta por ADR aceito, então não improvisei. **Precisa ser decidida
  antes do F0-05**, que é o primeiro item em que um app importa uma lib; provavelmente vira um ADR-008.
- A unificação do `env.ts` de `apps/api` e `apps/worker` em `libs/platform/config`, anotada no log do
  F0-01, **não** foi feita nesta rodada: a lib foi criada vazia, mas mover o código para ela faria os
  apps importarem uma lib e esbarraria exatamente na pendência acima. Fica para a rodada que resolver
  o empacotamento (ou para o F0-06, que já mexe em configuração e observabilidade).

### 2026-09-21 — F0-03 Banco de dados, roles e migrations

**Feito**
- `docker-compose.yml` com PostgreSQL 16 (alpine) e healthcheck; `pnpm db:up` / `pnpm db:down`.
- Roles do ADR-001 criadas pelo passo inicial do `pnpm db:migrate`: `app_owner`, `app_user` e
  `app_platform`, todas `NOSUPERUSER NOBYPASSRLS NOINHERIT`. `app_owner` vira dona do banco e do
  schema `public`; `PUBLIC` perde tudo em `public`.
- Executor de migrations em `libs/platform/db`: descobre `libs/<platform|modules>/*/src/infra/migrations`,
  aplica os `.sql` em ordem (plataforma primeiro, módulos em ordem alfabética), cada um na sua
  transação, e registra em `platform.schema_migrations` com checksum sha256.
- Migrations criando os schemas `platform`, `organization`, `partners` e `projects`, com `USAGE` +
  privilégios padrão de DML para `app_user` (e `app_platform` só na plataforma).
- `startPostgresTestEnv()` em `@erp/platform-db/testing`: sobe o contêiner, cria as roles, aplica as
  migrations e entrega pools e instâncias Drizzle como `app_owner`, `app_user` e `app_platform`.
- 10 testes de integração em `pnpm check`, incluindo o cenário Gherkin da story
  (`rolbypassrls` falso e `app_user` não é dona de tabela nenhuma).
- Verificado à mão: `pnpm db:up` + `pnpm db:migrate` duas vezes — 4 migrations na primeira,
  nenhuma na segunda; `app_user` conecta, tem `USAGE` e não tem `CREATE` nos schemas.

**Decisões menores**
- **Nova variável `DATABASE_URL_ADMIN`** (e `DATABASE_URL_PLATFORM`). Não dá para criar a role dona
  do banco conectando como ela mesma: o passo de roles precisa de uma conexão administrativa. Ela é
  usada só nesse passo; nem a API nem o worker a enxergam. As senhas das roles saem das próprias
  `DATABASE_URL_*`, então URL e role nunca saem de sincronia.
- Migrations são `.sql` escritas à mão com um executor próprio, em vez do `drizzle-kit migrate`:
  roles, grants, privilégios padrão e (no F0-05) políticas de RLS não são expressáveis no schema do
  Drizzle, e o `drizzle-kit` assume uma pasta única, não uma por módulo. O `drizzle-kit` continua
  configurado (`libs/platform/db/drizzle.config.ts`) e vai gerar o SQL das tabelas na mesma pasta.
- O ledger usa o caminho da lib (`libs/modules/projects`) como chave do módulo: é inequívoco e não
  depende de uma lista fixa de módulos no código da plataforma.
- Migration já aplicada é imutável: se o checksum mudar, o executor falha com mensagem explícita.
- `tsx` adicionado como dependência de desenvolvimento para rodar o `pnpm db:migrate` (TypeScript
  direto, sem etapa de build). É a única forma hoje de executar um script TS do repositório fora do
  Vitest — ver a pendência de empacotamento do F0-02.
- `vite-tsconfig-paths` **removido**: o Vite 8 resolve os `paths` do tsconfig nativamente com
  `resolve.tsconfigPaths: true`, e o próprio Vite avisava isso a cada execução. Os 19 configs foram
  migrados; uma dependência a menos e `pnpm verify` segue sem avisos.
- `@erp/platform-db/testing` é uma entrada separada da lib, para que o Testcontainers nunca entre
  pelo `index.ts` da aplicação.
- `ssh2` e `cpu-features` (nativos, opcionais do Testcontainers) ficaram com `allowBuilds: false`:
  só servem a Docker remoto por SSH e falhavam a compilação por falta de toolchain no contêiner.

**Pendências**
- O `pnpm check` agora exige Docker. O item F0-15 (CI) precisa de um runner com Docker disponível.
- Continua valendo a pendência de empacotamento registrada no F0-02 (build e runtime dos apps de
  backend não resolvem os aliases `@erp/*`). Este item não esbarrou nela porque `pnpm db:migrate`
  roda por `tsx` e os testes rodam pelo Vitest.

### 2026-09-21 — F0-04 Shared kernel

**Feito**
- `libs/shared/kernel` com `Money`, `Quantity` e `Percentage` (ADR-005) sobre decimal.js, imutáveis
  e com estado privado — o que os torna nominais em TypeScript, então `number` não entra onde se
  espera `Money`.
- `newId()` (uuid v7), `isEntityId()`, `Result<T,E>` com `ok`/`err`/`map`/`unwrap`,
  `DomainError` (com `code` estável em inglês e `details`), `Clock` com `SystemClock` e `FixedClock`.
- Validadores de CPF e CNPJ: `isValid*`, `normalize*`, `format*`, `parse*` (devolvendo `Result`)
  e `cnpjRoot()`.
- 60 testes, cobrindo os 5 cenários Gherkin da story e os casos de borda de cada valor.
- Glossário atualizado com os 9 termos novos, conforme a regra do próprio `docs/03-glossario.md`.

**Decisões menores**
- Cada grandeza guarda a escala do banco: `Money` 4 casas (`numeric(19,4)`), `Quantity` 6
  (`numeric(19,6)`), `Percentage` 4 (`numeric(9,4)`). `toString()` devolve sempre a forma canônica
  (`"1234.5600"`), que é o que trafega na API e vai para o banco; o arredondamento para centavos é
  explícito (`round(2)`/`toFixed(2)`) e meia-par.
- **Rateio chama-se `apportion`, não `allocate`**: o glossário já usa *allocation* para o percentual
  de dedicação de um membro de equipe. `apportionment` entrou no glossário.
- Entrada só por `string`, e só decimal literal: `1e3`, `"R$ 10,00"`, `" 10.00 "` e `NaN` são
  recusados com `MONEY_INVALID_AMOUNT`. Valor vindo de JSON ou do banco nunca tem essas formas, então
  recusar cedo é melhor que arredondar um bug.
- O `decimal.js` é **clonado** (`Decimal.clone`) em vez de usado global: qualquer dependência que
  mexesse na configuração global mudaria silenciosamente um cálculo financeiro.
- `Money.equals` com moedas diferentes devolve `false` em vez de lançar — é predicado total. Já
  `plus`, `minus` e `compare` lançam `MONEY_CURRENCY_MISMATCH`, como manda o cenário da story.
- Validação de faixa (`MONEY_OUT_OF_RANGE`, `QUANTITY_OUT_OF_RANGE`, `PERCENTAGE_OUT_OF_RANGE`):
  o valor é recusado no domínio se não couber no `numeric` correspondente, em vez de estourar no
  `INSERT`.
- `Percentage.of('10.5')` é 10,5% — o número que o usuário lê. A fração (0,105) sai por
  `asFraction()`, usada internamente por `Money.applyPercentage`.
- Dependências novas: `decimal.js` (ADR-005) e `uuid` (v7; o `crypto.randomUUID()` do Node só faz v4).

**Pendências**
- **CNPJ alfanumérico.** A validação implementada é a numérica clássica (módulo 11 sobre 14 dígitos).
  O CNPJ alfanumérico entra em vigor no Brasil em 2026 e usa o valor ASCII dos caracteres no cálculo
  do DV. A story e `docs/dominio/cadastros.md` (`cnpj char(14)`, "só dígitos") descrevem o formato
  numérico, então não estendi por conta própria — mas isso precisa de decisão antes do F1-01
  (Empresas e filiais), porque muda o tipo da coluna e a validação.
- Cobertura mínima de 80% ainda não é medida: não há `domain/` nem `application/` no repositório e
  o `@vitest/coverage-v8` não foi instalado. Vale ligar no primeiro item que criar `domain/`.

### 2026-09-21 — ADR-008 e decisão sobre o CNPJ

Rodada de decisão, sem item do backlog. Duas pendências abertas foram fechadas pelo humano.

**ADR-008 — Empacotamento dos apps de backend (pendência aberta no F0-02)**
- Escrito `docs/adr/ADR-008-empacotamento-backend.md`, status **Aceito**, decidido pelo agente sob
  autorização explícita do humano para conduzir a Fase 0 de forma autônoma. Reversível no GATE-F0.
- Decisão: `tsc` com `rootDir` na raiz do workspace + `tsc-alias` reescrevendo os aliases `@erp/*`
  no JavaScript emitido. O `tsconfig.base.json` continua sendo a única fonte de verdade dos aliases,
  do editor ao runtime.
- Descartadas: libs como pacotes do workspace pnpm (custo repetido a cada módulo novo e resolução
  dupla fonte/dist), bundler nos apps (toolchain e modos de falha desproporcionais) e resolução de
  aliases em runtime (não resolve o TS6059 e atrapalha depurador e profiler).
- Verificado antes de decidir, não no papel: build, `tsc-alias`, `node dist/...` e requisição em
  `/api/v1/health` respondendo com a lib carregada e os decorators do Nest intactos. Importando
  `@erp/shared-kernel`, o build emitiu só os 11 arquivos daquela lib.
- Aplicado em `apps/api` e `apps/worker`: `tsconfig.app.json`, alvos `build` e `serve`.
  Entrada agora em `dist/<app>/apps/<app>/src/main.js`.
- Dependência nova: `tsc-alias` (build).

**CNPJ alfanumérico (pendência aberta no F0-04)**
- Decisão do humano: **manter o campo numérico**. A validação segue sendo o módulo 11 sobre 14
  dígitos, e `docs/dominio/cadastros.md` (`cnpj char(14)`, só dígitos) continua valendo como está.
  Se o alfanumérico entrar depois, será uma mudança de schema e de validação, com migration própria.

**Modo de trabalho a partir daqui**
- O humano autorizou conduzir a Fase 0 de forma autônoma. Os itens seguem um commit por item, todos
  no branch `feat/fase-0`, empilhado sobre `feat/f0-04-shared-kernel`.

### 2026-09-21 — F0-05 Tenancy e isolamento

**Feito**
- `platform.tenants` (global, sem `tenant_id` e sem RLS — é o próprio registro dos tenants) e
  `platform.tenant_settings` (primeira tabela de negócio, com RLS), em
  `libs/platform/tenancy/src/infra/migrations/0001_tenants.sql`.
- Helper de migration `platform.enable_tenant_rls(regclass)`: função PL/pgSQL que aplica
  `ENABLE` + `FORCE ROW LEVEL SECURITY` e a política exata do ADR-001. Módulo nenhum escreve a
  condição à mão nem esquece o `FORCE`. Usada como `SELECT platform.enable_tenant_rls('schema.tabela');`.
- `TenantContext` sobre AsyncLocalStorage (`runInTenantContext`, `getTenantContext`,
  `requireTenantId`) e `TenantDb.withTenantTx(fn)`, que abre a transação, aplica
  `set_config('app.tenant_id', ..., true)` e entrega cliente pg + Drizzle amarrados àquela conexão.
- `assertTenantIsolation(subject, { tenantDb, tenantA, tenantB })` em
  `@erp/platform-tenancy/testing`, cobrindo os três cenários da story. Não depende de framework de
  teste: lança `Error` com mensagem que diz o que provavelmente está errado na política.
- Schema Drizzle de `tenants` e `tenant_settings`.
- 15 testes: os 3 cenários Gherkin, `FORCE` ligado, `tenants` sem RLS, rollback, e o
  `assertTenantIsolation` **reprovando** uma tabela sem RLS criada de propósito — sem isso o
  utilitário poderia estar passando por não testar nada.

**Decisões menores**
- **Corrigida uma ordem de migrations que ia quebrar no F0-09.** A descoberta ordenava as libs de
  plataforma alfabeticamente, então `audit` e `config` viriam antes de `db`, que é dona do schema e
  das funções SQL compartilhadas. Agora `libs/platform/db` vem sempre primeiro, e o resto segue em
  ordem alfabética. Cada migration também concede privilégios explicitamente na própria tabela, em
  vez de depender só do `ALTER DEFAULT PRIVILEGES`.
- `withTenantTx` **não aceita** `tenantId` por parâmetro: lê sempre do contexto. Passar o tenant como
  argumento abriria exatamente o caminho que o ADR-001 fecha. O worker define o contexto com
  `runInTenantContext` antes de tocar o banco.
- `libs/platform/tenancy` ficou sem NestJS: nada a injeta ainda. O módulo Nest entra no F0-07, que é
  quem resolve o tenant na requisição.
- `set_config(..., true)` é local à transação. Verificado: depois do COMMIT o Postgres devolve string
  vazia, não o tenant anterior, e a consulta seguinte na mesma conexão do pool falha ao converter
  `''` para uuid — ou seja, a falha segura vale também para conexão reaproveitada.
- `createDb()` passou a aceitar `Pool | PoolClient | Client`, para o Drizzle poder ser amarrado à
  conexão da transação.

**Pendências**
- `app_platform` precisa atravessar tenants para publicar o outbox, mas `FORCE ROW LEVEL SECURITY`
  vale para todo mundo e `BYPASSRLS` é proibido. A política padrão do `enable_tenant_rls` ficou
  exatamente como o ADR-001 descreve, sem exceção para `app_platform`. **O F0-10 precisa resolver
  isso** — provavelmente com uma política adicional na tabela do outbox.
- `created_by`/`updated_by` de `tenant_settings` ficaram sem FK: `platform.users` só existe no F0-11.

### 2026-09-21 — F0-06 Convenções da API e observabilidade

**Feito**
- Duas libs de plataforma novas: `@erp/platform-http` (convenções HTTP) e
  `@erp/platform-observability` (log e correlação).
- `ZodValidationPipe`/`zodPipe(schema)` validando entrada com os schemas de `@erp/shared-contracts`.
- `ProblemDetailsFilter`: único lugar que transforma exceção em resposta. Sai sempre em
  `application/problem+json` (RFC 9457) com `code` estável, mapeando `DomainError.code` para status
  (400/401/403/404/409) e caindo em 422 para regra de negócio sem status próprio. Erro inesperado
  vira 500 sem vazar mensagem interna — essa vai para o log, com o `correlationId` que o cliente
  também recebeu.
- `CorrelationIdMiddleware`: aceita `X-Correlation-Id` do cliente ou gera, devolve no header e põe
  no contexto de log (RNF033).
- Logger pino em JSON, com redação em duas camadas (RNF022) e `mixin` que injeta `correlationId`,
  `userId` e `tenantId` em toda linha. `NestPinoLogger` faz o log interno do NestJS sair no mesmo
  formato — sem isso metade do log escapava da redação.
- Paginação (`paginationQuerySchema`, `paginated`, `toOffsetLimit`) e concorrência otimista
  (`versionSchema`, `withVersion`, `assertVersion`) em `@erp/shared-contracts` e `@erp/shared-kernel`.
- Erros padronizados no kernel: `ValidationError`, `NotFoundError`, `ConcurrencyConflictError`,
  `UnauthenticatedError`, `ForbiddenError`.
- OpenAPI em `/api/docs`, com os schemas zod publicados como componentes via `z.toJSONSchema()`.
- `/api/v1/health` (liveness) e `/api/v1/ready` (readiness, consulta o banco).
- `libs/platform/config`: `loadApiEnv`/`loadWorkerEnv` com zod — **fecha a pendência do F0-01**,
  o `env.ts` duplicado nos dois apps saiu.
- 28 testes novos; `pnpm verify` passa com 22 projetos e 66 tarefas.
- Verificado à mão contra o Postgres local: `/health`, `/ready`, `/api/docs`, 404 em problem+json
  com o `correlationId` enviado pelo cliente, e log JSON de ponta a ponta.

**Decisões menores**
- **Duas libs de plataforma fora da lista do F0-02.** `platform/http` e `platform/observability` não
  estavam previstas, mas pipe, filtro e logger são usados pelos controllers dos módulos: em
  `apps/api` os módulos não poderiam importá-los. Seguem o padrão `libs/platform/<nome>` e as mesmas
  tags do ADR-002.
- Os erros padronizados ficaram em `@erp/shared-kernel`, não na lib HTTP: "não encontrado" e
  "conflito de versão" são fatos do domínio. Só o mapeamento para status HTTP é da camada web.
- `assertVersion(entity, enviada, atual)` no kernel: um lugar só decide o que é conflito de versão.
- A redação do log tem duas camadas porque uma não basta: por chave (o `redact` do pino pega
  `password`, `token`, `authorization`, `cpf`, `cnpj`, `email` em qualquer nível) e por padrão
  (CPF, CNPJ e e-mail mascarados mesmo no meio de uma mensagem de texto). O domínio do e-mail é
  preservado: ajuda a diagnosticar e não identifica ninguém sozinho.
- A API passou a exigir `DATABASE_URL_APP` no boot — `/ready` consulta o banco.
- `AppModule.forRoot(env)` recebe a configuração por parâmetro em vez de ler o ambiente: é o que
  permite o teste montar o mesmo módulo apontando para o Postgres do Testcontainers.
- `DbPoolLifecycle` fecha o pool no shutdown. Sem ele o processo não terminava sozinho e o teste
  terminava com erro de conexão derrubada.
- `@scarf/scarf` (telemetria de instalação, veio junto de uma dependência) com `allowBuilds: false`.

**Pendências**
- A redação por chave cobre nomes conhecidos; um campo sensível com nome novo não é pego
  automaticamente. Vale revisar a lista de `REDACT_PATHS` a cada módulo que trouxer PII.
- `/ready` só checa o banco. Quando o pg-boss entrar (F0-10), a fila deve entrar na sonda também.

### 2026-09-21 — F0-07 Verificação de token do Clerk e resolução de tenant

**Feito**
- Interface `IdentityProvider` em `libs/platform/iam` — única lib do backend que importa
  `@clerk/*` (ADR-004) — com `ClerkIdentityProvider` (`@clerk/backend` 2.x, `verifyToken`
  networkless com `CLERK_JWT_KEY` e `authorizedParties`).
- `FakeIdentityProvider` em `@erp/platform-iam/testing`: gera par de chaves RSA no processo e
  assina tokens no formato v2 do Clerk (`sub`, `sid`, `o.id`, `o.slg`, `azp`, `exp`, `nbf`, `v:2`).
- Tabelas `platform.users` (global) e `platform.memberships` (com RLS), conforme
  `docs/dominio/platform.md`.
- `AuthenticationMiddleware` + `AuthGuard` global + `AuthContext`; `GET /api/v1/me`;
  decorators `@Public()` e `@AllowWithoutTenant()`.
- 13 testes de integração cobrindo os 6 cenários Gherkin, mais 7 na composição da API.
- `withTenantSession(pool, tenantId, fn)` em `@erp/platform-tenancy/testing`, para fixtures.
- Ordem de migrations de plataforma agora é uma lista explícita.

**Decisões menores**
- **A verificação do token no teste não é simulada.** O `FakeIdentityProvider` assina com chave
  local, mas a verificação chama a mesma `verifySessionToken` de produção, apontada para a chave
  pública local. Expiração, `nbf`, `azp` e assinatura são exercitados no código que roda em
  produção, sem tocar na rede. Um fake que "verificasse de mentira" testaria o fake.
- **Autenticação é middleware, não guard.** Ela precisa instalar `AuthContext` e `TenantContext`
  (AsyncLocalStorage) ao redor de todo o restante da requisição; o escopo de um guard termina antes
  do handler. O middleware só reúne fatos — inclusive os desfavoráveis, como membership revogado —
  e o guard aplica a política, porque só ele conhece as exigências da rota.
- Ordem de recusa no guard, pensada para o usuário entender o problema: não autenticado →
  não escolheu organização → organização inativa → acesso revogado.
- `memberships` tem `tenant_id`, logo tem RLS como qualquer tabela de negócio. Isso só funciona
  porque o tenant é resolvido antes, por `clerk_org_id` em `tenants`, que é global.
- **A ordem alfabética das migrations de plataforma ia quebrar aqui**: `iam.memberships` tem FK para
  `tenancy.tenants`, e `iam` vem antes de `tenancy` no alfabeto. Agora existe
  `PLATFORM_MIGRATION_ORDER`, uma lista explícita, e uma lib de plataforma com migrations fora dela
  faz o executor falhar — a ordem passa a ser decisão, não acidente do nome do diretório.
- `ProblemDetailsFilter` passou a aceitar `statusByCode` na construção, e `platform/iam` exporta
  `IAM_ERROR_STATUS`. Cada lib declara o status dos seus códigos e a composição junta, em vez de um
  registro global mutável.
- `withTenantSession` nasceu de um erro real: `FORCE ROW LEVEL SECURITY` vale inclusive para a dona
  da tabela, então o próprio fixture falhava ao inserir membership sem declarar o tenant.
- `AUTH_USER_NOT_PROVISIONED` e `TENANT_NOT_PROVISIONED` são temporários: o F0-11 troca a recusa por
  provisionamento sob demanda.
- `verifyWebhook` **não** entrou na interface `IdentityProvider`: entra no F0-11, junto do webhook.
  Declarar agora só produziria um stub que lança.
- A API passou a exigir `CLERK_JWT_KEY`, `CLERK_SECRET_KEY` e `CLERK_AUTHORIZED_PARTIES` no boot.

**Pendências**
- O guard ainda não checa permissão nenhuma: `@RequirePermission` e o RBAC são o F0-08.
- `/api/docs` fica fora do guard (o Swagger registra rotas Express, não rotas do Nest). Em produção
  isso expõe a documentação sem autenticação — decidir no F0-15 se fecha por ambiente.

### 2026-09-21 — F0-08 Autorização (RBAC)

**Feito**
- Tabelas `platform.roles`, `platform.role_permissions` e `platform.membership_roles`, as três com
  `tenant_id` e RLS: o conjunto de papéis de um tenant não é visto nem alterado por outro.
- `@RequirePermission('<modulo>.<recurso>.<acao>')` e `PermissionGuard` global, rodando depois do
  `AuthGuard` — autenticar antes de autorizar.
- `PermissionCatalog` com `registerPermissions` por módulo, validando o formato da chave, o prefixo
  do módulo e a duplicidade.
- `PermissionService`: permissões do banco (nunca do token, ADR-004) com cache de 60 s, invalidado
  na hora por qualquer mutação de papel ou de atribuição.
- `RoleService` + `RolesController`: CRUD de papéis com concorrência otimista (409), proteção dos
  papéis do sistema e atribuição de papéis a membros.
- Semeadura dos seis papéis de `docs/dominio/platform.md`, idempotente, pronta para o F0-11.
- Teste de arquitetura novo em `tools/architecture`: varre os `*.controller.ts` com a API do
  TypeScript e reprova rota de escrita sem `@RequirePermission` nem `@Public`, apontando
  arquivo, linha, classe e método.
- 37 testes em `platform-iam` e 16 em `architecture`.

**Decisões menores**
- O teste do cenário 2 é **análise estática do fonte**, não de runtime: o que se quer pegar é o
  decorator esquecido, e uma rota esquecida não aparece em teste nenhum — ela simplesmente responde
  a quem não devia.
- Rota de **leitura** sem `@RequirePermission` continua valendo (basta estar autenticado no tenant);
  só escrita é obrigada a declarar. É o que o cenário Gherkin pede e evita decorator cerimonial em
  todo GET. Quando a Fase 1 trouxer leitura sensível, a permissão entra explicitamente.
- `invalidateTenant` derruba o cache do tenant inteiro, e não só do membership alterado: mexer num
  papel muda as permissões de todos que o têm, e descobrir quem são custa mais do que recarregar.
- `Administrador` recebe todas as permissões do catálogo no momento da semeadura. Os outros cinco
  papéis recebem o que cada módulo declarar em `defaultRoles` — hoje, nada, porque só a plataforma
  registrou permissões e administrar papéis é administração. A Fase 1 preenche.
- Permissão fora do catálogo é recusada com `PERMISSION_UNKNOWN` em vez de aceita: quase sempre é
  erro de digitação, e aceitar criaria um papel que nunca autoriza nada.
- `PUT` em vez de `PATCH` para alterar papel: a atualização substitui o conjunto de permissões.

**Pendências**
- O cache de permissões é por processo. Com mais de uma instância da API, a invalidação não
  atravessa — o TTL de 60 s limita a janela. Se virar problema, a saída natural é publicar a
  invalidação pelo outbox (F0-10).
- `role_permissions` e `membership_roles` não têm `created_at`/`created_by`: são tabelas de ligação
  e quem registra a mudança é a auditoria (F0-09).

### 2026-09-21 — F0-09 Auditoria

**Feito**
- Tabela `platform.audit_log` conforme `docs/dominio/platform.md`, com RLS e índice
  `(tenant_id, entity, entity_id, occurred_at DESC)`.
- `AuditService.record(tx, entry)` — recebe a **transação do caso de uso** como primeiro
  argumento: se a escrita de negócio desfizer, o registro desfaz junto.
- Mascaramento automático de PII, com `AuditRegistry` para cada módulo declarar os campos das
  suas entidades, somado a uma lista de nomes sempre mascarados.
- `GET /api/v1/audit?entity=&entityId=` com `platform.audit.read`, paginado, do mais recente ao
  mais antigo.
- `RoleService` passou a auditar criação, alteração, exclusão e atribuição de papéis.
- 14 testes em `platform-audit` e os dois cenários Gherkin cobertos.

**Decisões menores**
- **PII vira um resumo do sha256, não um `[REDACTED]` fixo.** A trilha existe para responder
  "mudou?", e dois `[REDACTED]` não respondem isso. Resumos iguais significam valor igual;
  diferentes, valor alterado — sem guardar o dado pessoal.
- **Refatoração do repositório de papéis**: todo método passou a receber a transação em vez de
  abrir a sua. Sem isso não havia como gravar a mudança e a auditoria atomicamente. É o padrão que
  os módulos da Fase 1 vão seguir: o serviço abre a transação, o repositório recebe.
- **Os decorators `@Public`, `@AllowWithoutTenant` e `@RequirePermission` mudaram de
  `platform/iam` para `platform/http`.** O IAM audita as próprias mudanças de papel, então depende
  de `platform/audit`; se a auditoria precisasse do decorator do IAM, as duas libs fechariam um
  ciclo. Os guards que leem os metadados continuam no IAM.
- Pelo mesmo motivo existe `AuditTenantResolver`: a lib de auditoria não conhece o `AuthContext`
  (que é do IAM); a composição em `apps/api` liga os dois.
- **Correção do F0-08**: eu tinha proibido renomear papel do sistema, o que não está em lugar
  nenhum — `docs/dominio/platform.md` diz apenas que papel semeado não pode ser *excluído*, e o
  cenário Gherkin desta story renomeia o "Financeiro". A restrição de rename foi removida.
- `REVOKE ALL` seguido de `GRANT SELECT, INSERT` na `audit_log`: os privilégios padrão do schema
  `platform` concediam DML completo, o que daria UPDATE e DELETE à role da aplicação. O teste
  pegou isso.
- `app_platform` também escreve e lê a trilha: ação de worker precisa ser auditável.

**Pendências**
- Os módulos ainda não declaram campos PII (`AuditRegistry` registrado vazio em `apps/api`).
  Cada entidade com PII na Fase 1 precisa declarar os seus, conforme o RNF020.
- Auditar automaticamente todo caso de uso de escrita depende de disciplina, não de mecanismo. Se
  virar problema, um decorator ou um interceptor por caso de uso resolveria.

### 2026-09-21 — F0-10 Outbox e worker

**Feito**
- `platform.outbox_events` e `platform.processed_events`, ambas com RLS.
- `OutboxWriter.append(tx, evento)` — grava o evento na transação do caso de uso, e valida o
  formato `<modulo>.<entidade>.<fato>.v<N>`.
- `OutboxPublisher`: `FOR UPDATE SKIP LOCKED`, backoff exponencial (2 s, 4 s, 8 s… teto de 1 h) e
  dead-letter após 10 falhas.
- `IdempotentConsumer`: grava `(consumer_name, event_id)` na mesma transação do efeito e roda no
  tenant do evento.
- `EventBus` como interface, com `PgBossEventBus` (produção) e `InMemoryEventBus` (teste).
- `apps/worker` sobe o bus e o publicador, com encerramento gracioso em SIGTERM/SIGINT.
- 16 testes cobrindo os 4 cenários Gherkin. Verificado à mão: o worker sobe contra o Postgres
  local, o pg-boss cria as 12 tabelas dele no schema `pgboss` conectando como `app_platform`.

**Decisões menores**
- **Resolvida a pendência do F0-05** sobre `app_platform` atravessar tenants: em vez de
  `BYPASSRLS` — que valeria para o banco inteiro —, a `outbox_events` ganhou uma política
  permissiva adicional `FOR ALL TO app_platform USING (true)`. O alcance cross-tenant fica restrito
  à tabela onde ele é inerente, e as demais tabelas continuam fechadas para essa role.
- O schema `pgboss` é criado pela migration, pela dona do banco, e o worker recebe `USAGE, CREATE`
  nele. Assim o pg-boss cria as próprias tabelas rodando como `app_platform`, sem precisar de
  permissão para criar schema.
- `EventBus` é interface porque publicador e consumidores precisam ser testáveis sem fila. O
  `InMemoryEventBus` ainda permite programar falhas, que é como o backoff e o dead-letter foram
  testados.
- Coluna `next_attempt_at` com índice parcial dos pendentes: o backoff precisa de estado no banco,
  já que o publicador não guarda nada em memória entre rodadas.
- A idempotência grava a marca **antes** do efeito, com `on conflict do nothing`: o segundo
  consumidor concorrente vê zero linhas afetadas e desiste sem aplicar nada. Como tudo está na
  mesma transação, efeito que falha desfaz a marca junto.
- Nos testes, limpar as tabelas usa `TRUNCATE`: `DELETE` passaria pela RLS e exigiria declarar o
  tenant a cada limpeza.
- Variáveis novas do worker: `DATABASE_URL_APP`, `DATABASE_URL_PLATFORM` e
  `OUTBOX_POLL_INTERVAL_MS`.

**Pendências**
- `/ready` da API ainda não olha a fila. Quando houver operação dependendo do worker, a sonda
  deve incluir o pg-boss.
- Dead-letter "gera alerta" (ADR-003): hoje só loga em nível `warn`. O canal de alerta é o
  `platform/notifications`, que ainda não existe.
- Nenhum consumidor real registrado ainda: os módulos da Fase 1 registram os seus no
  `WorkerService`.

### 2026-09-21 — F0-11 Sincronização Clerk: webhooks e provisionamento sob demanda

**Feito**
- `POST /api/v1/webhooks/clerk` (`@Public`, corpo bruto preservado via `rawBody: true` no
  `NestFactory.create`), verificado por `IdentityProvider.verifyWebhook`. Trata `user.*`,
  `organization.*` e `organizationMembership.*`; evento fora dessa lista responde 200 `ignored`.
- Idempotência por `svix-id` em `platform.processed_webhooks` (migration 0003), reclamada com
  `on conflict do nothing` antes de aplicar o efeito: a reentrega responde 200 `duplicated`.
- `IdentitySyncService`: upserts idempotentes de usuário, tenant e vínculo, usados tanto pelo
  webhook quanto pelo provisionamento sob demanda. Tenant novo nasce com os seis papéis do F0-08;
  `org:admin` no Clerk vira `Administrador`, o resto `Membro de Equipe` — e só no primeiro vínculo,
  depois disso apenas o RBAC local vale.
- Provisionamento sob demanda no `AuthenticationMiddleware`: token válido de usuário/organização
  ainda não espelhados materializa os três registros a partir da Backend API. `AUTH_USER_NOT_PROVISIONED`
  e `TENANT_NOT_PROVISIONED` deixam de ser o caminho normal e sobram só para quem nem o provedor conhece
  (**resolve a pendência anotada no F0-07**).
- `pnpm cli dev:seed`: a partir de `E2E_CLERK_USER_EMAIL`, copia do Clerk de desenvolvimento o
  usuário, as organizações dele e os vínculos. É o que povoa o banco onde o webhook não tem como
  chegar (desenvolvimento local e E2E do F0-14).
- 53 testes no `platform-iam`, cobrindo os seis cenários Gherkin da story mais renomeação e
  encerramento de organização, e a semeadura de desenvolvimento. `pnpm verify` passa:
  22 projetos, 66 tarefas.

**Decisões menores**
- A API passou a abrir também uma conexão `app_platform` (`DATABASE_URL_PLATFORM`, token
  `PLATFORM_DB_POOL`): a sincronização precisa de duas leituras que atravessam tenants — em quais
  tenants um usuário excluído tem vínculo, e a qual tenant pertence um vínculo removido —, ambas
  antes de haver tenant no contexto. Migration 0004 dá a `app_platform` uma política **só de
  leitura** sobre `platform.memberships`, mesmo desenho já usado na `outbox_events` no F0-10.
  A escrita continua toda por `app_user`, dentro da transação do tenant.
- Tabela de idempotência chamada `processed_webhooks`, e não `processed_events` como diz o ADR-004:
  esse nome já é da tabela do outbox (F0-10), que tem `tenant_id` e RLS. O webhook chega **antes**
  de existir tenant — é ele que cria o tenant —, então precisa de uma tabela global, sem RLS.
- O conflito do upsert de vínculo é pela dupla `(tenant_id, user_id)`, não pelo `clerk_membership_id`:
  é o que faz o vínculo criado sob demanda (id provisório `jit_<org>_<user>`) ser reconciliado quando
  o webhook chega depois com o id verdadeiro, em vez de virar uma segunda linha.
- Auditoria das mudanças vindas do provedor vai sem `userId` (ação de sistema, como o `AuditEntry`
  já previa): criação e renomeação de tenant, encerramento de tenant, criação/reativação de vínculo
  e revogação. Usuário e tenant são tabelas globais, mas toda mudança auditada aqui tem um tenant
  onde arquivá-la. `user.deleted` aparece na trilha de cada tenant como a revogação do vínculo,
  com o motivo.
- `IdentityProvider` ganhou `verifyWebhook`, `findUserByEmail` e `listMembershipsOfUser`. Os dois
  últimos existem só para o `dev:seed`, que parte de um e-mail — não há token nem webhook de onde
  tirar os ids. O `FakeIdentityProvider` assina webhooks com HMAC-SHA256 sobre `id.timestamp.payload`,
  o mesmo esquema do Svix, para o cenário de assinatura inválida provar alguma coisa.
- `pnpm cli` é um despachante em `apps/api/src/cli/main.ts` (composição, sem regra de negócio;
  o que cada comando faz mora na lib dona do assunto), e não um app Nx novo — `type:tool` não pode
  depender de lib nenhuma pelas fronteiras do ADR-002, e a §5 do CLAUDE.md fixa os três apps.
  Roda por `tsx` com `tsconfig.cli.json` na raiz, que junta os caminhos `@erp/*` e os decorators
  do Nest (nenhum tsconfig existente tinha os dois).
- `nx.json` ganhou `"analytics": true` na rodada anterior, ao responder um prompt do Nx. Mantido:
  removê-lo faz o prompt voltar e travar o autoloop.

**Pendências**
- `pnpm cli dev:seed` foi exercitado até a chamada ao Clerk, onde para em "Unauthorized": o `.env`
  local ainda tem o `sk_test_xxx` do `.env.example`. Preencher `CLERK_SECRET_KEY` e
  `E2E_CLERK_USER_EMAIL` com a instância de desenvolvimento antes do F0-14, que depende deste comando.
- O webhook não tem como chegar em desenvolvimento sem um túnel (ngrok ou similar) apontado para
  `/api/v1/webhooks/clerk`. Até lá, `dev:seed` e o provisionamento sob demanda cobrem o caminho.
- `organization.updated` espelha nome e slug; mudanças de plano/limites do tenant não existem ainda.

### 2026-09-21 — Alinhamento do ADR-004 e do modelo de domínio (sem código)

**Feito**
- ADR-004, seção "Sincronização Clerk → banco local": a idempotência dos webhooks passa a apontar
  `platform.processed_webhooks`, com o motivo escrito ali — a `processed_events` do ADR-003 é por
  tenant e sob RLS, porque um consumidor de outbox sempre roda dentro de um tenant que já existe;
  o webhook chega antes, já que é `organization.created` que cria o tenant. Nota de emenda no
  cabeçalho do ADR, que continua **Aceito**.
- `docs/dominio/platform.md`: seção nova `processed_webhooks (global)` com as colunas reais
  (`svix_id` pk, `event_type`, `processed_at`) e o mesmo motivo.
- `docs/dominio/platform.md`: corrigida a descrição da `processed_events`, que estava defasada em
  relação ao que o F0-10 implementou. O texto dizia "global (sem RLS)" e `event_id text`; a tabela
  tem `tenant_id` com FK, RLS ativa e `event_id uuid`. Também caiu a frase que mandava os webhooks
  do Clerk usarem essa tabela com `consumer_name = 'clerk-webhook'`.

**Decisões menores**
- A emenda ficou no cabeçalho do ADR em vez de um ADR novo: o que mudou foi o nome e o desenho de
  uma tabela de apoio, não a decisão de usar Clerk, webhooks e idempotência por `svix-id`.

**Pendências**
- Nenhuma. Só documentação: nenhum arquivo de código, migration ou teste foi tocado, e a pendência
  registrada no F0-11 sobre o desvio do ADR está resolvida.

### 2026-09-21 — F0-12 Front: autenticação e troca de organização (Clerk)

**Feito**
- Clerk CLI 3.3.0 instalado e `clerk init --app app_3JdisYmzXgGLw4l1bhicBekMrMX` executado na raiz:
  detectou React, instalou `@clerk/react` 6.16.1 (o SDK que o ADR-004 exige), não gerou arquivo algum
  e preencheu `CLERK_SECRET_KEY` e `VITE_CLERK_PUBLISHABLE_KEY` no `.env` com a instância de
  desenvolvimento `ins_3JdisX94VeS6wuWdu6HOzDtOxMS` do app `ERP-WSS`. `clerk doctor` sem pendências.
- `libs/web/shell` ganhou a superfície de autenticação: `AppProviders` (`ClerkProvider` com
  localização `ptBR` + `QueryClientProvider`), `RequireAuth`, `RequireOrganization`,
  `OrganizationCacheReset` e as páginas 401/403/404.
- `ApiClient` tipado pelos schemas zod de `@erp/shared-contracts`: busca o token via `getToken()`
  a cada chamada, envia `Authorization: Bearer`, valida a resposta contra o schema e converte
  `application/problem+json` em `ApiError` com `status` e `code` preservados.
- `apps/web` passou a compor as rotas: `/entrar` e `/cadastrar` públicas com `<SignIn/>` e
  `<SignUp/>`, rotas protegidas sob
  `RequireAuth` → `RequireOrganization` → `AppLayout` (com `<OrganizationSwitcher/>` e `<UserButton/>`),
  `/401`, `/403` e catch-all 404.
- 26 testes de componente e de unidade com o Clerk simulado via `vi.mock`, sem rede. Os dois cenários
  Gherkin da story viraram teste: redirecionamento para `/entrar` sem sessão e descarte do cache do
  TanStack Query ao trocar de organização.
- `pnpm verify` passa (66 tasks, 22 projetos). `nx build web` e o dev server verificados manualmente.

**Decisões menores**
- Dependências novas, todas já previstas na stack do CLAUDE.md §3: `@clerk/localizations` 4.17.1,
  `react-router` 8.4.0 e `@tanstack/react-query` 5.103.1.
- Clerk CLI instalado com `npm -g` e não `pnpm install -g`: o `pnpm` global exigiria configurar
  `PNPM_HOME` no profile do shell. É ferramenta de desenvolvedor, não dependência do repo.
- `apps/web/src/messages.ts` foi absorvido por `libs/web/shell/src/messages.ts`: com o shell passando
  a ter texto de UI próprio (guardas, páginas de erro), dois módulos de mensagens se dividiriam sem
  critério. O F0-13 troca esse módulo único pelo react-i18next mantendo as chaves.
- `App.tsx` exporta só o mapa de `<Routes>`, sem router: `main.tsx` monta o `BrowserRouter` e os testes
  montam um `MemoryRouter`, o que permite testar redirecionamento sem navegador.
- `envDir: '../../'` no `apps/web/vite.config.mts`. O `.env` é único e fica na raiz do monorepo
  (CLAUDE.md §6.1), mas o Vite o procura na raiz do projeto Vite (`apps/web`): sem isso
  `VITE_CLERK_PUBLISHABLE_KEY` chegava indefinida e o app quebrava no boot. Pego no smoke test do
  dev server, não pelos testes (que simulam o Clerk).
- O cache é descartado com `queryClient.clear()` comparando o `orgId` anterior, e não por chave de
  query com o tenant: todo dado em cache pertence a um tenant (ADR-001), então não há o que preservar.
- `ApiClient` recebe `fetchImpl` injetável, para os testes não tocarem a rede.

**Pendências**
- `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `CLERK_AUTHORIZED_PARTIES` e
  `E2E_CLERK_USER_EMAIL`/`E2E_CLERK_USER_PASSWORD` continuam com valores de teste: o `clerk init` não
  os preenche. Precisam vir do Dashboard antes de exercitar o webhook do F0-11 e o E2E do F0-14.
- Bundle do web em 776 kB (o SDK do Clerk domina). Avaliar code-splitting por rota no F0-13.
- Layout, menu por permissão, i18n de verdade e formatação seguem como F0-13, conforme planejado.

### 2026-09-21 — F0-13 Front: layout, menu por permissão, i18n e formatação

**Feito**
- `GET /api/v1/me` passou a responder também `permissions` (RBAC local) e `modules`
  (habilitados no tenant), com schema zod em `libs/shared/contracts/src/me.ts` — o mesmo
  contrato tipa o controller e valida a resposta no front.
- `platform.tenant_modules` criada (migration `platform/config/0001`), com RLS, `UNIQUE
  (tenant_id, module)` e as colunas padrão de tabela de negócio. `ModuleCatalog` (catálogo
  do que a instalação oferece, preenchido na composição da API) + `TenantModuleService`
  (lê os desvios, grava com auditoria). A API registra hoje só o módulo `platform`.
- `libs/web/shell` ganhou: i18n pt-BR com react-i18next (`I18nProvider`, `createI18n`),
  formatação brasileira (`formatMoney`, `formatDate`, `formatDateTime`, `formatHours`,
  `formatQuantity`, `formatPercentage`), `ApiProvider`/`useApi`, `useMe`, o filtro de menu
  (`visibleMenuItems`), o layout `AppShell` e os componentes base sobre Tailwind 4 +
  shadcn/ui: `Button`, `Input`, `Dialog`, `ConfirmDialog`, `EmptyState`, `DataTable`
  (paginada pelo servidor) e `Form`/`FormField`/`FormActions`/`useZodForm`.
- `apps/web` compõe o menu em `src/layout/menu-items.ts` (Início, Projetos, Papéis,
  Auditoria), carrega `styles.css` com os tokens de cor e faz proxy de `/api` para a API
  em desenvolvimento.
- Os dois cenários Gherkin da story viraram teste: "Projetos" não aparece para quem não
  tem permissão do módulo (`apps/web/src/App.spec.tsx` e `app-shell.spec.tsx`), e
  `formatMoney('1234.5')` = `R$ 1.234,50` com `2026-09-21T02:00:00Z` = `20/09/2026`
  (`format.spec.ts`). 61 testes no front e 18 no `platform-config`.
- `pnpm verify` passa: 22 projetos, 66 tarefas. `nx build web` também.

**Decisões menores**
- `tenant_modules` foi para `libs/platform/config` e não para `tenancy`: o mapa de módulos
  (`docs/01-mapa-modulos.md`) dá "módulos ativos" a `platform/config`. A lib, que só lia
  variáveis de ambiente, passou a ter migrations — entrou em `PLATFORM_MIGRATION_ORDER`
  logo depois de `tenancy`, por causa da FK para `platform.tenants`.
- Ausência de linha em `tenant_modules` significa **habilitado**: o catálogo do que existe
  fica no código, a tabela guarda só o desvio. Evita semear N linhas por tenant novo e faz
  um módulo recém-lançado acender sozinho. `docs/dominio/platform.md` atualizado.
- `setEnabled` grava e audita na mesma transação (§4.5), com `CREATE`/`UPDATE` conforme já
  houvesse linha; regravar o mesmo estado não gera versão nem registro. Ainda não há
  endpoint para isso — a tela de administração de módulos não está em nenhuma story.
- O módulo `messages.ts` do F0-12 virou `i18n/pt-BR.ts`, com as mesmas chaves, como estava
  planejado. Os testes passaram a comparar com `ptBRTranslations.*`, não com string solta.
- `MenuItem.labelKey` é tipado por `keyof AppTranslations['menu']`: um item de menu com
  rótulo sem tradução não compila.
- `ApiProvider` com cliente injetado não chama `useAuth()` (renderiza outro componente):
  é o que permite testar componente sem `ClerkProvider` nenhum.
- Entrada de teste nova `@erp/web-shell/testing` (`renderWithShell`, `createStubApiClient`,
  `meFixture`), no mesmo padrão de `@erp/platform-db/testing`. O `ApiClient` de verdade é
  exercitado; quem responde é um `fetchImpl` em memória, sem rede.
- Formatação sem `number`: `Intl.NumberFormat` recebe a string decimal (ADR-005). Data sem
  hora (`2026-09-21`) é reordenada sem conversão de fuso — convertê-la jogaria para o dia
  anterior.
- `@tanstack/react-table` fixado em 8.x: o 9 instalado por padrão tem API nova
  (`useTable`/`tableFeatures`) e ainda pouca tração.
- Dependências novas, todas dentro da stack do CLAUDE.md §3: `i18next`, `react-i18next`,
  `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-table`, `tailwindcss` +
  `@tailwindcss/vite`, e os utilitários que o shadcn/ui pressupõe (`clsx`, `tailwind-merge`,
  `class-variance-authority`, `lucide-react`, `@radix-ui/react-dialog`,
  `@radix-ui/react-slot`). Componentes escritos à mão no padrão shadcn/ui em vez de
  `npx shadcn init`, que assume um app único e não uma lib de monorepo.

**Pendências**
- Bundle do web em 878 kB (o SDK do Clerk domina; eram 776 kB no F0-12). Code-splitting por
  rota não ajuda enquanto o `AppShell` usa `OrganizationSwitcher` e `UserButton`: fica para
  quando houver rota pesada de verdade.
- Tema só claro. Os tokens de cor estão num `@theme` único em `apps/web/src/styles.css`;
  modo escuro é trocar esse bloco quando alguém pedir.
- `FormField` cobre campo de texto; select, data e campo monetário chegam com a primeira
  tela que precisar deles (Fase 1).
- Não há tela de administração de módulos do tenant: `tenant_modules` só se altera por SQL
  ou pelo serviço. Sem story para isso ainda.
- As chaves do Clerk `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`,
  `CLERK_AUTHORIZED_PARTIES` e `E2E_CLERK_USER_EMAIL`/`E2E_CLERK_USER_PASSWORD` continuam
  com valores de teste — bloqueiam o E2E do F0-14, como já registrado no F0-12.

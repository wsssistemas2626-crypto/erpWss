# ADR-008 — Empacotamento dos apps de backend e resolução das libs

**Status:** Aceito · **Data:** 2026-09-21

> Decidido pelo agente sob autorização explícita do humano para conduzir a Fase 0 de forma autônoma.
> É reversível: revise no GATE-F0.

## Contexto

Desde o F0-02 as libs são importadas pelos aliases `@erp/*` declarados em `tsconfig.base.json`.
`lint`, `typecheck` e `test` resolvem esses aliases sem problema — o ESLint pelo grafo do Nx, o
`tsc` pelos `paths`, o Vitest pelo `resolve.tsconfigPaths` nativo do Vite 8.

O **build dos apps de backend**, não. Verificado no F0-02: bastou `apps/api` importar uma lib para
o build quebrar com

```
error TS6059: File '.../libs/shared/kernel/src/index.ts' is not under 'rootDir'
'.../apps/api/src'. 'rootDir' is expected to contain all source files.
```

E, mesmo compilando, o Node não resolveria `require("@erp/shared-kernel")` em tempo de execução:
`paths` é uma construção do TypeScript, não existe para o runtime.

O F0-05 é o primeiro item em que um app importa uma lib de plataforma, então a decisão não pode
mais esperar. `apps/web` não é afetado: o Vite resolve os aliases no próprio build.

Restrição que elimina boa parte das opções: o NestJS depende de `emitDecoratorMetadata`, que só o
`tsc` e o SWC implementam — o esbuild, não.

## Decisão

**`tsc` com `rootDir` na raiz do workspace, seguido de `tsc-alias` para reescrever os aliases no
JavaScript emitido.** (Opção C abaixo.)

Para cada app de backend:

```jsonc
// apps/api/tsconfig.app.json
{
  "compilerOptions": {
    "rootDir": "../..",        // raiz do workspace: cabe app + libs
    "outDir": "../../dist/api" // uma árvore por app, sem sobreposição de cache no Nx
  },
  "include": ["src/**/*.ts"]   // o tsc puxa as libs seguindo os imports
}
```

```
build: tsc -p apps/api/tsconfig.app.json && tsc-alias -p apps/api/tsconfig.app.json
```

Consequências práticas:

- O ponto de entrada passa a ser `dist/<app>/apps/<app>/src/main.js`; as libs usadas ficam em
  `dist/<app>/libs/...`. A profundidade é inerente: o `rootDir` precisa conter todos os fontes.
- Só entram no build as libs que o app realmente importa — o `tsc` segue os imports. Verificado:
  importando `@erp/shared-kernel`, o build emitiu 11 arquivos daquela lib e nenhum de outra.
- `tsc-alias` troca `require("@erp/shared-kernel")` por `require("../../../libs/shared/kernel/src/index.js")`.
- O `tsconfig.base.json` continua sendo a **única** fonte de verdade dos aliases, para lint,
  typecheck, teste, build e runtime.

Verificado de ponta a ponta antes de decidir: build, `tsc-alias`, `node dist/...`, requisição em
`/api/v1/health` respondendo com a lib carregada e os decorators do Nest funcionando.

## Alternativas consideradas

### A — Libs como pacotes do workspace pnpm

Cada lib ganha um `package.json` (`"name": "@erp/..."`), um build próprio e entra no
`pnpm-workspace.yaml`; o pnpm faz o link em `node_modules` e o Node resolve nativamente.

- (+) É o caminho mais padrão, o que o Nx chama de *TS solution setup*.
- (+) Fronteira real também em runtime, não só no lint.
- (−) Custo por lib, repetido a cada módulo novo: `package.json`, `exports`, tsconfig de build,
  `dependsOn: ["^build"]`. São 16 libs hoje e o backlog cria mais.
- (−) Resolução dupla: os testes e o editor leem o **fonte** (via `paths`), o runtime lê o **dist**
  (via `node_modules`). Divergência entre as duas é uma classe de bug difícil de enxergar.
- (−) Dev loop mais lento: mexer numa lib exige rebuild dela antes de o app ver a mudança.

Descartada pelo custo recorrente: este repositório é construído item a item por um agente, e
configuração que precisa ser repetida corretamente a cada módulo novo é onde a erosão começa.

### B — Bundler nos apps (webpack/rspack com swc-loader)

Empacotar cada app num `main.js`, resolvendo os aliases em tempo de build, com `node_modules`
como externo.

- (+) Um artefato só, sem caminhos profundos.
- (−) Traz um toolchain inteiro (webpack + loader SWC) para resolver um problema de caminho.
- (−) O NestJS usa `require` dinâmico para dependências opcionais; bundlers reclamam
  (*critical dependency*) e a configuração de externals vira manutenção.
- (−) Diagnóstico pior: stack trace e profiler passam a depender de sourcemap.

Descartada por trazer peso e modos de falha desproporcionais ao problema.

### C — `tsc` + reescrita dos aliases no output (escolhida)

Ver acima. O `tsc-alias` é uma dependência pequena, de propósito único e ativamente mantida, que
roda **em tempo de build** — se um dia sumir, a saída do `tsc` continua válida e a reescrita cabe
em poucas dezenas de linhas próprias.

### D — Resolver os aliases em runtime

`tsconfig-paths/register`, ou `imports` do `package.json` (`#erp/...`), resolvendo na hora da
execução.

- (−) Não resolve o TS6059: ainda seria preciso mexer no `rootDir`.
- (−) Acrescenta um gancho de runtime em produção, que confunde depurador e profiler.

Descartada.

## Consequências

- (+) Uma fonte de verdade para os aliases, do editor ao runtime.
- (+) Nenhuma configuração nova por lib: criar um módulo continua sendo criar `project.json`,
  `tsconfig.json` e `vitest.config.mts`.
- (+) Saída em JavaScript legível, com os arquivos preservados — stack trace aponta para arquivo real.
- (−) Ponto de entrada profundo (`dist/api/apps/api/src/main.js`), documentado no README.
- (−) O build de cada app recompila as libs que usa, em vez de reaproveitar um artefato por lib.
  Aceitável na escala deste projeto; se o build ficar lento, a opção A continua disponível.
- (−) Uma dependência de build a mais (`tsc-alias`).

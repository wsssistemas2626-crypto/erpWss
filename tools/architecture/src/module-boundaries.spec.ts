import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Teste de arquitetura das fronteiras entre módulos (F0-02, ADR-002, CLAUDE.md §4.2).
 *
 * Escreve arquivos temporários dentro de libs reais e roda o ESLint sobre eles.
 * Os fixtures ficam em `__arch_fixtures__`, diretório ignorado pelo lint normal,
 * por isso aqui o ESLint é chamado com `--no-ignore`.
 */

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..');
const ESLINT_BIN = join(WORKSPACE_ROOT, 'node_modules', '.bin', 'eslint');
const FIXTURE_DIR_NAME = '__arch_fixtures__';

const BOUNDARIES_RULE = '@nx/enforce-module-boundaries';
const RESTRICTED_DISABLE_RULE = '@eslint-community/eslint-comments/no-restricted-disable';

const PROJECTS_MODULE = 'libs/modules/projects';
const PROJECTS_API = 'libs/modules/projects-api';
const WEB_SHELL = 'libs/web/shell';
const WEB_PROJECTS = 'libs/web/projects';

interface EslintMessage {
  readonly ruleId: string | null;
  readonly message: string;
}

interface EslintResult {
  readonly filePath: string;
  readonly messages: readonly EslintMessage[];
}

const createdFixtureDirs = new Set<string>();

function lint(libDir: string, fileName: string, source: string): readonly (string | null)[] {
  const fixtureDir = join(WORKSPACE_ROOT, libDir, 'src', FIXTURE_DIR_NAME);
  mkdirSync(fixtureDir, { recursive: true });
  createdFixtureDirs.add(fixtureDir);

  const file = join(fixtureDir, fileName);
  writeFileSync(file, source);

  let stdout: string;
  try {
    stdout = execFileSync(ESLINT_BIN, ['--no-ignore', '--format', 'json', file], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
    });
  } catch (error) {
    // O ESLint sai com código 1 quando encontra erros: a saída JSON é o que interessa.
    stdout = (error as { stdout?: string }).stdout ?? '';
  }

  const results = JSON.parse(stdout) as readonly EslintResult[];
  return results.flatMap((result) => result.messages).map((message) => message.ruleId);
}

afterAll(() => {
  for (const dir of createdFixtureDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('F0-02 fronteiras entre módulos de negócio', () => {
  it('recusa a importação da implementação de outro módulo', () => {
    const rules = lint(
      PROJECTS_MODULE,
      'implementacao-de-outro-modulo.ts',
      "import '@erp/partners';\n",
    );

    expect(rules).toContain(BOUNDARIES_RULE);
  });

  it('aceita a importação do contrato público de outro módulo', () => {
    const rules = lint(
      PROJECTS_MODULE,
      'contrato-de-outro-modulo.ts',
      "import '@erp/partners-api';\n",
    );

    expect(rules).not.toContain(BOUNDARIES_RULE);
  });

  it('aceita a importação de libs de plataforma e de shared', () => {
    const rules = lint(
      PROJECTS_MODULE,
      'plataforma-e-shared.ts',
      "import '@erp/platform-tenancy';\nimport '@erp/shared-kernel';\n",
    );

    expect(rules).not.toContain(BOUNDARIES_RULE);
  });

  it('recusa que um contrato público dependa da plataforma', () => {
    const rules = lint(PROJECTS_API, 'contrato-para-plataforma.ts', "import '@erp/platform-db';\n");

    expect(rules).toContain(BOUNDARIES_RULE);
  });

  it('aceita que um contrato público dependa de shared', () => {
    const rules = lint(
      PROJECTS_API,
      'contrato-para-shared.ts',
      "import '@erp/shared-contracts';\n",
    );

    expect(rules).not.toContain(BOUNDARIES_RULE);
  });
});

describe('F0-02 fronteiras do front', () => {
  it('recusa que uma lib web alcance o backend', () => {
    const rules = lint(WEB_PROJECTS, 'web-para-plataforma.ts', "import '@erp/platform-db';\n");

    expect(rules).toContain(BOUNDARIES_RULE);
  });

  it('aceita que uma lib web use o shell e os contratos compartilhados', () => {
    const rules = lint(
      WEB_PROJECTS,
      'web-para-shell.ts',
      "import '@erp/web-shell';\nimport '@erp/shared-contracts';\n",
    );

    expect(rules).not.toContain(BOUNDARIES_RULE);
  });

  it('recusa que o shell dependa de uma lib web de um módulo', () => {
    const rules = lint(WEB_SHELL, 'shell-para-modulo.ts', "import '@erp/web-projects';\n");

    expect(rules).toContain(BOUNDARIES_RULE);
  });
});

describe('F0-02 a regra de fronteiras não pode ser silenciada', () => {
  it('recusa eslint-disable da regra de fronteiras', () => {
    const rules = lint(
      PROJECTS_MODULE,
      'disable.ts',
      `/* eslint-disable ${BOUNDARIES_RULE} */\nimport '@erp/partners';\n`,
    );

    expect(rules).toContain(RESTRICTED_DISABLE_RULE);
  });

  it('recusa eslint-disable-next-line da regra de fronteiras', () => {
    const rules = lint(
      PROJECTS_MODULE,
      'disable-next-line.ts',
      `// eslint-disable-next-line ${BOUNDARIES_RULE}\nimport '@erp/partners';\n`,
    );

    expect(rules).toContain(RESTRICTED_DISABLE_RULE);
  });

  it('recusa eslint-disable sem nome de regra, que desligaria as fronteiras junto', () => {
    const rules = lint(
      PROJECTS_MODULE,
      'disable-total.ts',
      "/* eslint-disable */\nimport '@erp/partners';\n",
    );

    expect(rules).toContain('@eslint-community/eslint-comments/no-unlimited-disable');
  });
});

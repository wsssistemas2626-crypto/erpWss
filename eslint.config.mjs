import comments from '@eslint-community/eslint-plugin-eslint-comments';
import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Fronteiras entre módulos (ADR-002 e CLAUDE.md §4.2).
 * Cada entrada é aplicada de forma cumulativa: um projeto precisa satisfazer
 * TODAS as restrições cujo `sourceTag`/`allSourceTags` casem com as suas tags.
 */
const depConstraints = [
  // Os apps compõem o sistema: podem depender de qualquer lib.
  { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['*'] },

  // Um módulo só enxerga contratos (`-api`) de outros módulos, a plataforma e o shared.
  {
    sourceTag: 'type:module',
    onlyDependOnLibsWithTags: ['type:module-api', 'type:platform', 'type:shared'],
  },

  // O contrato público de um módulo não pode arrastar plataforma nem implementação.
  { sourceTag: 'type:module-api', onlyDependOnLibsWithTags: ['type:shared'] },

  // A plataforma não conhece módulos de negócio.
  { sourceTag: 'type:platform', onlyDependOnLibsWithTags: ['type:platform', 'type:shared'] },

  // O shared é a base de todos e não depende de ninguém acima dele.
  { sourceTag: 'type:shared', onlyDependOnLibsWithTags: ['type:shared'] },

  // O front não alcança o backend: só outras libs web e o shared.
  { sourceTag: 'type:web', onlyDependOnLibsWithTags: ['type:web', 'type:shared'] },
  // ...e, dentro do front, só o próprio escopo ou o escopo compartilhado.
  {
    allSourceTags: ['type:web', 'scope:shared'],
    onlyDependOnLibsWithTags: ['scope:shared'],
  },
  {
    allSourceTags: ['type:web', 'scope:projects'],
    onlyDependOnLibsWithTags: ['scope:shared', 'scope:projects'],
  },

  // Ferramentas de build/teste não dependem de lib nenhuma.
  { sourceTag: 'type:tool', onlyDependOnLibsWithTags: [] },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.nx/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.d.ts',
      // Arquivos gerados pelo teste de arquitetura (tools/architecture).
      // Ele os inspeciona com `eslint --no-ignore`; o lint normal os ignora.
      '**/__arch_fixtures__/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    plugins: {
      '@nx': nx,
      '@eslint-community/eslint-comments': comments,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'smart'],
      'no-console': ['error', { allow: ['warn', 'error'] }],

      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints,
        },
      ],

      // CLAUDE.md §4.2: as fronteiras não podem ser silenciadas com eslint-disable.
      '@eslint-community/eslint-comments/no-restricted-disable': [
        'error',
        '@nx/enforce-module-boundaries',
      ],
      // Um `eslint-disable` sem nome de regra desligaria as fronteiras junto.
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },
  {
    files: ['**/*.spec.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
);

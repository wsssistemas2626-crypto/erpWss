import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Impactos que o axe-core considera graves o bastante para barrar a entrega. */
const SERIOUS = new Set(['serious', 'critical']);

/**
 * Rodapé do cartão do Clerk. Numa instância de **desenvolvimento** — a única que o E2E
 * pode usar (ADR-004) — ele traz o selo laranja "Secured by Clerk", cujo texto reprova
 * no contraste (3.04:1) e cujas classes são geradas (`cl-internal-<hash>`): não é markup
 * nosso, não dá para corrigir por `appearance` de forma estável e não existe na
 * instância de produção. Deixá-lo no escopo transformaria a suíte num alarme que
 * dispara a cada release do fornecedor.
 */
const VENDOR_BRANDING = '.cl-footer';

/**
 * Falha se a página tiver violação de acessibilidade grave (RNF de usabilidade).
 *
 * Só `serious` e `critical` reprovam: `minor` e `moderate` viram ruído de suíte e
 * acabam sendo ignorados, que é o pior dos mundos. A mensagem traz a regra, o seletor
 * do nó e o resumo do axe, para não obrigar ninguém a abrir o relatório para saber o
 * que quebrou.
 */
export async function expectNoSeriousAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).exclude(VENDOR_BRANDING).analyze();
  const serious = results.violations.filter((violation) =>
    SERIOUS.has(String(violation.impact ?? '')),
  );

  expect(
    serious.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        target: node.target.join(' '),
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}

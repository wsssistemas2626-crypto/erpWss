import { expectNoSeriousAccessibilityViolations } from './support/accessibility';
import { expect, test } from './support/fixtures';

/**
 * F0-14 — Infraestrutura E2E.
 *
 * O caminho feliz de ponta a ponta: Clerk de desenvolvimento, API, worker, front e
 * Postgres reais. É o único teste do repositório que toca a rede.
 */
test.describe('F0-14 Infraestrutura E2E', () => {
  test('entra no sistema e vê o nome da organização no cabeçalho', async ({ page, signIn }) => {
    await signIn();

    await page.goto('/');

    const header = page.getByRole('banner');
    await expect(header).toBeVisible();

    // O seletor de organização é do Clerk e mostra a organização ativa da sessão; o nome
    // ao lado dele vem de `GET /api/v1/me`, ou seja, do tenant local resolvido pelo
    // `o.id` do token (ADR-004). Exigir que os dois coincidam é o que prova que a
    // sessão do Clerk e o tenant do backend são a mesma organização.
    const switcher = header.locator('.cl-organizationSwitcherTrigger');
    await expect(switcher).toBeVisible();

    const organizationName = (await switcher.innerText()).split('\n')[0]?.trim() ?? '';
    expect(organizationName).not.toBe('');
    await expect(header).toContainText(organizationName);

    // O layout principal só existe depois que `me` respondeu e há organização ativa.
    await expect(page.getByRole('main')).toBeVisible();

    await expectNoSeriousAccessibilityViolations(page);
  });

  test('redireciona para /entrar quem acessa sem sessão', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/entrar/);
    await expectNoSeriousAccessibilityViolations(page);
  });
});

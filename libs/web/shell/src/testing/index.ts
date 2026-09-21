/**
 * Utilitários de teste do front. Entrada separada de `@erp/web-shell` para que nada
 * daqui entre no bundle da aplicação.
 */
export { createStubApiClient, meFixture } from './stub-api';
export { renderWithShell, type RenderWithShellOptions } from './render-with-shell';

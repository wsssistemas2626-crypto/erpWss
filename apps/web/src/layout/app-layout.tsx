import { AppShell } from '@erp/web-shell';
import { MENU_ITEMS } from './menu-items';

/** Rota-pai das telas autenticadas: o layout do shell com o menu deste app. */
export function AppLayout() {
  return <AppShell items={MENU_ITEMS} />;
}

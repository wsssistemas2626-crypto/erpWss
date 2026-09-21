import type { MenuItem } from '@erp/web-shell';
import { FolderKanban, House, ScrollText, ShieldCheck } from 'lucide-react';

/**
 * Menu lateral do ERP (F0-13).
 *
 * Composição, não regra: cada item declara o módulo dono e as permissões que exige, e o
 * `AppShell` esconde o que o usuário não pode ver. Um item cujo módulo ainda não existe
 * no backend simplesmente não aparece — é assim que "Projetos" acende na Fase 1.
 */
export const MENU_ITEMS: readonly MenuItem[] = [
  { labelKey: 'home', to: '/', module: 'platform', icon: House },
  {
    labelKey: 'projects',
    to: '/projetos',
    module: 'projects',
    anyOfPermissions: ['projects.project.read'],
    icon: FolderKanban,
  },
  {
    labelKey: 'roles',
    to: '/papeis',
    module: 'platform',
    anyOfPermissions: ['platform.role.read'],
    icon: ShieldCheck,
  },
  {
    labelKey: 'audit',
    to: '/auditoria',
    module: 'platform',
    anyOfPermissions: ['platform.audit.read'],
    icon: ScrollText,
  },
];

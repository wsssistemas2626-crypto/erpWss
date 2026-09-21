import type { PermissionDefinition } from './permission-catalog';

/**
 * Permissões da própria plataforma. Administrar papéis é administração: nenhum papel do
 * sistema além de `Administrador` nasce com elas.
 */
export const PLATFORM_PERMISSIONS: readonly PermissionDefinition[] = [
  { key: 'platform.role.read', description: 'Ver papéis e suas permissões' },
  { key: 'platform.role.create', description: 'Criar papéis' },
  { key: 'platform.role.update', description: 'Alterar papéis e suas permissões' },
  { key: 'platform.role.delete', description: 'Excluir papéis' },
  { key: 'platform.membership.read', description: 'Ver membros e seus papéis' },
  { key: 'platform.membership.assign-role', description: 'Atribuir papéis a membros' },
];

export const PLATFORM_MODULE = 'platform';

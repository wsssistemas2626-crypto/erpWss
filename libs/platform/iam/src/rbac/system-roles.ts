/**
 * Papéis semeados em todo tenant novo (docs/dominio/platform.md).
 * `is_system`: não podem ser excluídos nem renomeados; as permissões, sim, são ajustáveis.
 */
export const ADMINISTRATOR_ROLE = 'Administrador';

export interface SystemRoleDefinition {
  readonly name: string;
  readonly description: string;
}

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  { name: ADMINISTRATOR_ROLE, description: 'Acesso total ao tenant.' },
  { name: 'Gestor de Portfólio', description: 'Acompanha portfólios, programas e projetos.' },
  { name: 'Gerente de Projetos', description: 'Conduz os projetos sob sua responsabilidade.' },
  { name: 'Membro de Equipe', description: 'Trabalha nos itens e aponta horas.' },
  { name: 'Financeiro', description: 'Cuida de custos, títulos e faturamento.' },
  { name: 'Leitor', description: 'Somente leitura.' },
];

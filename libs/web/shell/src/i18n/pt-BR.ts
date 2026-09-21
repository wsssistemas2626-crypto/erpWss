/**
 * Textos de interface em pt-BR (CLAUDE.md §5: nunca string solta no componente).
 *
 * Um arquivo só enquanto o front cabe no shell; quando um módulo tiver tela própria,
 * cada lib `libs/web/<mod>` traz o seu namespace e este vira o `common`.
 */
export const ptBRTranslations = {
  appName: 'ERP',
  shellPlaceholder: 'Shell do ERP em construção.',

  auth: {
    loading: 'Carregando sua sessão...',
    signInTitle: 'Entrar no ERP',
    signUpTitle: 'Criar conta no ERP',
    signOut: 'Sair',
  },

  organization: {
    selectTitle: 'Selecione uma organização',
    selectDescription:
      'Sua conta não tem uma organização ativa. Escolha uma para continuar ou peça um convite ao administrador.',
    switcherLabel: 'Organização ativa',
  },

  errors: {
    unauthenticatedTitle: 'Sessão expirada',
    unauthenticatedDescription: 'Entre novamente para continuar.',
    forbiddenTitle: 'Acesso negado',
    forbiddenDescription: 'Você não tem permissão para acessar esta página.',
    notFoundTitle: 'Página não encontrada',
    notFoundDescription: 'O endereço acessado não existe ou foi removido.',
    backToStart: 'Voltar ao início',
    loadFailedTitle: 'Não foi possível carregar seus dados',
    loadFailedDescription: 'Tente novamente em alguns instantes.',
    retry: 'Tentar de novo',
  },

  menu: {
    label: 'Menu principal',
    home: 'Início',
    projects: 'Projetos',
    roles: 'Papéis e permissões',
    audit: 'Auditoria',
  },

  layout: {
    mainLabel: 'Conteúdo principal',
    skipToContent: 'Pular para o conteúdo',
  },

  table: {
    caption: 'Tabela de resultados',
    empty: 'Nenhum resultado encontrado.',
    previous: 'Página anterior',
    next: 'Próxima página',
    summary: '{{first}}–{{last}} de {{total}}',
    loading: 'Carregando...',
  },

  form: {
    save: 'Salvar',
    cancel: 'Cancelar',
    saving: 'Salvando...',
    requiredMark: 'obrigatório',
  },

  confirm: {
    title: 'Confirmar ação',
    description: 'Esta ação não pode ser desfeita.',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    close: 'Fechar',
  },

  empty: {
    title: 'Nada por aqui ainda',
    description: 'Quando houver registros, eles aparecem nesta lista.',
  },
} as const;

export type AppTranslations = typeof ptBRTranslations;

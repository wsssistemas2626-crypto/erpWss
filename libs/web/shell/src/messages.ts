/**
 * Textos de interface em pt-BR do shell do front (CLAUDE.md §5: nunca string solta
 * no componente). O item F0-13 troca este módulo pelo react-i18next e move os textos
 * para os arquivos de tradução, mantendo as mesmas chaves.
 */
export const messages = {
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
  },
} as const;

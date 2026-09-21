-- Sincronização com o provedor de identidade atravessa tenants (F0-11, ADR-004).
--
-- `user.deleted` precisa descobrir em quais tenants o usuário tem vínculo, e
-- `organizationMembership.deleted` a qual tenant o vínculo pertence — as duas coisas antes
-- de haver tenant no contexto. É a mesma exceção que o ADR-001 concede ao publicador do
-- outbox: uma política adicional para `app_platform`, restrita a esta tabela, em vez de
-- `BYPASSRLS`, que valeria para o banco inteiro.
--
-- Só leitura: a escrita continua passando por `app_user`, dentro da transação do tenant
-- que a RLS exige.
CREATE POLICY memberships_platform_read ON platform.memberships
  FOR SELECT TO app_platform
  USING (true);

GRANT SELECT ON platform.memberships TO app_platform;

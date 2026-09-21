-- Helper de migration do ADR-001: aplica a RLS padrão numa tabela de negócio.
--
-- Uso, na migration do módulo dono da tabela:
--   SELECT platform.enable_tenant_rls('projects.work_items');
--
-- Padroniza a política em um lugar só: nenhum módulo escreve a condição à mão e
-- nenhum módulo esquece o FORCE (sem ele, a dona da tabela escaparia da RLS).
-- Sem `app.tenant_id` no contexto, `current_setting` levanta erro e nada é lido:
-- é a falha segura que o ADR-001 exige.
CREATE OR REPLACE FUNCTION platform.enable_tenant_rls(target regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  policy_name constant text := 'tenant_isolation';
  condition   constant text := '(tenant_id = current_setting(''app.tenant_id'')::uuid)';
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', policy_name, target);
  EXECUTE format(
    'CREATE POLICY %I ON %s USING %s WITH CHECK %s',
    policy_name, target, condition, condition
  );
END;
$$;

REVOKE ALL ON FUNCTION platform.enable_tenant_rls(regclass) FROM PUBLIC;

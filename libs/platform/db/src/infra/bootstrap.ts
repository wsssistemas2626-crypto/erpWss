import { Client } from 'pg';
import { DB_ROLES } from '../roles';

/**
 * Migração inicial do cluster: cria as três roles do ADR-001 e entrega o banco à `app_owner`.
 *
 * É o único passo que precisa de uma conexão administrativa (`DATABASE_URL_ADMIN`): não dá para
 * criar a role dona do banco conectando como ela mesma. Depois daqui, todas as migrations rodam
 * como `app_owner` e a aplicação roda como `app_user`.
 *
 * Idempotente: pode rodar em um banco novo ou em um já migrado.
 */
export interface RolePasswords {
  readonly owner: string;
  readonly app: string;
  readonly platform: string;
}

export async function bootstrapRoles(adminUrl: string, passwords: RolePasswords): Promise<void> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const databaseName = await currentDatabase(client);

    await createLoginRole(client, DB_ROLES.owner, passwords.owner);
    await createLoginRole(client, DB_ROLES.app, passwords.app);
    await createLoginRole(client, DB_ROLES.platform, passwords.platform);

    // A dona do banco é quem pode criar os schemas dos módulos.
    await client.query(
      `ALTER DATABASE ${client.escapeIdentifier(databaseName)} OWNER TO ${client.escapeIdentifier(DB_ROLES.owner)}`,
    );

    await client.query(
      `GRANT CONNECT ON DATABASE ${client.escapeIdentifier(databaseName)} TO ${client.escapeIdentifier(DB_ROLES.app)}, ${client.escapeIdentifier(DB_ROLES.platform)}`,
    );

    // Ninguém cria objetos no schema `public`: cada módulo é dono do seu schema.
    await client.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    await client.query(`ALTER SCHEMA public OWNER TO ${client.escapeIdentifier(DB_ROLES.owner)}`);
  } finally {
    await client.end();
  }
}

async function currentDatabase(client: Client): Promise<string> {
  const result = await client.query<{ current_database: string }>('select current_database()');
  const name = result.rows[0]?.current_database;
  if (!name) {
    throw new Error('Não foi possível determinar o banco atual na conexão administrativa.');
  }
  return name;
}

async function createLoginRole(client: Client, name: string, password: string): Promise<void> {
  if (password.length === 0) {
    throw new Error(`A senha da role ${name} está vazia: confira as variáveis DATABASE_URL_*.`);
  }

  const exists = await client.query('select 1 from pg_roles where rolname = $1', [name]);
  const identifier = client.escapeIdentifier(name);
  const literal = client.escapeLiteral(password);

  // NOBYPASSRLS é o ponto central do ADR-001: nenhuma role da aplicação ignora a RLS.
  const attributes = 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT';

  if (exists.rowCount === 0) {
    await client.query(`CREATE ROLE ${identifier} ${attributes} PASSWORD ${literal}`);
    return;
  }

  await client.query(`ALTER ROLE ${identifier} ${attributes} PASSWORD ${literal}`);
}

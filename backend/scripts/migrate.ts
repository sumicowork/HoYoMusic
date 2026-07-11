/**
 * Lightweight SQL migration runner for HoYoMusic backend.
 *
 * - Reads connection settings from the same env vars as src/config/database.ts
 *   (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD), or a single DATABASE_URL.
 * - Maintains a `_migrations` table (name, applied_at).
 * - Applies any *.sql file under backend/db/migrations/ that has not yet been
 *   applied, in filename order, each wrapped in its own transaction.
 *
 * Run with: npm run migrate
 */
import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');
const MIGRATIONS_TABLE = '_migrations';

interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
}

function getConnectionConfig(): ConnectionConfig {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'hoyomusic',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  };
}

/** Split a migration file into individual statements, ignoring comments/empties. */
function splitStatements(sql: string): string[] {
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`
  );
}

async function getApplied(client: Client): Promise<Set<string>> {
  const res = await client.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE}`
  );
  return new Set(res.rows.map((r) => r.name));
}

async function applyMigration(client: Client, file: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = await fs.readFile(filePath, 'utf-8');
  const statements = splitStatements(sql);

  await client.query('BEGIN');
  try {
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
      [file]
    );
    await client.query('COMMIT');
    console.log(`✅ Applied ${file} (${statements.length} statements)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed ${file}, rolled back:`, err);
    throw err;
  }
}

async function main(): Promise<void> {
  const client = new Client(getConnectionConfig());
  await client.connect();
  console.log('🔌 Connected to database for migrations.');

  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(
        `✅ Database up to date (${applied.size} migration(s) applied).`
      );
      return;
    }

    console.log(`📦 ${pending.length} pending migration(s) to apply.`);
    for (const file of pending) {
      await applyMigration(client, file);
    }
    console.log('🎉 All migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration run failed:', err);
  process.exit(1);
});

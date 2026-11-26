import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

// Arbitrary constant: serialises migration runs across replicas that start at the same time.
const LOCK_KEY = 820_820_001;

/**
 * Applies migrations/*.sql in file-name order, once each, recorded in auth_schema_migrations.
 * The files are idempotent (IF NOT EXISTS), so a database that was built by TypeORM synchronize
 * or by hand is brought up to date without errors. Each file manages its own transaction.
 */
export async function runMigrations(
  dir = process.env.AUTH_MIGRATIONS_DIR ?? join(__dirname, '..', 'migrations'),
  log: (message: string) => void = console.log,
): Promise<string[]> {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  // Same connection settings as TypeORM in app.module.ts; one connection so the advisory lock holds.
  const db = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'sarvaikam',
    username: process.env.DB_USER ?? 'sarvaikam',
    password: process.env.DB_PASSWORD ?? 'sarvaikam',
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
      : false,
    extra: { max: 1 },
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  const applied: string[] = [];
  try {
    await runner.connect();
    await runner.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await runner.query(`CREATE TABLE IF NOT EXISTS auth_schema_migrations (
      name varchar PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const rows: { name: string }[] = await runner.query('SELECT name FROM auth_schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      // No parameters: the simple query protocol allows several statements (and BEGIN/COMMIT) per file.
      await runner.query(readFileSync(join(dir, file), 'utf8'));
      await runner.query('INSERT INTO auth_schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      applied.push(file);
      log(`auth-service: applied migration ${file}`);
    }
  } finally {
    await runner.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    await runner.release();
    await db.destroy();
  }
  return applied;
}

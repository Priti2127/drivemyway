#!/usr/bin/env node
/**
 * Database migration runner
 *
 * Reads SQL files from ./migrations in order and applies them.
 * Tracks applied migrations in a `schema_migrations` table to avoid re-running.
 *
 * Usage:
 *   node scripts/db/migrate.js            — run pending migrations
 *   node scripts/db/migrate.js --dry-run  — list pending without applying
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(rows.map(r => r.filename));
}

async function run() {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    // Read and sort migration files
    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter(f => f.endsWith('.sql'))
      .sort();

    const pending = allFiles.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('✅  All migrations already applied. Nothing to do.');
      return;
    }

    console.log(`📋  Found ${pending.length} pending migration(s):`);
    pending.forEach(f => console.log(`     - ${f}`));

    if (DRY_RUN) {
      console.log('\n🔍  Dry-run mode — no changes applied.');
      return;
    }

    for (const filename of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf-8');
      console.log(`\n⏳  Applying: ${filename}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename],
        );
        await client.query('COMMIT');
        console.log(`✅  Applied:  ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌  Failed:   ${filename}`);
        console.error(err.message);
        process.exit(1);
      }
    }

    console.log('\n🎉  All migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration runner fatal error:', err);
  process.exit(1);
});

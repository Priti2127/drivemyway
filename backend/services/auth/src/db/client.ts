import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,                  // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log unexpected pool errors (e.g., connection drops)
db.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

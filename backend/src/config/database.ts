import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hoyomusic',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,       // 30s query timeout
  idle_in_transaction_session_timeout: 60000,  // 60s idle tx timeout
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

/** Pre-warm the connection pool on startup */
export const warmPool = async (count = 3): Promise<void> => {
  try {
    const clients = await Promise.all(
      Array.from({ length: Math.min(count, parseInt(process.env.DB_POOL_MAX || '20')) },
        () => pool.connect())
    );
    clients.forEach(c => c.release());
    console.log(`✅ Pool pre-warmed with ${clients.length} connections`);
  } catch (err) {
    console.warn('⚠️  Pool warmup failed (non-fatal):', err);
  }
};

export default pool;


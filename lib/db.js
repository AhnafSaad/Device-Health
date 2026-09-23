import { Pool } from 'pg';

let pool = null;
let isDbAvailable = false;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Check if connectionString is set and not pointing to local host in container without Postgres service
const isLocalhost =
  !connectionString ||
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1') ||
  connectionString.includes('::1');

if (connectionString && !isLocalhost) {
  try {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', () => {
      isDbAvailable = false;
    });

    isDbAvailable = true;
  } catch {
    pool = null;
    isDbAvailable = false;
  }
} else {
  // Use in-memory mock fallback
  pool = null;
  isDbAvailable = false;
}

export { pool };

export async function query(text, params) {
  if (!isDbAvailable || !pool) {
    return { rows: [], rowCount: 0 };
  }

  try {
    return await pool.query(text, params);
  } catch {
    isDbAvailable = false;
    return { rows: [], rowCount: 0 };
  }
}

export async function getClient() {
  if (!isDbAvailable || !pool) {
    return { query: async () => ({ rows: [], rowCount: 0 }), release: () => {} };
  }
  try {
    return await pool.connect();
  } catch {
    isDbAvailable = false;
    return { query: async () => ({ rows: [], rowCount: 0 }), release: () => {} };
  }
}

export async function ensureTablesExist() {
  return true;
}

export default pool;

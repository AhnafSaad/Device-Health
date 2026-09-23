import { Pool } from 'pg';

/**
 * Local PostgreSQL Connection Pool for bare-metal Ubuntu NOC stack.
 * Default connection string: postgresql://user:password@localhost:5432/noc_db
 */
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://user:password@localhost:5432/noc_db';

// Preserve pool instance across Node/Next.js hot reloads
let pool;

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString,
    max: 20, // Support concurrent telemetry ingest & API queries
    idleTimeoutMillis: 30000, // Drop idle connections after 30s
    connectionTimeoutMillis: 5000, // Return fast if Postgres is offline
    ssl: false, // Pure local bare-metal connection
  });

  // Guard against unhandled errors on idle clients
  global._pgPool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL pool client:', err.message);
  });
}

pool = global._pgPool;

/**
 * Execute a parameterized query against local PostgreSQL.
 * @param {string} text - SQL query string
 * @param {any[]} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_SQL) {
      console.log('PostgreSQL Query executed:', { text: text.trim().substring(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('PostgreSQL query execution failed:', { text, error: error.message });
    throw error;
  }
}

/**
 * Acquire a dedicated connection client from pool (useful for transactions).
 * @returns {Promise<import('pg').PoolClient>}
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Auto-creates the required tables if they don't exist.
 */
export async function ensureTablesExist() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS servers_info (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) UNIQUE NOT NULL,
      hostname VARCHAR(255) NOT NULL,
      device_type VARCHAR(50) NOT NULL DEFAULT 'Server',
      snmp_community VARCHAR(100) DEFAULT 'public',
      location VARCHAR(255),
      rack_number VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS telemetry_data (
      id BIGSERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      cpu_usage NUMERIC(5,2) DEFAULT 0,
      ram_usage NUMERIC(5,2) DEFAULT 0,
      disk_usage NUMERIC(5,2) DEFAULT 0,
      uptime VARCHAR(100) DEFAULT '0d 0h',
      status VARCHAR(20) DEFAULT 'online',
      health VARCHAR(50) DEFAULT 'Normal',
      load_average VARCHAR(50) DEFAULT '0.00, 0.00, 0.00',
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_ip_recorded 
    ON telemetry_data (ip_address, recorded_at DESC);
  `;

  try {
    await query(schemaSql);
  } catch (err) {
    console.warn('[DB] Could not verify/initialize schema tables:', err.message);
  }
}

export default pool;

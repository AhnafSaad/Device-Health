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
  if (!isDbAvailable || !pool) {
    return false;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS datacenters (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        location VARCHAR(150) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS servers_info (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL UNIQUE,
        hostname VARCHAR(150) NOT NULL,
        device_type VARCHAR(50) NOT NULL DEFAULT 'Server',
        datacenter_id INTEGER REFERENCES datacenters(id) ON DELETE SET NULL,
        snmp_community VARCHAR(100) NOT NULL DEFAULT 'public',
        location VARCHAR(150) DEFAULT 'Local Datacenter',
        rack_number VARCHAR(50) DEFAULT 'Unassigned',
        brand VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE servers_info 
      ADD COLUMN IF NOT EXISTS snmp_community VARCHAR(100) NOT NULL DEFAULT 'public';

      ALTER TABLE servers_info 
      ADD COLUMN IF NOT EXISTS datacenter_id INTEGER REFERENCES datacenters(id) ON DELETE SET NULL;

      ALTER TABLE servers_info 
      ADD COLUMN IF NOT EXISTS brand VARCHAR(50);
    `);
    return true;
  } catch (err) {
    console.warn('[db.js] Schema check warning:', err?.message);
    return false;
  }
}

export default pool;

import { Pool } from 'pg';

let pool = null;
let isDbAvailable = false;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (connectionString) {
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

      CREATE TABLE IF NOT EXISTS telemetry_data (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        cpu_usage NUMERIC(5, 2) DEFAULT 0,
        ram_usage NUMERIC(5, 2) DEFAULT 0,
        disk_usage NUMERIC(5, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'online',
        health VARCHAR(50) DEFAULT 'Normal',
        uptime VARCHAR(100) DEFAULT '0d 0h',
        load_average VARCHAR(100) DEFAULT '0.00, 0.00, 0.00',
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_telemetry_ip ON telemetry_data(ip_address);
      CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at_desc ON telemetry_data(recorded_at DESC);

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // On first startup, if there's no row with key = 'snmp_poll_cron', insert one with value from process.env.SNMP_POLL_CRON or fallback
    const defaultCron = process.env.SNMP_POLL_CRON || '*/1 * * * *';
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('snmp_poll_cron', $1) ON CONFLICT (key) DO NOTHING;`,
      [defaultCron]
    );

    return true;
  } catch (err) {
    console.warn('[db.js] Schema check warning:', err?.message);
    return false;
  }
}

// In-memory fallback cache for runtime system settings
const memorySettings = new Map([
  ['snmp_poll_cron', process.env.SNMP_POLL_CRON || '*/1 * * * *']
]);

/**
 * Retrieve a system setting by key (from PostgreSQL settings table with in-memory fallback).
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getSetting(key) {
  if (isDbAvailable && pool) {
    try {
      const res = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1;', [key]);
      if (res && res.rows && res.rows.length > 0) {
        const val = res.rows[0].value;
        memorySettings.set(key, val);
        return val;
      }
    } catch (err) {
      console.warn('[db.js] getSetting query warning:', err?.message);
    }
  }
  return memorySettings.get(key) || null;
}

/**
 * Persist a system setting by key (in PostgreSQL settings table with in-memory fallback).
 * @param {string} key
 * @param {string} value
 * @returns {Promise<boolean>}
 */
export async function setSetting(key, value) {
  memorySettings.set(key, value);
  if (isDbAvailable && pool) {
    try {
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
        [key, value]
      );
      return true;
    } catch (err) {
      console.warn('[db.js] setSetting query warning:', err?.message);
      return false;
    }
  }
  return true;
}

export default pool;

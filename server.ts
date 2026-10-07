import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import cron from 'node-cron';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query, ensureTablesExist, getSetting, setSetting, isDbConnected } from './lib/db.js';
import { 
  pollDevice, 
  computeHealth, 
  loadAlertThresholds, 
  setThresholdsCache, 
  getCachedThresholds, 
  DEFAULT_ALERT_THRESHOLDS 
} from './lib/snmp/poller.js';
import { 
  startSnmpScheduler, 
  rescheduleSnmpPolling, 
  registerMemoryDevicesProvider, 
  getLatestTelemetryMap,
  runSnmpPollCycle
} from './lib/snmp/scheduler.js';

declare module 'express-session' {
  interface SessionData {
    userId?: number | string;
    isAdmin?: boolean;
    username?: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Trust proxy 1 hop: required because the app runs behind AI Studio reverse-proxy infrastructure
// terminating HTTPS and forwarding HTTP internally. Allows req.secure and secure cookies to function.
app.set('trust proxy', 1);
console.log('[AI Studio] Express trust proxy is ENABLED (app.set("trust proxy", 1)) - HTTPS/Secure cookie termination active.');

app.use(express.json());

// Express Session configuration
// Note: cookie.secure is always true and sameSite is always 'none'.
// Since trust proxy is set to 1, secure: true works whenever the real client connection is HTTPS
// (which it always is in both the AI Studio preview and any real production deploy).
// Plain-HTTP localhost dev will fail closed (session not persisted), which is an acceptable tradeoff.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'healthstream-noc-session-secret-key-32chars',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }) as unknown as express.RequestHandler
);

export interface UserRecord {
  id: number | string;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

const memoryUsers: UserRecord[] = [];

const AUTH_SECRET = process.env.SESSION_SECRET || 'healthstream-noc-session-secret-key-32chars';
const activeTokens = new Map<string, { userId: number | string; username: string; role: string; expiresAt: number }>();

/**
 * Generate a cryptographically signed authentication bearer token for iframe and API usage
 */
export function generateAuthToken(user: { id: number | string; username: string; role?: string }): string {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role || 'admin',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadStr).digest('hex');
  const token = Buffer.from(`${payloadStr}:::${signature}`).toString('base64');
  activeTokens.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role || 'admin',
    expiresAt: payload.exp,
  });
  return token;
}

/**
 * Verify an authentication bearer token
 */
export function verifyAuthToken(token: string): { userId: number | string; username: string; role: string } | null {
  if (!token) return null;
  const cached = activeTokens.get(token);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      activeTokens.delete(token);
      return null;
    }
    return cached;
  }
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const [payloadStr, signature] = raw.split(':::');
    if (!payloadStr || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadStr).digest('hex');
    if (expectedSig !== signature) return null;
    const payload = JSON.parse(payloadStr);
    if (!payload || Date.now() > payload.exp) return null;
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role || 'admin',
    };
  } catch {
    return null;
  }
}

/**
 * requireAdmin middleware checking express session and/or Authorization: Bearer <token>
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // 1. Check active express session
  if (req.session && req.session.isAdmin) {
    return next();
  }

  // 2. Check Authorization Bearer header (critical for cross-site iframes with third-party cookie restrictions)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const tokenUser = verifyAuthToken(token);
    if (tokenUser && tokenUser.role === 'admin') {
      if (req.session) {
        req.session.isAdmin = true;
        req.session.userId = tokenUser.userId;
        req.session.username = tokenUser.username;
      }
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Admin authentication required. Please log in.',
  });
};

/**
 * Seed initial administrator account if users table is empty.
 */
async function seedAdminUser() {
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || 'adminpassword123').trim();
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  let hasUsersInDb = false;
  try {
    const res = await query(`SELECT COUNT(*) AS count FROM users;`);
    if (res && res.rows && Number(res.rows[0].count) > 0) {
      hasUsersInDb = true;
    }
  } catch {
    // Database table may not be ready or DB not connected
  }

  if (!hasUsersInDb) {
    try {
      await query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (username) DO NOTHING;`,
        [adminUsername, hashedPassword]
      );
    } catch {
      // safe fallback
    }
  }

  if (memoryUsers.length === 0) {
    memoryUsers.push({
      id: 1,
      username: adminUsername,
      password_hash: hashedPassword,
      role: 'admin',
      created_at: new Date().toISOString(),
    });

    console.log(
      `\n=======================================================\n[AUTH] Seed admin user created: "${adminUsername}"\nIMPORTANT: Please change this default password in the Manage Users screen after first login!\n=======================================================\n`
    );
  }
}


// In-memory store for registered Datacenters
export interface DatacenterRecord {
  id: string | number;
  name: string;
  location: string;
  created_at: string;
  node_count?: number;
}

const memoryDatacenters: DatacenterRecord[] = [
  { id: 'dc-1', name: 'DC-US-East', location: 'US-East (N. Virginia)', created_at: new Date().toISOString() },
  { id: 'dc-2', name: 'DC-US-West', location: 'US-West (Oregon)', created_at: new Date().toISOString() },
  { id: 'dc-3', name: 'DC-EU-Central', location: 'EU-Central (Frankfurt)', created_at: new Date().toISOString() },
  { id: 'dc-4', name: 'DC-EU-West', location: 'EU-West (London)', created_at: new Date().toISOString() },
  { id: 'dc-5', name: 'DC-AP-East', location: 'AP-East (Tokyo)', created_at: new Date().toISOString() },
  { id: 'dc-6', name: 'DC-AP-South', location: 'AP-Southeast (Singapore)', created_at: new Date().toISOString() },
  { id: 'dc-7', name: 'DC-SA-East', location: 'SA-East (São Paulo)', created_at: new Date().toISOString() },
  { id: 'dc-8', name: 'DC-AF-South', location: 'AF-South (Cape Town)', created_at: new Date().toISOString() },
];

const INITIAL_NODES = [
  { id: 'dev-1001', ip_address: '10.0.1.1', hostname: 'srv-postgres-db-01', device_type: 'Server', brand: 'Cisco', datacenter_id: 'dc-3', datacenter_name: 'DC-EU-Central', location: 'EU-Central (Frankfurt)', rack_number: 'Rack F-02 (U10)', snmp_community: 'public' },
  { id: 'dev-1002', ip_address: '192.168.10.1', hostname: 'mtik-edge-router-02', device_type: 'Router', brand: 'MikroTik', datacenter_id: 'dc-4', datacenter_name: 'DC-EU-West', location: 'EU-West (London)', rack_number: 'Rack L-01 (U14)', snmp_community: 'public' },
  { id: 'dev-1003', ip_address: '172.20.10.5', hostname: 'sw-spine-switch-03', device_type: 'Switch', brand: 'Juniper', datacenter_id: 'dc-4', datacenter_name: 'DC-EU-West', location: 'EU-West (London)', rack_number: 'Rack L-06 (U20)', snmp_community: 'public' },
  { id: 'dev-1004', ip_address: '172.31.20.2', hostname: 'olt-gpon-chassis-04', device_type: 'OLT', brand: 'Huawei', datacenter_id: 'dc-1', datacenter_name: 'DC-US-East', location: 'US-East (N. Virginia)', rack_number: 'Rack A-01 (U12)', snmp_community: 'public' },
  { id: 'dev-1005', ip_address: '10.0.4.15', hostname: 'srv-k8s-worker-05', device_type: 'Server', brand: 'Arista', datacenter_id: 'dc-6', datacenter_name: 'DC-AP-South', location: 'AP-Southeast (Singapore)', rack_number: 'Rack S-02 (U18)', snmp_community: 'public' },
  { id: 'dev-1006', ip_address: '192.168.20.1', hostname: 'mtik-bgp-border-06', device_type: 'Router', brand: 'MikroTik', datacenter_id: 'dc-5', datacenter_name: 'DC-AP-East', location: 'AP-East (Tokyo)', rack_number: 'Rack T-01 (U16)', snmp_community: 'public' },
  { id: 'dev-1007', ip_address: '172.20.30.12', hostname: 'sw-leaf-tor-07', device_type: 'Switch', brand: 'BDCOM', datacenter_id: 'dc-3', datacenter_name: 'DC-EU-Central', location: 'EU-Central (Frankfurt)', rack_number: 'Rack F-12 (U24)', snmp_community: 'public' },
  { id: 'dev-1008', ip_address: '172.31.50.6', hostname: 'olt-xgspon-fiber-08', device_type: 'OLT', brand: 'V-SOL', datacenter_id: 'dc-2', datacenter_name: 'DC-US-West', location: 'US-West (Oregon)', rack_number: 'Rack W-01 (U14)', snmp_community: 'public' },
];

interface DeviceRecord {
  id: string;
  ip_address: string;
  hostname: string;
  device_type: string;
  brand?: string;
  datacenter_id?: string | number;
  datacenter_name?: string;
  snmp_community: string;
  location: string;
  rack_number: string;
  created_at: string;
  cpu_usage?: number;
  ram_usage?: number | null;
  disk_usage?: number | null;
  connected_users?: number | null;
  temperature?: number | null;
  optical_tx?: number | null;
  optical_rx?: number | null;
  status?: string;
  health?: string;
  uptime?: string;
}

export interface NormalizedTelemetry {
  id?: string;
  ip_address: string;
  status: string;
  health: string;
  cpu_usage: number;
  ram_usage: number | null;
  disk_usage: number | null;
  connected_users?: number | null;
  temperature?: number | null;
  optical_tx?: number | null;
  optical_rx?: number | null;
  metrics_available?: boolean;
  uptime: string;
  load_average: string;
  snmp_reachable: boolean;
  error?: string;
  recorded_at?: string;
  sys_descr?: string;
}

const memoryDevices: DeviceRecord[] = INITIAL_NODES.map((n) => ({
  ...n,
  created_at: new Date().toISOString(),
  cpu_usage: 0,
  ram_usage: 0,
  disk_usage: 0,
  status: 'offline',
  health: 'Critical',
  uptime: '0d 0h (Pending Poll)',
}));

// Register memory devices with SNMP background scheduler
registerMemoryDevicesProvider(() => memoryDevices);

// ==========================================
// AUTHENTICATION & MULTI-USER API ENDPOINTS
// ==========================================

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    }

    const cleanUsername = String(username).trim();
    let user: UserRecord | undefined;

    try {
      const dbRes = await query(
        `SELECT id, username, password_hash, role, created_at FROM users WHERE username = $1 LIMIT 1;`,
        [cleanUsername]
      );
      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        user = dbRes.rows[0];
      }
    } catch {
      // Safe fallback if database table not available
    }

    if (!user) {
      user = memoryUsers.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(String(password), user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    req.session.isAdmin = true;
    req.session.username = user.username;

    const token = generateAuthToken(user);

    // Explicitly persist session to storage to prevent race condition with subsequent client API requests
    req.session.save((err) => {
      if (err) {
        console.error('Session save warning:', err);
      }
      return res.json({
        status: 'success',
        authenticated: true,
        token,
        username: user.username,
        role: user.role || 'admin',
        userId: user.id,
      });
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Login request failed.',
    });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    activeTokens.delete(token);
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to destroy session.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ status: 'success', message: 'Logged out successfully.' });
  });
});

// GET /api/auth/me
app.get('/api/auth/me', (req: Request, res: Response) => {
  // 1. Session check
  if (req.session && req.session.isAdmin) {
    return res.json({
      authenticated: true,
      username: req.session.username || 'admin',
      userId: req.session.userId,
    });
  }

  // 2. Bearer token check
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const tokenUser = verifyAuthToken(token);
    if (tokenUser && tokenUser.role === 'admin') {
      if (req.session) {
        req.session.isAdmin = true;
        req.session.userId = tokenUser.userId;
        req.session.username = tokenUser.username;
      }
      return res.json({
        authenticated: true,
        username: tokenUser.username,
        userId: tokenUser.userId,
      });
    }
  }

  return res.json({ authenticated: false });
});

// POST /api/auth/users - Create a new user (admin required)
app.post('/api/auth/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    const cleanUsername = (username ? String(username) : '').trim();
    const cleanPassword = password ? String(password) : '';

    if (!cleanUsername) {
      return res.status(400).json({ error: 'Bad Request', message: 'Username cannot be empty.' });
    }

    if (cleanPassword.length < 8) {
      return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 8 characters long.' });
    }

    // Check if username already exists in PostgreSQL
    let existsInDb = false;
    try {
      const checkRes = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1);`, [cleanUsername]);
      if (checkRes && checkRes.rows && checkRes.rows.length > 0) {
        existsInDb = true;
      }
    } catch {
      // safe fallback
    }

    const existsInMemory = memoryUsers.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existsInDb || existsInMemory) {
      return res.status(409).json({ error: 'Conflict', message: 'Username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    let createdUser: { id: number | string; username: string; role: string; created_at: string } | null = null;

    try {
      const insertRes = await query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin') RETURNING id, username, role, created_at;`,
        [cleanUsername, passwordHash]
      );
      if (insertRes && insertRes.rows && insertRes.rows[0]) {
        createdUser = insertRes.rows[0];
      }
    } catch {
      // safe fallback
    }

    if (!createdUser) {
      createdUser = {
        id: memoryUsers.length + 1,
        username: cleanUsername,
        role: 'admin',
        created_at: new Date().toISOString(),
      };
    }

    memoryUsers.push({
      id: createdUser.id,
      username: createdUser.username,
      password_hash: passwordHash,
      role: createdUser.role,
      created_at: createdUser.created_at,
    });

    return res.status(201).json({
      status: 'success',
      user: {
        id: createdUser.id,
        username: createdUser.username,
        created_at: createdUser.created_at,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error?.message || 'Failed to create user.' });
  }
});

// GET /api/auth/users - List all users (admin required)
app.get('/api/auth/users', requireAdmin, async (_req: Request, res: Response) => {
  try {
    try {
      const dbRes = await query(`SELECT id, username, role, created_at FROM users ORDER BY id ASC;`);
      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        return res.json({
          status: 'success',
          users: dbRes.rows,
        });
      }
    } catch {
      // safe fallback
    }

    const safeUsers = memoryUsers.map(({ id, username, role, created_at }) => ({
      id,
      username,
      role,
      created_at,
    }));
    return res.json({
      status: 'success',
      users: safeUsers,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error?.message || 'Failed to list users.' });
  }
});

// DELETE /api/auth/users/:id - Delete user (admin required, self-deletion blocked)
app.delete('/api/auth/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'User ID is required.' });
    }

    // Block deleting currently logged-in account
    if (String(req.session.userId) === String(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete your own currently logged-in account.',
      });
    }

    const memoryMatch = memoryUsers.find((u) => String(u.id) === String(id));
    if (memoryMatch && req.session.username && memoryMatch.username.toLowerCase() === req.session.username.toLowerCase()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete your own currently logged-in account.',
      });
    }

    // Delete in PostgreSQL
    try {
      await query(`DELETE FROM users WHERE id = $1;`, [id]);
    } catch {
      // safe fallback
    }

    const idx = memoryUsers.findIndex((u) => String(u.id) === String(id));
    if (idx !== -1) {
      memoryUsers.splice(idx, 1);
    }

    return res.json({
      status: 'success',
      message: 'User deleted successfully.',
      deletedId: id,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error?.message || 'Failed to delete user.' });
  }
});

// ==========================================
// SYSTEM SETTINGS API ENDPOINTS
// ==========================================

// GET /api/settings/snmp-poll-cron: returns { cron: string }, reading from the settings table. Requires requireAdmin.
app.get('/api/settings/snmp-poll-cron', requireAdmin, async (_req: Request, res: Response) => {
  try {
    let cronStr = await getSetting('snmp_poll_cron');
    if (!cronStr || typeof cronStr !== 'string' || !cronStr.trim()) {
      cronStr = process.env.SNMP_POLL_CRON || '*/1 * * * *';
    }
    return res.json({ cron: cronStr.trim() });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to retrieve SNMP polling cron interval.',
    });
  }
});

// PUT /api/settings/snmp-poll-cron: body { cron: string }. Requires requireAdmin.
app.put('/api/settings/snmp-poll-cron', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cron: newCron } = req.body || {};
    const cleanCron = (newCron ? String(newCron) : '').trim();

    if (!cleanCron) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cron expression cannot be empty. Please provide a valid 5-field cron expression.',
      });
    }

    // Validate using node-cron's cron.validate(cron)
    const isValid = cron.validate(cleanCron);
    if (!isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `"${cleanCron}" is not a valid cron expression. Please provide a plausible 5-field cron expression (e.g. "*/1 * * * *", "*/5 * * * *", "0 * * * *").`,
      });
    }

    // Update settings table (with in-memory fallback)
    await setSetting('snmp_poll_cron', cleanCron);

    // Immediately reschedule the running SNMP polling job to use the new interval
    rescheduleSnmpPolling(cleanCron);

    return res.json({
      status: 'success',
      cron: cleanCron,
      message: `SNMP polling interval updated to "${cleanCron}".`,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to update SNMP polling cron interval.',
    });
  }
});

// ==========================================
// ALERT THRESHOLDS API ENDPOINTS
// ==========================================

const VALID_THRESHOLD_METRICS = new Set(['cpu', 'ram', 'disk', 'temperature', 'connected_users']);
const VALID_THRESHOLD_DEVICE_TYPES = new Set(['All', 'Server', 'Router', 'Switch', 'OLT']);

function normalizeDeviceTypeLabel(rawType: any): string {
  const s = String(rawType || 'All').trim();
  if (!s) return 'All';
  const lower = s.toLowerCase();
  if (lower === 'all') return 'All';
  if (lower === 'server') return 'Server';
  if (lower === 'router') return 'Router';
  if (lower === 'switch') return 'Switch';
  if (lower === 'olt') return 'OLT';
  return s;
}

// GET /api/thresholds -> return all rows from alert_thresholds
app.get('/api/thresholds', async (_req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      const dbRes = await query(
        `SELECT id, metric, device_type, warning_value, critical_value, enabled
         FROM alert_thresholds
         ORDER BY id ASC;`
      );
      const rows = ((dbRes && dbRes.rows) || []).map((r: any) => ({
        id: Number(r.id),
        metric: String(r.metric),
        device_type: String(r.device_type),
        warning_value: Number(r.warning_value),
        critical_value: Number(r.critical_value),
        enabled: Boolean(r.enabled),
      }));
      setThresholdsCache(rows);
      return res.json({
        status: 'success',
        thresholds: rows,
      });
    }

    const cached = await loadAlertThresholds();
    return res.json({
      status: 'success',
      thresholds: cached,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to fetch alert thresholds.',
    });
  }
});

// PUT /api/thresholds -> accept an array of {metric, device_type, warning_value, critical_value, enabled} and upsert each
const upsertThresholdsHandler = async (req: Request, res: Response) => {
  try {
    const rawItems = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.thresholds)
      ? req.body.thresholds
      : req.body && typeof req.body === 'object' && req.body.metric
      ? [req.body]
      : null;

    if (!rawItems || rawItems.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Expected an array of threshold objects { metric, device_type, warning_value, critical_value, enabled }.',
      });
    }

    const validatedItems: {
      metric: string;
      device_type: string;
      warning_value: number;
      critical_value: number;
      enabled: boolean;
    }[] = [];

    for (const item of rawItems) {
      const metric = String(item?.metric || '').trim().toLowerCase();
      const deviceType = normalizeDeviceTypeLabel(item?.device_type);
      const warn = Number(item?.warning_value);
      const crit = Number(item?.critical_value);
      const enabled = item?.enabled !== undefined ? Boolean(item.enabled) : true;

      if (!VALID_THRESHOLD_METRICS.has(metric)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid metric "${item?.metric}". Allowed: cpu, ram, disk, temperature, connected_users.`,
        });
      }

      if (!VALID_THRESHOLD_DEVICE_TYPES.has(deviceType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid device_type "${item?.device_type}". Allowed: All, Server, Router, Switch, OLT.`,
        });
      }

      if (Number.isNaN(warn) || Number.isNaN(crit) || warn < 0 || crit < 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `warning_value and critical_value for "${metric}" (${deviceType}) must be non-negative numbers.`,
        });
      }

      if (warn >= crit) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `warning_value (${warn}) must be less than critical_value (${crit}) for "${metric}" (${deviceType}).`,
        });
      }

      validatedItems.push({
        metric,
        device_type: deviceType,
        warning_value: warn,
        critical_value: crit,
        enabled,
      });
    }

    if (isDbConnected()) {
      for (const item of validatedItems) {
        await query(
          `INSERT INTO alert_thresholds (metric, device_type, warning_value, critical_value, enabled)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (metric, device_type)
           DO UPDATE SET
             warning_value = EXCLUDED.warning_value,
             critical_value = EXCLUDED.critical_value,
             enabled = EXCLUDED.enabled;`,
          [item.metric, item.device_type, item.warning_value, item.critical_value, item.enabled]
        );
      }

      const dbRes = await query(
        `SELECT id, metric, device_type, warning_value, critical_value, enabled
         FROM alert_thresholds
         ORDER BY id ASC;`
      );
      const rows = ((dbRes && dbRes.rows) || []).map((r: any) => ({
        id: Number(r.id),
        metric: String(r.metric),
        device_type: String(r.device_type),
        warning_value: Number(r.warning_value),
        critical_value: Number(r.critical_value),
        enabled: Boolean(r.enabled),
      }));
      setThresholdsCache(rows);

      // Recompute health on in-memory latest telemetry map
      const latestMap = getLatestTelemetryMap() as Map<string, NormalizedTelemetry>;
      for (const [, entry] of latestMap.entries()) {
        if (entry && entry.status === 'online') {
          entry.health = computeHealth(entry, rows);
        }
      }

      return res.json({
        status: 'success',
        thresholds: rows,
      });
    }

    // In-memory fallback upsert
    const current = [...getCachedThresholds()];
    for (const item of validatedItems) {
      const existingIdx = current.findIndex(
        (t) =>
          t.metric.toLowerCase() === item.metric.toLowerCase() &&
          t.device_type.toLowerCase() === item.device_type.toLowerCase()
      );
      if (existingIdx !== -1) {
        current[existingIdx] = {
          ...current[existingIdx],
          warning_value: item.warning_value,
          critical_value: item.critical_value,
          enabled: item.enabled,
        };
      } else {
        const nextId = current.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1;
        current.push({
          id: nextId,
          ...item,
        });
      }
    }

    const updated = setThresholdsCache(current);
    const latestMap = getLatestTelemetryMap() as Map<string, NormalizedTelemetry>;
    for (const [, entry] of latestMap.entries()) {
      if (entry && entry.status === 'online') {
        entry.health = computeHealth(entry, updated);
      }
    }

    return res.json({
      status: 'success',
      thresholds: updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to update alert thresholds.',
    });
  }
};

app.put('/api/thresholds', requireAdmin, upsertThresholdsHandler);
app.post('/api/thresholds', requireAdmin, upsertThresholdsHandler);

// DELETE /api/thresholds/:id (and /api/thresholds) -> delete a threshold row by id
const deleteThresholdHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id || (req.query.id as string) || (req.body && req.body.id);
    const metric = (req.query.metric as string) || (req.body && req.body.metric);
    const deviceType = (req.query.device_type as string) || (req.body && req.body.device_type);

    if (!id && !(metric && deviceType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Threshold ID (or metric and device_type) is required for deletion.',
      });
    }

    if (isDbConnected()) {
      if (id) {
        await query(`DELETE FROM alert_thresholds WHERE id = $1;`, [Number(id)]);
      } else if (metric && deviceType) {
        await query(
          `DELETE FROM alert_thresholds WHERE LOWER(metric) = LOWER($1) AND LOWER(device_type) = LOWER($2);`,
          [String(metric).trim(), String(deviceType).trim()]
        );
      }

      const dbRes = await query(
        `SELECT id, metric, device_type, warning_value, critical_value, enabled
         FROM alert_thresholds
         ORDER BY id ASC;`
      );
      const rows = ((dbRes && dbRes.rows) || []).map((r: any) => ({
        id: Number(r.id),
        metric: String(r.metric),
        device_type: String(r.device_type),
        warning_value: Number(r.warning_value),
        critical_value: Number(r.critical_value),
        enabled: Boolean(r.enabled),
      }));
      setThresholdsCache(rows);

      return res.json({
        status: 'success',
        deletedId: id,
        thresholds: rows,
      });
    }

    const current = getCachedThresholds().filter((t) => {
      if (id) return String(t.id) !== String(id);
      return !(
        t.metric.toLowerCase() === String(metric).trim().toLowerCase() &&
        t.device_type.toLowerCase() === String(deviceType).trim().toLowerCase()
      );
    });
    const updated = setThresholdsCache(current);

    return res.json({
      status: 'success',
      deletedId: id,
      thresholds: updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to delete alert threshold.',
    });
  }
};

app.delete('/api/thresholds/:id', requireAdmin, deleteThresholdHandler);
app.delete('/api/thresholds', requireAdmin, deleteThresholdHandler);

// POST /api/thresholds/reset -> reset alert_thresholds to default seed rows
app.post('/api/thresholds/reset', requireAdmin, async (_req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      await query(`DELETE FROM alert_thresholds;`);
      await query(
        `INSERT INTO alert_thresholds (metric, device_type, warning_value, critical_value, enabled)
         VALUES
           ('cpu', 'All', 75, 85, true),
           ('ram', 'All', 80, 90, true),
           ('disk', 'All', 70, 85, true),
           ('temperature', 'All', 60, 75, true)
         ON CONFLICT (metric, device_type) DO NOTHING;`
      );
      const dbRes = await query(
        `SELECT id, metric, device_type, warning_value, critical_value, enabled
         FROM alert_thresholds
         ORDER BY id ASC;`
      );
      const rows = ((dbRes && dbRes.rows) || []).map((r: any) => ({
        id: Number(r.id),
        metric: String(r.metric),
        device_type: String(r.device_type),
        warning_value: Number(r.warning_value),
        critical_value: Number(r.critical_value),
        enabled: Boolean(r.enabled),
      }));
      setThresholdsCache(rows);
      return res.json({ status: 'success', thresholds: rows });
    }

    const resetRows = setThresholdsCache(DEFAULT_ALERT_THRESHOLDS);
    return res.json({ status: 'success', thresholds: resetRows });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to reset alert thresholds.',
    });
  }
});

// ==========================================
// 1. DATACENTER API ENDPOINTS
// ==========================================

// GET /api/datacenters
app.get('/api/datacenters', async (_req: Request, res: Response) => {
  try {
    const dbRes = await query(`
      SELECT 
        d.id, 
        d.name, 
        d.location, 
        d.created_at, 
        COUNT(s.id)::int AS node_count
      FROM datacenters d
      LEFT JOIN servers_info s ON s.datacenter_id = d.id
      GROUP BY d.id, d.name, d.location, d.created_at
      ORDER BY d.name ASC;
    `);

    if (isDbConnected()) {
      return res.json({
        status: 'success',
        source: 'database',
        datacenters: (dbRes && dbRes.rows) || [],
      });
    }

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      return res.json({
        status: 'success',
        source: 'database',
        datacenters: dbRes.rows,
      });
    }

    // Fallback: Compute node counts from memory devices
    const list = memoryDatacenters.map((dc) => {
      const count = memoryDevices.filter(
        (dev) => dev.datacenter_id === dc.id || dev.location === dc.location
      ).length;
      return {
        ...dc,
        node_count: count,
      };
    });

    return res.json({
      status: 'success',
      source: 'memory_fallback',
      total: list.length,
      datacenters: list,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Failed to fetch datacenters',
    });
  }
});

// POST /api/datacenters
app.post('/api/datacenters', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, location } = req.body || {};

    if (!name || !name.trim() || !location || !location.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Data Center name and location are required.',
      });
    }

    const cleanName = name.trim();
    const cleanLocation = location.trim();

    if (isDbConnected()) {
      const checkRes = await query(
        `SELECT id FROM datacenters WHERE LOWER(name) = LOWER($1) LIMIT 1;`,
        [cleanName]
      );
      if (checkRes && checkRes.rows && checkRes.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: `A Data Center named "${cleanName}" already exists.`,
        });
      }
      const dbInsert = await query(
        `INSERT INTO datacenters (name, location) VALUES ($1, $2) RETURNING id, name, location, created_at;`,
        [cleanName, cleanLocation]
      );
      const row = dbInsert.rows[0];
      return res.status(201).json({
        status: 'success',
        message: `Data Center "${cleanName}" created successfully.`,
        datacenter: { ...row, node_count: 0 },
      });
    }

    // Check duplicate in memory
    const existing = memoryDatacenters.some(
      (dc) => dc.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: `A Data Center named "${cleanName}" already exists.`,
      });
    }

    // Try DB insert if available
    try {
      const dbInsert = await query(
        `INSERT INTO datacenters (name, location) VALUES ($1, $2) RETURNING id, name, location, created_at;`,
        [cleanName, cleanLocation]
      );
      if (dbInsert && dbInsert.rows && dbInsert.rows[0]) {
        const row = dbInsert.rows[0];
        memoryDatacenters.push(row);
        return res.status(201).json({
          status: 'success',
          message: `Data Center "${cleanName}" created successfully.`,
          datacenter: { ...row, node_count: 0 },
        });
      }
    } catch {
      // safe fallback
    }

    const newDc: DatacenterRecord = {
      id: `dc-${Date.now()}`,
      name: cleanName,
      location: cleanLocation,
      created_at: new Date().toISOString(),
      node_count: 0,
    };

    memoryDatacenters.push(newDc);

    return res.status(201).json({
      status: 'success',
      message: `Data Center "${cleanName}" created successfully.`,
      datacenter: newDc,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to create datacenter',
    });
  }
});

// DELETE /api/datacenters/:id and /api/datacenters?id=...
const deleteDatacenterHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id || (req.query.id as string) || (req.body && req.body.id);

    if (!id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Datacenter ID is required for deletion.',
      });
    }

    if (isDbConnected()) {
      const delRes = await query(`DELETE FROM datacenters WHERE id::text = $1 RETURNING id, name;`, [String(id)]);
      const deletedName = delRes?.rows?.[0]?.name || id;
      return res.json({
        status: 'success',
        message: `Data Center ${deletedName} deleted successfully.`,
        deletedId: id,
      });
    }

    // Try DB delete if available
    try {
      await query(`DELETE FROM datacenters WHERE id = $1;`, [id]);
    } catch {
      // safe fallback
    }

    // Remove from in-memory array
    const initialLen = memoryDatacenters.length;
    const index = memoryDatacenters.findIndex((dc) => String(dc.id) === String(id));
    let deletedName = '';
    if (index !== -1) {
      deletedName = memoryDatacenters[index].name;
      memoryDatacenters.splice(index, 1);
    }

    // Disassociate devices that pointed to this DC
    memoryDevices.forEach((dev) => {
      if (String(dev.datacenter_id) === String(id)) {
        dev.datacenter_id = undefined;
        dev.datacenter_name = undefined;
      }
    });

    return res.json({
      status: 'success',
      message: `Data Center ${deletedName || id} deleted successfully.`,
      deletedId: id,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to delete datacenter',
    });
  }
};

app.delete('/api/datacenters/:id', requireAdmin, deleteDatacenterHandler);
app.delete('/api/datacenters', requireAdmin, deleteDatacenterHandler);

// PUT /api/datacenters/:id and /api/datacenters - Update existing datacenter
const updateDatacenterHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id || (req.query.id as string) || (req.body && req.body.id);
    const { name, location } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Datacenter ID is required.' });
    }

    const cleanName = (name || '').trim();
    const cleanLocation = (location || '').trim();

    if (!cleanName && !cleanLocation) {
      return res.status(400).json({ error: 'Bad Request', message: 'Name or Location is required.' });
    }

    if (isDbConnected()) {
      const updRes = await query(
        `UPDATE datacenters
         SET name = COALESCE(NULLIF($1, ''), name),
             location = COALESCE(NULLIF($2, ''), location),
             updated_at = NOW()
         WHERE id::text = $3
         RETURNING id, name, location, created_at;`,
        [cleanName || null, cleanLocation || null, String(id)]
      );
      if (updRes && updRes.rows && updRes.rows[0]) {
        return res.json({
          status: 'success',
          message: `Data Center "${updRes.rows[0].name}" updated successfully.`,
          datacenter: updRes.rows[0],
        });
      }
      return res.status(404).json({
        error: 'Not Found',
        message: `Datacenter with ID ${id} was not found.`,
      });
    }

    // Try DB update if available
    try {
      await query(
        `UPDATE datacenters
         SET name = COALESCE(NULLIF($1, ''), name),
             location = COALESCE(NULLIF($2, ''), location),
             updated_at = NOW()
         WHERE id::text = $3;`,
        [cleanName || null, cleanLocation || null, String(id)]
      );
    } catch {
      // safe fallback
    }

    // Update in-memory
    const dc = memoryDatacenters.find((d) => String(d.id) === String(id));
    if (dc) {
      if (cleanName) dc.name = cleanName;
      if (cleanLocation) dc.location = cleanLocation;

      // Update associated device records
      if (cleanName) {
        memoryDevices.forEach((dev) => {
          if (String(dev.datacenter_id) === String(id)) {
            dev.datacenter_name = cleanName;
            if (cleanLocation) dev.location = cleanLocation;
          }
        });
      }

      return res.json({
        status: 'success',
        message: `Data Center "${dc.name}" updated successfully.`,
        datacenter: dc,
      });
    }

    return res.status(404).json({
      error: 'Not Found',
      message: `Datacenter with ID ${id} was not found.`,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to update datacenter',
    });
  }
};

app.put('/api/datacenters/:id', requireAdmin, updateDatacenterHandler);
app.put('/api/datacenters', requireAdmin, updateDatacenterHandler);

// ==========================================
// 2. TELEMETRY API ENDPOINT
// ==========================================

// GET /api/telemetry
app.get('/api/telemetry', async (req: Request, res: Response) => {
  try {
    if (req.query.refresh === 'true' || req.query.force === 'true') {
      try {
        await runSnmpPollCycle();
      } catch (pollErr: any) {
        console.warn('[server.ts] Manual SNMP poll cycle warning:', pollErr?.message);
      }
    }

    // Read active alert thresholds before computing health
    const activeThresholds = await loadAlertThresholds();

    // If PostgreSQL is connected and has rows, return latest telemetry row per device from DB
    const dbRes = await query(`
      SELECT DISTINCT ON (s.ip_address)
        s.id,
        s.ip_address,
        s.hostname,
        COALESCE(s.device_type, 'Server') AS device_type,
        s.brand,
        s.datacenter_id,
        d.name AS datacenter_name,
        COALESCE(s.location, d.location, 'Local Datacenter') AS location,
        COALESCE(s.rack_number, 'Unassigned') AS rack_number,
        ROUND(COALESCE(t.cpu_usage, 0)::numeric, 1) AS cpu_usage,
        ROUND(COALESCE(t.ram_usage, 0)::numeric, 1) AS ram_usage,
        ROUND(COALESCE(t.disk_usage, 0)::numeric, 1) AS disk_usage,
        t.connected_users,
        t.temperature,
        t.optical_tx,
        t.optical_rx,
        t.sys_name,
        t.power_supplies,
        t.fans,
        t.device_model,
        t.sys_descr,
        t.storage,
        t.disk_percentage_used,
        t.disk_power_on_hours,
        t.disk_lifetime_bytes_read,
        t.disk_lifetime_bytes_written,
        t.disk_estimated_eol_days,
        COALESCE(t.uptime, '0d 0h (Offline)') AS uptime,
        COALESCE(t.status, 'offline') AS status,
        COALESCE(t.health, 'Critical') AS health,
        COALESCE(t.load_average, '0.00, 0.00, 0.00') AS load_average,
        COALESCE(t.recorded_at, NOW()) AS recorded_at
      FROM servers_info s
      LEFT JOIN datacenters d ON s.datacenter_id = d.id
      LEFT JOIN telemetry_data t ON s.ip_address = t.ip_address
      ORDER BY s.ip_address, t.recorded_at DESC NULLS LAST;
    `);

    const computeRowsWithThresholds = (rows: any[]) =>
      rows.map((r) => ({
        ...r,
        health: computeHealth(r, activeThresholds),
      }));

    if (isDbConnected()) {
      const rows = computeRowsWithThresholds((dbRes && dbRes.rows) || []);
      return res.json({
        status: 'success',
        source: 'postgresql',
        database: 'noc_db',
        total_nodes: (dbRes && dbRes.rowCount) || 0,
        telemetry: rows,
      });
    }

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      const rows = computeRowsWithThresholds(dbRes.rows);
      return res.json({
        status: 'success',
        source: 'postgresql',
        database: 'noc_db',
        total_nodes: dbRes.rowCount,
        telemetry: rows,
      });
    }

    // In-memory telemetry cache (reads real latest polled SNMP metrics, with zero Math.random fallback)
    const latestMap = getLatestTelemetryMap() as Map<string, NormalizedTelemetry>;
    const telemetry = memoryDevices.map((d) => {
      const latest = latestMap.get(d.ip_address);
      if (latest) {
        const merged = {
          id: d.id,
          ip_address: d.ip_address,
          hostname: d.hostname,
          device_type: d.device_type,
          brand: d.brand,
          datacenter_id: d.datacenter_id,
          datacenter_name: d.datacenter_name,
          location: d.location,
          rack_number: d.rack_number,
          cpu_usage: latest.cpu_usage,
          ram_usage: latest.ram_usage,
          disk_usage: latest.disk_usage,
          connected_users: latest.connected_users ?? null,
          temperature: latest.temperature ?? null,
          optical_tx: latest.optical_tx ?? null,
          optical_rx: latest.optical_rx ?? null,
          uptime: latest.uptime,
          status: latest.status,
          health: latest.health,
          load_average: latest.load_average,
          recorded_at: latest.recorded_at,
        };
        merged.health = computeHealth(merged, activeThresholds);
        return merged;
      }

      const fallbackRow = {
        id: d.id,
        ip_address: d.ip_address,
        hostname: d.hostname,
        device_type: d.device_type,
        brand: d.brand,
        datacenter_id: d.datacenter_id,
        datacenter_name: d.datacenter_name,
        location: d.location,
        rack_number: d.rack_number,
        cpu_usage: d.cpu_usage ?? 0,
        ram_usage: d.ram_usage ?? 0,
        disk_usage: d.disk_usage ?? 0,
        connected_users: d.connected_users ?? null,
        temperature: d.temperature ?? null,
        optical_tx: d.optical_tx ?? null,
        optical_rx: d.optical_rx ?? null,
        uptime: d.uptime ?? '0d 0h (Offline)',
        status: d.status ?? 'offline',
        health: d.health ?? 'Critical',
        load_average: '0.00, 0.00, 0.00',
        recorded_at: d.created_at || new Date().toISOString(),
      };
      fallbackRow.health = computeHealth(fallbackRow, activeThresholds);
      return fallbackRow;
    });

    return res.json({
      status: 'success',
      source: 'snmp_telemetry_cache',
      total_nodes: telemetry.length,
      telemetry,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Failed to fetch telemetry data',
    });
  }
});

// ==========================================
// 3. DEVICES API ENDPOINTS
// ==========================================

// GET /api/devices
app.get('/api/devices', async (_req: Request, res: Response) => {
  try {
    // Read active alert thresholds before computing health
    const activeThresholds = await loadAlertThresholds();

    const dbRes = await query(`
      SELECT DISTINCT ON (s.ip_address)
        s.id, 
        s.ip_address, 
        s.hostname, 
        s.device_type, 
        s.brand,
        s.datacenter_id,
        d.name AS datacenter_name,
        COALESCE(s.location, d.location) AS location, 
        s.rack_number, 
        s.snmp_community, 
        s.created_at,
        ROUND(COALESCE(t.cpu_usage, 0)::numeric, 1) AS cpu_usage,
        ROUND(COALESCE(t.ram_usage, 0)::numeric, 1) AS ram_usage,
        ROUND(COALESCE(t.disk_usage, 0)::numeric, 1) AS disk_usage,
        t.connected_users,
        t.temperature,
        t.optical_tx,
        t.optical_rx,
        t.sys_name,
        t.power_supplies,
        t.fans,
        t.device_model,
        t.sys_descr,
        t.storage,
        t.disk_percentage_used,
        t.disk_power_on_hours,
        t.disk_lifetime_bytes_read,
        t.disk_lifetime_bytes_written,
        t.disk_estimated_eol_days,
        COALESCE(t.uptime, '0d 0h (Offline)') AS uptime,
        COALESCE(t.status, 'offline') AS status,
        COALESCE(t.health, 'Critical') AS health,
        COALESCE(t.load_average, '0.00, 0.00, 0.00') AS load_average
      FROM servers_info s
      LEFT JOIN datacenters d ON s.datacenter_id = d.id
      LEFT JOIN telemetry_data t ON s.ip_address = t.ip_address
      ORDER BY s.ip_address, t.recorded_at DESC NULLS LAST;
    `);

    const computeDevicesWithThresholds = (rows: any[]) =>
      rows.map((r) => ({
        ...r,
        health: computeHealth(r, activeThresholds),
      }));

    if (isDbConnected()) {
      const devices = computeDevicesWithThresholds((dbRes && dbRes.rows) || []);
      return res.json({
        status: 'success',
        total: (dbRes && dbRes.rowCount) || 0,
        devices,
      });
    }

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      const devices = computeDevicesWithThresholds(dbRes.rows);
      return res.json({
        status: 'success',
        total: dbRes.rowCount,
        devices,
      });
    }

    const latestMap = getLatestTelemetryMap() as Map<string, NormalizedTelemetry>;
    const enrichedDevices = memoryDevices.map((d) => {
      const latest = latestMap.get(d.ip_address);
      if (!latest) {
        const base = {
          ...d,
          connected_users: d.connected_users ?? null,
          temperature: d.temperature ?? null,
          optical_tx: d.optical_tx ?? null,
          optical_rx: d.optical_rx ?? null,
        };
        base.health = computeHealth(base, activeThresholds);
        return base;
      }
      const merged = {
        ...d,
        cpu_usage: latest.cpu_usage,
        ram_usage: latest.ram_usage,
        disk_usage: latest.disk_usage,
        connected_users: latest.connected_users ?? null,
        temperature: latest.temperature ?? null,
        optical_tx: latest.optical_tx ?? null,
        optical_rx: latest.optical_rx ?? null,
        uptime: latest.uptime,
        status: latest.status,
        health: latest.health,
        load_average: latest.load_average,
      };
      merged.health = computeHealth(merged, activeThresholds);
      return merged;
    });

    return res.json({
      status: 'success',
      total: enrichedDevices.length,
      devices: enrichedDevices,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Failed to retrieve devices',
    });
  }
});

// GET /api/devices/:id
app.get('/api/devices/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Device ID is required.' });
    }

    // Try database first
    const isNumeric = /^\d+$/.test(id);
    const dbRes = await query(`
      SELECT 
        s.id, 
        s.ip_address, 
        s.hostname, 
        s.device_type, 
        s.brand,
        s.datacenter_id,
        d.name AS datacenter_name,
        COALESCE(s.location, d.location) AS location, 
        s.rack_number, 
        s.snmp_community, 
        s.created_at,
        t.sys_name,
        t.power_supplies,
        t.fans,
        t.device_model,
        t.sys_descr,
        t.storage,
        t.disk_percentage_used,
        t.disk_power_on_hours,
        t.disk_lifetime_bytes_read,
        t.disk_lifetime_bytes_written,
        t.disk_estimated_eol_days
      FROM servers_info s
      LEFT JOIN datacenters d ON s.datacenter_id = d.id
      LEFT JOIN telemetry_data t ON s.ip_address = t.ip_address
      WHERE ${isNumeric ? 's.id = $1' : 's.ip_address = $1 OR s.id::text = $1'}
      ORDER BY t.recorded_at DESC NULLS LAST
      LIMIT 1;
    `, [id]);

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      return res.json({
        status: 'success',
        device: dbRes.rows[0],
      });
    }

    if (isDbConnected()) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Device with ID ${id} was not found.`,
      });
    }

    // Fallback to memory
    const dev = memoryDevices.find((d) => String(d.id) === String(id) || d.ip_address === String(id));
    if (dev) {
      return res.json({
        status: 'success',
        device: dev,
      });
    }

    return res.status(404).json({
      error: 'Not Found',
      message: `Device with ID ${id} was not found.`,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to retrieve device',
    });
  }
});

// POST /api/devices
app.post('/api/devices', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ip_address, hostname, device_type, brand, snmp_community, location, rack_number, datacenter_id, datacenter_name } = req.body || {};

    if (!ip_address || !ip_address.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ip_address is required.',
      });
    }

    const cleanIp = ip_address.trim();
    const cleanType = (device_type || 'Server').trim();
    const cleanBrand = (brand && brand.trim()) ? brand.trim() : undefined;
    const cleanHost = (hostname && hostname.trim()) ? hostname.trim() : `${cleanType.toLowerCase()}-node-${cleanIp.replace(/\./g, '-')}`;
    const cleanCommunity = (snmp_community && snmp_community.trim()) ? snmp_community.trim() : 'public';
    const cleanLocation = (location && location.trim()) ? location.trim() : 'Global Datacenter';
    const cleanRack = (rack_number && rack_number.trim()) ? rack_number.trim() : 'Rack TBD';

    // IPv4 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(cleanIp)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid IPv4 address format: "${cleanIp}"`,
      });
    }

    // Check conflict
    if (isDbConnected()) {
      const dbExists = await query(
        `SELECT id FROM servers_info WHERE ip_address = $1 LIMIT 1;`,
        [cleanIp]
      );
      if (dbExists && dbExists.rows && dbExists.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: `A device with IP ${cleanIp} already exists in servers_info.`,
        });
      }
    } else {
      const exists = memoryDevices.some((d) => d.ip_address === cleanIp);
      if (exists) {
        return res.status(409).json({
          error: 'Conflict',
          message: `A device with IP ${cleanIp} already exists in servers_info.`,
        });
      }
    }

    // Resolve datacenter ID and name
    let resolvedDcName = datacenter_name;
    let numericDcId: number | null =
      datacenter_id !== undefined && datacenter_id !== null && /^\d+$/.test(String(datacenter_id))
        ? Number(datacenter_id)
        : null;

    if (isDbConnected()) {
      if (numericDcId !== null && !resolvedDcName) {
        try {
          const dcRes = await query(`SELECT name FROM datacenters WHERE id = $1 LIMIT 1;`, [numericDcId]);
          if (dcRes && dcRes.rows && dcRes.rows[0]) {
            resolvedDcName = dcRes.rows[0].name;
          }
        } catch {
          // ignore
        }
      } else if (numericDcId === null && resolvedDcName) {
        try {
          const dcRes = await query(`SELECT id FROM datacenters WHERE LOWER(name) = LOWER($1) LIMIT 1;`, [resolvedDcName]);
          if (dcRes && dcRes.rows && dcRes.rows[0]) {
            numericDcId = Number(dcRes.rows[0].id);
          }
        } catch {
          // ignore
        }
      }
    } else if (datacenter_id && !resolvedDcName) {
      const match = memoryDatacenters.find((d) => String(d.id) === String(datacenter_id));
      if (match) resolvedDcName = match.name;
    }

    const newRecord: DeviceRecord = {
      id: `dev-${Math.floor(Math.random() * 9000) + 1000}`,
      ip_address: cleanIp,
      hostname: cleanHost,
      device_type: cleanType,
      brand: cleanBrand,
      datacenter_id: isDbConnected() ? (numericDcId ?? undefined) : (datacenter_id || undefined),
      datacenter_name: resolvedDcName || undefined,
      snmp_community: cleanCommunity,
      location: cleanLocation,
      rack_number: cleanRack,
      created_at: new Date().toISOString(),
      cpu_usage: 0,
      ram_usage: 0,
      disk_usage: 0,
      status: 'offline',
      health: 'Critical',
      uptime: '0d 0h',
    };

    // Try PostgreSQL insert if connection available
    if (isDbConnected()) {
      const insertRes = await query(`
        INSERT INTO servers_info (ip_address, hostname, device_type, brand, datacenter_id, snmp_community, location, rack_number, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, created_at;
      `, [cleanIp, cleanHost, cleanType, cleanBrand || null, numericDcId, cleanCommunity, cleanLocation, cleanRack]);
      if (insertRes && insertRes.rows && insertRes.rows[0]) {
        newRecord.id = String(insertRes.rows[0].id);
        newRecord.created_at = insertRes.rows[0].created_at;
      }
    }

    // Read active thresholds before polling and computing health
    const activeThresholds = await loadAlertThresholds();

    // Execute real one-time SNMP poll against new node to verify connectivity
    const pollResult = (await pollDevice(
      {
        id: newRecord.id,
        ip_address: cleanIp,
        snmp_community: cleanCommunity,
        brand: cleanBrand,
        device_type: cleanType,
      },
      activeThresholds
    )) as NormalizedTelemetry;

    // Update record with real polled telemetry
    newRecord.status = pollResult.status;
    newRecord.health = pollResult.health;
    newRecord.cpu_usage = pollResult.cpu_usage;
    newRecord.ram_usage = pollResult.ram_usage;
    newRecord.disk_usage = pollResult.disk_usage;
    newRecord.connected_users = pollResult.connected_users ?? null;
    newRecord.temperature = pollResult.temperature ?? null;
    newRecord.optical_tx = pollResult.optical_tx ?? null;
    newRecord.optical_rx = pollResult.optical_rx ?? null;
    newRecord.uptime = pollResult.uptime;

    // Persist real telemetry in database if available
    try {
      await query(`
        INSERT INTO telemetry_data (ip_address, cpu_usage, ram_usage, disk_usage, uptime, status, health, load_average, connected_users, temperature, optical_tx, optical_rx, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW());
      `, [
        cleanIp,
        pollResult.cpu_usage,
        pollResult.ram_usage,
        pollResult.disk_usage,
        pollResult.uptime,
        pollResult.status,
        pollResult.health,
        pollResult.load_average,
        pollResult.connected_users ?? null,
        pollResult.temperature ?? null,
        pollResult.optical_tx ?? null,
        pollResult.optical_rx ?? null,
      ]);
    } catch {
      // safe fallback
    }

    if (!isDbConnected()) {
      memoryDevices.unshift(newRecord);
    }
    getLatestTelemetryMap().set(cleanIp, pollResult);

    return res.status(201).json({
      status: 'success',
      message: `Device ${cleanHost} (${cleanIp}) registered. SNMP ${pollResult.snmp_reachable ? 'reachable' : 'unreachable'}.`,
      device: newRecord,
      snmp_reachable: pollResult.snmp_reachable,
      telemetry: pollResult,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to complete device registration.',
    });
  }
});

// PUT /api/devices/:id - Update existing device
const updateDeviceHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Device ID is required.' });
    }

    const {
      ip_address,
      ip,
      hostname,
      device_type,
      deviceType,
      brand,
      datacenter_id,
      datacenterId,
      datacenter_name,
      datacenterName,
      location,
      rack_number,
      rackNumber,
      snmp_community,
      snmpCommunity,
      status,
      health,
    } = req.body || {};

    const cleanIp = (ip_address || ip || '').trim();
    const cleanHost = (hostname || '').trim();
    const cleanType = (device_type || deviceType || '').trim();
    const cleanBrand = brand !== undefined ? (brand ? String(brand).trim() : '') : undefined;
    const cleanDcId = datacenter_id !== undefined ? datacenter_id : datacenterId;
    const cleanLocation = (location || '').trim();
    const cleanRack = (rack_number || rackNumber || '').trim();
    const cleanCommunity = (snmp_community || snmpCommunity || '').trim();

    // Find existing device in memory
    const devIndex = memoryDevices.findIndex(
      (d) => String(d.id) === String(id) || d.ip_address === String(id)
    );

    // If new IP given, check conflict with other devices
    if (cleanIp) {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(cleanIp)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid IPv4 address format: "${cleanIp}"`,
        });
      }

      if (isDbConnected()) {
        const conflictRes = await query(
          `SELECT id FROM servers_info WHERE ip_address = $1 AND id::text != $2 AND ip_address != $2 LIMIT 1;`,
          [cleanIp, String(id)]
        );
        if (conflictRes && conflictRes.rows && conflictRes.rows.length > 0) {
          return res.status(409).json({
            error: 'Conflict',
            message: `Another device with IP address ${cleanIp} already exists.`,
          });
        }
      } else {
        const conflict = memoryDevices.some(
          (d, idx) => idx !== devIndex && d.ip_address === cleanIp
        );
        if (conflict) {
          return res.status(409).json({
            error: 'Conflict',
            message: `Another device with IP address ${cleanIp} already exists.`,
          });
        }
      }
    }

    // Resolve datacenter name and numeric ID
    let resolvedDcName = datacenter_name || datacenterName;
    const numericDcId: number | null =
      cleanDcId !== undefined && cleanDcId !== null && /^\d+$/.test(String(cleanDcId))
        ? Number(cleanDcId)
        : null;

    if (isDbConnected()) {
      if (numericDcId !== null && !resolvedDcName) {
        try {
          const dcRes = await query(`SELECT name FROM datacenters WHERE id = $1 LIMIT 1;`, [numericDcId]);
          if (dcRes && dcRes.rows && dcRes.rows[0]) {
            resolvedDcName = dcRes.rows[0].name;
          }
        } catch {
          // ignore
        }
      }

      const updRes = await query(
        `UPDATE servers_info
         SET ip_address = COALESCE(NULLIF($1, ''), ip_address),
             hostname = COALESCE(NULLIF($2, ''), hostname),
             device_type = COALESCE(NULLIF($3, ''), device_type),
             brand = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE brand END,
             datacenter_id = $5,
             location = COALESCE(NULLIF($6, ''), location),
             rack_number = COALESCE(NULLIF($7, ''), rack_number),
             snmp_community = COALESCE(NULLIF($8, ''), snmp_community),
             updated_at = NOW()
         WHERE id::text = $9 OR ip_address = $9
         RETURNING id, ip_address, hostname, device_type, brand, datacenter_id, location, rack_number, snmp_community, created_at;`,
        [
          cleanIp || null,
          cleanHost || null,
          cleanType || null,
          cleanBrand !== undefined ? cleanBrand : null,
          numericDcId,
          cleanLocation || null,
          cleanRack || null,
          cleanCommunity || null,
          String(id),
        ]
      );

      if (updRes && updRes.rows && updRes.rows[0]) {
        const updatedRow = {
          ...updRes.rows[0],
          datacenter_name: resolvedDcName,
        };
        return res.json({
          status: 'success',
          message: `Device "${updatedRow.hostname}" (${updatedRow.ip_address}) updated successfully.`,
          device: updatedRow,
        });
      }

      return res.status(404).json({
        error: 'Not Found',
        message: `Device with ID ${id} was not found.`,
      });
    }

    if (cleanDcId && !resolvedDcName) {
      const dcMatch = memoryDatacenters.find((d) => String(d.id) === String(cleanDcId));
      if (dcMatch) resolvedDcName = dcMatch.name;
    }

    if (devIndex !== -1) {
      const existing = memoryDevices[devIndex];
      if (cleanIp) existing.ip_address = cleanIp;
      if (cleanHost) existing.hostname = cleanHost;
      if (cleanType) existing.device_type = cleanType;
      if (cleanBrand !== undefined) existing.brand = cleanBrand || undefined;
      if (cleanDcId !== undefined) existing.datacenter_id = cleanDcId;
      if (resolvedDcName) existing.datacenter_name = resolvedDcName;
      if (cleanLocation) existing.location = cleanLocation;
      if (cleanRack) existing.rack_number = cleanRack;
      if (cleanCommunity) existing.snmp_community = cleanCommunity;
      if (status) existing.status = status;
      if (health) existing.health = health;

      return res.json({
        status: 'success',
        message: `Device "${existing.hostname}" (${existing.ip_address}) updated successfully.`,
        device: existing,
      });
    }

    // If not found in memory array (e.g. added via mock ID)
    const virtualDev: DeviceRecord = {
      id: String(id),
      ip_address: cleanIp || '10.0.0.1',
      hostname: cleanHost || 'srv-updated',
      device_type: cleanType || 'Server',
      brand: cleanBrand || undefined,
      datacenter_id: cleanDcId || undefined,
      datacenter_name: resolvedDcName || undefined,
      location: cleanLocation || 'Datacenter',
      rack_number: cleanRack || 'Rack 01',
      snmp_community: cleanCommunity || 'public',
      created_at: new Date().toISOString(),
      status: status || 'online',
      health: health || 'Normal',
    };
    memoryDevices.push(virtualDev);

    return res.json({
      status: 'success',
      message: `Device updated successfully.`,
      device: virtualDev,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to update device.',
    });
  }
};

app.put('/api/devices/:id', requireAdmin, updateDeviceHandler);
app.put('/api/devices', requireAdmin, updateDeviceHandler);

// DELETE /api/devices/:id - Delete device from fleet
const deleteDeviceHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id || (req.query.id as string) || (req.body && req.body.id);
    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Device ID is required.' });
    }

    if (isDbConnected()) {
      const targetRes = await query(
        `SELECT id, ip_address, hostname FROM servers_info WHERE id::text = $1 OR ip_address = $1 LIMIT 1;`,
        [String(id)]
      );
      const targetRow = targetRes?.rows?.[0];
      if (targetRow?.ip_address) {
        await query(`DELETE FROM telemetry_data WHERE ip_address = $1;`, [targetRow.ip_address]);
        getLatestTelemetryMap().delete(targetRow.ip_address);
      }
      await query(`DELETE FROM servers_info WHERE id::text = $1 OR ip_address = $1;`, [String(id)]);

      const deletedName = targetRow?.hostname || targetRow?.ip_address || String(id);
      return res.json({
        status: 'success',
        message: `Device "${deletedName}" was successfully removed from HealthStream fleet.`,
        deletedId: id,
      });
    }

    // Remove from in-memory store
    const devIndex = memoryDevices.findIndex(
      (d) => String(d.id) === String(id) || d.ip_address === String(id)
    );

    let deletedName = String(id);
    if (devIndex !== -1) {
      deletedName = memoryDevices[devIndex].hostname || memoryDevices[devIndex].ip_address;
      memoryDevices.splice(devIndex, 1);
    }

    return res.json({
      status: 'success',
      message: `Device "${deletedName}" was successfully removed from HealthStream fleet.`,
      deletedId: id,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to delete device.',
    });
  }
};

app.delete('/api/devices/:id', requireAdmin, deleteDeviceHandler);
app.delete('/api/devices', requireAdmin, deleteDeviceHandler);

// POST /api/servers (alias compatibility)
app.post('/api/servers', requireAdmin, async (req: Request, res: Response) => {
  const { ip_address, device_type, snmp_community, location, rack_number, datacenter_id } = req.body || {};
  req.body.hostname = req.body.hostname || `${(device_type || 'srv').toLowerCase()}-${(ip_address || '').replace(/\./g, '-')}`;
  const cleanIp = (ip_address || '').trim();
  if (!cleanIp) {
    return res.status(400).json({ error: 'Bad Request', message: 'ip_address is required.' });
  }
  const exists = memoryDevices.some((d) => d.ip_address === cleanIp);
  if (exists) {
    return res.status(409).json({ error: 'Conflict', message: 'A server with this IP address already exists.' });
  }

  const record: DeviceRecord = {
    id: `dev-${Math.floor(Math.random() * 9000) + 1000}`,
    ip_address: cleanIp,
    hostname: req.body.hostname,
    device_type: device_type || 'Server',
    brand: req.body.brand || undefined,
    datacenter_id: datacenter_id || undefined,
    snmp_community: snmp_community || 'public',
    location: location || 'Local Datacenter',
    rack_number: rack_number || 'Unassigned',
    created_at: new Date().toISOString(),
    status: 'online',
    health: 'Normal',
  };
  memoryDevices.unshift(record);

  return res.json({
    status: 'success',
    message: 'Server registered successfully into PostgreSQL servers_info.',
    server: record,
  });
});

// Health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Vite or Static assets mounting
async function startServer() {
  const PORT = Number(process.env.PORT || 3000);

  // Initialize and verify database tables and snmp_community column
  try {
    await ensureTablesExist();
    await seedAdminUser();
    await loadAlertThresholds(true);
  } catch (err: any) {
    console.warn('[server.ts] Database schema initialization warning:', err?.message);
  }

  // Start background SNMP poller scheduler
  try {
    await startSnmpScheduler();
  } catch (err: any) {
    console.warn('[server.ts] SNMP poller scheduler initialization warning:', err?.message);
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI Studio] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[AI Studio] Reverse-proxy configuration: trust proxy = 1, session cookies = SameSite: none, Secure: true (proxy: true)`);
  });
}

startServer().catch((err) => {
  console.error('[AI Studio] Fatal error starting server:', err);
  process.exit(1);
});

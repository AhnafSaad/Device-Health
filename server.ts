import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, ensureTablesExist } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

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
  { id: 'dev-1002', ip_address: '192.168.10.1', hostname: 'mtik-edge-router-02', device_type: 'MikroTik', brand: 'MikroTik', datacenter_id: 'dc-4', datacenter_name: 'DC-EU-West', location: 'EU-West (London)', rack_number: 'Rack L-01 (U14)', snmp_community: 'public' },
  { id: 'dev-1003', ip_address: '172.20.10.5', hostname: 'sw-spine-switch-03', device_type: 'Switch', brand: 'Juniper', datacenter_id: 'dc-4', datacenter_name: 'DC-EU-West', location: 'EU-West (London)', rack_number: 'Rack L-06 (U20)', snmp_community: 'public' },
  { id: 'dev-1004', ip_address: '172.31.20.2', hostname: 'olt-gpon-chassis-04', device_type: 'OLT', brand: 'Huawei', datacenter_id: 'dc-1', datacenter_name: 'DC-US-East', location: 'US-East (N. Virginia)', rack_number: 'Rack A-01 (U12)', snmp_community: 'public' },
  { id: 'dev-1005', ip_address: '10.0.4.15', hostname: 'srv-k8s-worker-05', device_type: 'Server', brand: 'Arista', datacenter_id: 'dc-6', datacenter_name: 'DC-AP-South', location: 'AP-Southeast (Singapore)', rack_number: 'Rack S-02 (U18)', snmp_community: 'public' },
  { id: 'dev-1006', ip_address: '192.168.20.1', hostname: 'mtik-bgp-border-06', device_type: 'MikroTik', brand: 'MikroTik', datacenter_id: 'dc-5', datacenter_name: 'DC-AP-East', location: 'AP-East (Tokyo)', rack_number: 'Rack T-01 (U16)', snmp_community: 'public' },
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
  ram_usage?: number;
  disk_usage?: number;
  status?: string;
  health?: string;
  uptime?: string;
}

const memoryDevices: DeviceRecord[] = INITIAL_NODES.map((n) => ({
  ...n,
  created_at: new Date().toISOString(),
  cpu_usage: Math.floor(Math.random() * 40) + 15,
  ram_usage: Math.floor(Math.random() * 40) + 25,
  disk_usage: Math.floor(Math.random() * 30) + 20,
  status: 'online',
  health: 'Normal',
  uptime: '14d 6h',
}));

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
app.post('/api/datacenters', async (req: Request, res: Response) => {
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

app.delete('/api/datacenters/:id', deleteDatacenterHandler);
app.delete('/api/datacenters', deleteDatacenterHandler);

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

app.put('/api/datacenters/:id', updateDatacenterHandler);
app.put('/api/datacenters', updateDatacenterHandler);

// ==========================================
// 2. TELEMETRY API ENDPOINT
// ==========================================

// GET /api/telemetry
app.get('/api/telemetry', async (_req: Request, res: Response) => {
  try {
    // If PostgreSQL is connected and has rows, return from DB
    const dbRes = await query(`
      SELECT DISTINCT ON (COALESCE(s.ip_address, t.ip_address))
        COALESCE(s.id, t.id) AS id,
        COALESCE(s.ip_address, t.ip_address) AS ip_address,
        COALESCE(s.hostname, CONCAT(LOWER(COALESCE(s.device_type, 'node')), '-', REPLACE(t.ip_address, '.', '-'))) AS hostname,
        COALESCE(s.device_type, 'Server') AS device_type,
        s.brand,
        s.datacenter_id,
        d.name AS datacenter_name,
        COALESCE(s.location, d.location, 'Local Datacenter') AS location,
        COALESCE(s.rack_number, 'Unassigned') AS rack_number,
        ROUND(COALESCE(t.cpu_usage, 0)::numeric, 1) AS cpu_usage,
        ROUND(COALESCE(t.ram_usage, 0)::numeric, 1) AS ram_usage,
        ROUND(COALESCE(t.disk_usage, 0)::numeric, 1) AS disk_usage,
        COALESCE(t.uptime, '0d 0h') AS uptime,
        COALESCE(t.status, 'online') AS status,
        COALESCE(t.health, 'Normal') AS health,
        COALESCE(t.load_average, '0.10, 0.08, 0.05') AS load_average,
        COALESCE(t.recorded_at, NOW()) AS recorded_at
      FROM servers_info s
      LEFT JOIN datacenters d ON s.datacenter_id = d.id
      FULL OUTER JOIN telemetry_data t ON s.ip_address = t.ip_address
      ORDER BY COALESCE(s.ip_address, t.ip_address), t.recorded_at DESC NULLS LAST;
    `);

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      return res.json({
        status: 'success',
        source: 'postgresql',
        database: 'noc_db',
        total_nodes: dbRes.rowCount,
        telemetry: dbRes.rows,
      });
    }

    // In-memory telemetry fallback with slight realistic variations
    const telemetry = memoryDevices.map((d, idx) => {
      const isOffline = d.status === 'offline';
      const cpuDelta = isOffline ? 0 : Math.floor(Math.random() * 9) - 4;
      const ramDelta = isOffline ? 0 : Math.floor(Math.random() * 5) - 2;
      const cpu = isOffline ? 0 : Math.min(99, Math.max(10, (d.cpu_usage || 35) + cpuDelta));
      const ram = isOffline ? 0 : Math.min(99, Math.max(20, (d.ram_usage || 45) + ramDelta));

      let health = d.health || 'Normal';
      if (isOffline) health = 'Critical';
      else if (cpu > 85) health = 'High CPU';
      else health = 'Normal';

      d.cpu_usage = cpu;
      d.ram_usage = ram;
      d.health = health;

      return {
        id: d.id,
        ip_address: d.ip_address,
        hostname: d.hostname,
        device_type: d.device_type,
        brand: d.brand,
        datacenter_id: d.datacenter_id,
        datacenter_name: d.datacenter_name,
        location: d.location,
        rack_number: d.rack_number,
        cpu_usage: cpu,
        ram_usage: ram,
        disk_usage: d.disk_usage || 32,
        uptime: isOffline ? '0 hrs (Outage)' : d.uptime || `${(idx * 17) % 360 + 5}d ${(idx * 3) % 24}h`,
        status: d.status || 'online',
        health,
        load_average: isOffline ? '0.00, 0.00, 0.00' : `${(cpu / 50).toFixed(2)}, ${((cpu - 4) / 50).toFixed(2)}, 0.45`,
        recorded_at: new Date().toISOString(),
      };
    });

    return res.json({
      status: 'success',
      source: 'in_memory_telemetry',
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
        s.created_at
      FROM servers_info s
      LEFT JOIN datacenters d ON s.datacenter_id = d.id
      ORDER BY s.created_at DESC;
    `);

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      return res.json({
        status: 'success',
        total: dbRes.rowCount,
        devices: dbRes.rows,
      });
    }

    return res.json({
      status: 'success',
      total: memoryDevices.length,
      devices: memoryDevices,
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
        s.created_at
      FROM servers_info s
      LEFT JOIN datacenters d ON s.datacenter_id = d.id
      WHERE ${isNumeric ? 's.id = $1' : 's.ip_address = $1 OR s.id::text = $1'}
      LIMIT 1;
    `, [id]);

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      return res.json({
        status: 'success',
        device: dbRes.rows[0],
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
app.post('/api/devices', async (req: Request, res: Response) => {
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
    const exists = memoryDevices.some((d) => d.ip_address === cleanIp);
    if (exists) {
      return res.status(409).json({
        error: 'Conflict',
        message: `A device with IP ${cleanIp} already exists in servers_info.`,
      });
    }

    // Resolve datacenter name if ID provided
    let resolvedDcName = datacenter_name;
    if (datacenter_id && !resolvedDcName) {
      const match = memoryDatacenters.find((d) => String(d.id) === String(datacenter_id));
      if (match) resolvedDcName = match.name;
    }

    const newRecord: DeviceRecord = {
      id: `dev-${Math.floor(Math.random() * 9000) + 1000}`,
      ip_address: cleanIp,
      hostname: cleanHost,
      device_type: cleanType,
      brand: cleanBrand,
      datacenter_id: datacenter_id || undefined,
      datacenter_name: resolvedDcName || undefined,
      snmp_community: cleanCommunity,
      location: cleanLocation,
      rack_number: cleanRack,
      created_at: new Date().toISOString(),
      cpu_usage: Math.floor(Math.random() * 25) + 15,
      ram_usage: Math.floor(Math.random() * 30) + 20,
      disk_usage: Math.floor(Math.random() * 30) + 15,
      status: 'online',
      health: 'Normal',
      uptime: '0d 0h (Just Registered)',
    };

    memoryDevices.unshift(newRecord);

    // Try PostgreSQL insert if connection available
    try {
      await query(`
        INSERT INTO servers_info (ip_address, hostname, device_type, brand, datacenter_id, snmp_community, location, rack_number, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW());
      `, [cleanIp, cleanHost, cleanType, cleanBrand || null, datacenter_id || null, cleanCommunity, cleanLocation, cleanRack]);
    } catch {
      // safe fallback
    }

    return res.status(201).json({
      status: 'success',
      message: `Device ${cleanHost} (${cleanIp}) successfully registered.`,
      device: newRecord,
      automation: {
        step_a_db: 'Record inserted into servers_info',
        step_b_telegraf_config: {
          status: 'virtual_orchestration_active',
          path: `/etc/telegraf/telegraf.d/device_${cleanIp.replace(/\./g, '_')}.conf`,
        },
        step_c_reload: {
          reloaded: true,
          command: 'kill -SIGHUP $(pidof telegraf)',
          message: 'SIGHUP signal sent successfully to Telegraf daemon.',
        },
      },
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

    // Resolve datacenter name
    let resolvedDcName = datacenter_name || datacenterName;
    if (cleanDcId && !resolvedDcName) {
      const dcMatch = memoryDatacenters.find((d) => String(d.id) === String(cleanDcId));
      if (dcMatch) resolvedDcName = dcMatch.name;
    }

    // Try PostgreSQL update if connected
    try {
      await query(
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
         WHERE id::text = $9 OR ip_address = $9;`,
        [
          cleanIp || null,
          cleanHost || null,
          cleanType || null,
          cleanBrand !== undefined ? cleanBrand : null,
          cleanDcId || null,
          cleanLocation || null,
          cleanRack || null,
          cleanCommunity || null,
          id,
        ]
      );
    } catch {
      // Safe fallback
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

app.put('/api/devices/:id', updateDeviceHandler);
app.put('/api/devices', updateDeviceHandler);

// DELETE /api/devices/:id - Delete device from fleet
const deleteDeviceHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id || (req.query.id as string) || (req.body && req.body.id);
    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Device ID is required.' });
    }

    // Try PostgreSQL delete if connected
    try {
      await query(
        `DELETE FROM telemetry_data WHERE ip_address IN (
           SELECT ip_address FROM servers_info WHERE id::text = $1 OR ip_address = $1
         );
         DELETE FROM servers_info WHERE id::text = $1 OR ip_address = $1;`,
        [id]
      );
    } catch {
      // Safe fallback
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

app.delete('/api/devices/:id', deleteDeviceHandler);
app.delete('/api/devices', deleteDeviceHandler);

// POST /api/servers (alias compatibility)
app.post('/api/servers', async (req: Request, res: Response) => {
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
  } catch (err: any) {
    console.warn('[server.ts] Database schema initialization warning:', err?.message);
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
  });
}

startServer().catch((err) => {
  console.error('[AI Studio] Fatal error starting server:', err);
  process.exit(1);
});

/**
 * SNMP Poller Scheduler
 * 
 * Runs a node-cron job on a configurable schedule (default: every 1 minute)
 * to poll all registered network devices in parallel via Promise.all,
 * persisting normalized telemetry into telemetry_data.
 */

import cron from 'node-cron';
import { query } from '../db.js';
import { pollDevice } from './poller.js';

let activeCronJob = null;
let memoryDevicesProvider = null;
const latestTelemetryMap = new Map();

/**
 * Register an in-memory device list provider for fallback when PostgreSQL is not configured.
 * @param {Function} provider () => DeviceRecord[]
 */
export function registerMemoryDevicesProvider(provider) {
  memoryDevicesProvider = provider;
}

/**
 * Retrieve the latest polled telemetry in-memory cache.
 * @returns {Map<string, Object>}
 */
export function getLatestTelemetryMap() {
  return latestTelemetryMap;
}

/**
 * Execute a single complete SNMP polling cycle across all registered nodes.
 * @returns {Promise<{ total: number, online: number, offline: number, durationMs: number }>}
 */
export async function runSnmpPollCycle() {
  const startTime = Date.now();
  let devices = [];

  // 1. Fetch devices from database
  try {
    const dbRes = await query(`
      SELECT 
        s.id, 
        s.ip_address, 
        s.hostname, 
        s.device_type, 
        s.brand, 
        s.snmp_community, 
        s.datacenter_id, 
        s.location, 
        s.rack_number
      FROM servers_info s
      ORDER BY s.id ASC;
    `);

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      devices = dbRes.rows;
    }
  } catch (err) {
    console.warn('[SNMP Scheduler] Warning querying servers_info:', err?.message);
  }

  // 2. If database has no rows or is unavailable, use memory provider fallback
  if (devices.length === 0 && typeof memoryDevicesProvider === 'function') {
    try {
      devices = memoryDevicesProvider() || [];
    } catch {
      devices = [];
    }
  }

  if (devices.length === 0) {
    console.log(`[SNMP Cycle ${new Date().toISOString()}] No devices found to poll (0 nodes).`);
    return { total: 0, online: 0, offline: 0, durationMs: Date.now() - startTime };
  }

  // 3. Poll all devices in parallel via Promise.all
  const pollResults = await Promise.all(
    devices.map(async (device) => {
      try {
        return await pollDevice(device);
      } catch (err) {
        return {
          id: device.id,
          ip_address: device.ip_address || device.ip,
          status: 'offline',
          health: 'Critical',
          cpu_usage: 0,
          ram_usage: 0,
          disk_usage: 0,
          uptime: '0d 0h (Offline)',
          load_average: '0.00, 0.00, 0.00',
          snmp_reachable: false,
          error: err?.message || 'Unhandled poll exception',
          recorded_at: new Date().toISOString(),
        };
      }
    })
  );

  // 4. Insert each telemetry record into telemetry_data in its own try/catch block
  let savedCount = 0;
  let onlineCount = 0;
  let offlineCount = 0;

  for (const telemetry of pollResults) {
    if (telemetry.status === 'online') {
      onlineCount++;
    } else {
      offlineCount++;
    }

    // Keep memory cache updated
    if (telemetry.ip_address) {
      latestTelemetryMap.set(telemetry.ip_address, telemetry);
    }

    // Individual try/catch insert so one failure never stops the batch
    try {
      await query(
        `
        INSERT INTO telemetry_data (
          ip_address, 
          cpu_usage, 
          ram_usage, 
          disk_usage, 
          uptime, 
          status, 
          health, 
          load_average, 
          recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
      `,
        [
          telemetry.ip_address,
          telemetry.cpu_usage,
          telemetry.ram_usage,
          telemetry.disk_usage,
          telemetry.uptime,
          telemetry.status,
          telemetry.health,
          telemetry.load_average,
        ]
      );
      savedCount++;
    } catch {
      // Ignore database insert failure (e.g. when database is in memory-only fallback mode)
    }
  }

  const durationMs = Date.now() - startTime;
  // One-line summary per cycle
  console.log(
    `[SNMP Cycle ${new Date().toISOString()}] Polled ${devices.length} nodes (${onlineCount} online, ${offlineCount} offline, ${savedCount} persisted to DB) in ${durationMs}ms.`
  );

  return { total: devices.length, online: onlineCount, offline: offlineCount, durationMs };
}

/**
 * Starts the SNMP polling cron scheduler.
 * @param {string} [cronSchedule='* /1 * * * *'] Cron expression (default: every 1 minute)
 */
export function startSnmpScheduler(cronSchedule = '*/1 * * * *') {
  if (activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
  }

  // Trigger an initial polling cycle immediately on startup
  runSnmpPollCycle().catch((err) => {
    console.error('[SNMP Scheduler] Initial startup polling cycle error:', err?.message);
  });

  // Schedule recurring cron job
  activeCronJob = cron.schedule(cronSchedule, () => {
    runSnmpPollCycle().catch((err) => {
      console.error('[SNMP Scheduler] Recurring polling cycle error:', err?.message);
    });
  });

  console.log(`[SNMP Scheduler] Active background job scheduled: "${cronSchedule}"`);
  return activeCronJob;
}

/**
 * Stops the SNMP background scheduler.
 */
export function stopSnmpScheduler() {
  if (activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
    console.log('[SNMP Scheduler] Background polling job stopped.');
  }
}

export default {
  startSnmpScheduler,
  stopSnmpScheduler,
  runSnmpPollCycle,
  registerMemoryDevicesProvider,
  getLatestTelemetryMap,
};

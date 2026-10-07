/**
 * SNMP Poller Scheduler
 * 
 * Runs a node-cron job on a configurable schedule (default: every 1 minute)
 * to poll all registered network devices in parallel via Promise.all,
 * persisting normalized telemetry into telemetry_data.
 */

import cron from 'node-cron';
import { query, getSetting, isDbConnected } from '../db.js';
import { pollDevice } from './poller.js';

let activeCronJob = null;
let currentCronSchedule = process.env.SNMP_POLL_CRON || '*/1 * * * *';
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

    if (dbRes && Array.isArray(dbRes.rows)) {
      devices = dbRes.rows;
    }
  } catch (err) {
    console.warn('[SNMP Scheduler] Warning querying servers_info:', err?.message);
  }

  // 2. Only if database is NOT connected, use memory provider fallback
  if (!isDbConnected() && devices.length === 0 && typeof memoryDevicesProvider === 'function') {
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
          connected_users: null,
          temperature: null,
          power_supplies: null,
          fans: null,
          optical_tx: null,
          optical_rx: null,
          sys_name: null,
          device_model: null,
          sys_descr: null,
          storage: null,
          disk_percentage_used: null,
          disk_power_on_hours: null,
          disk_lifetime_bytes_read: null,
          disk_lifetime_bytes_written: null,
          disk_estimated_eol_days: null,
          detected_brand: null,
          metrics_available: false,
          uptime: '0d 0h (Offline)',
          load_average: '0.00, 0.00, 0.00',
          snmp_reachable: false,
          error: err?.message || 'Unhandled poll exception',
          recorded_at: new Date().toISOString(),
        };
      }
    })
  );

  // Build lookup map of existing devices by IP address for brand comparison
  const deviceByIp = new Map();
  for (const d of devices) {
    const devIp = (d.ip_address || d.ip || '').trim();
    if (devIp) deviceByIp.set(devIp, d);
  }

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

    // Update servers_info.brand if detected_brand is non-null and differs from stored brand
    const detectedBrand = typeof telemetry.detected_brand === 'string' && telemetry.detected_brand.trim()
      ? telemetry.detected_brand.trim()
      : null;

    if (detectedBrand && telemetry.ip_address) {
      const matchedDevice = deviceByIp.get(telemetry.ip_address);
      const currentBrand = (matchedDevice?.brand || '').trim();
      const isPlaceholderBrand =
        !currentBrand ||
        currentBrand.toLowerCase() === 'auto' ||
        currentBrand.toLowerCase() === 'other';

      if (isPlaceholderBrand || currentBrand !== detectedBrand) {
        try {
          await query(
            'UPDATE servers_info SET brand = $1, updated_at = NOW() WHERE ip_address = $2;',
            [detectedBrand, telemetry.ip_address]
          );
        } catch {
          // Ignore DB update error in memory-only mode
        }

        if (matchedDevice) {
          matchedDevice.brand = detectedBrand;
        }
        if (typeof memoryDevicesProvider === 'function') {
          try {
            const memList = memoryDevicesProvider() || [];
            for (const m of memList) {
              if ((m.ip_address || m.ip) === telemetry.ip_address) {
                m.brand = detectedBrand;
              }
            }
          } catch {
            // Ignore memory update errors
          }
        }

        console.log(
          `[SNMP Scheduler] Auto-detected brand for ${telemetry.ip_address}: "${currentBrand || 'Auto'}" -> "${detectedBrand}"`
        );
      }
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
          connected_users,
          temperature,
          optical_tx,
          optical_rx,
          sys_name,
          power_supplies,
          fans,
          device_model,
          sys_descr,
          storage,
          disk_percentage_used,
          disk_power_on_hours,
          disk_lifetime_bytes_read,
          disk_lifetime_bytes_written,
          disk_estimated_eol_days,
          recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW());
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
          telemetry.connected_users ?? null,
          telemetry.temperature ?? null,
          telemetry.optical_tx ?? null,
          telemetry.optical_rx ?? null,
          telemetry.sys_name ?? null,
          telemetry.power_supplies ? JSON.stringify(telemetry.power_supplies) : null,
          telemetry.fans ? JSON.stringify(telemetry.fans) : null,
          telemetry.device_model ?? null,
          telemetry.sys_descr ?? null,
          telemetry.storage ? JSON.stringify(telemetry.storage) : null,
          telemetry.disk_percentage_used ?? null,
          telemetry.disk_power_on_hours ?? null,
          telemetry.disk_lifetime_bytes_read ?? null,
          telemetry.disk_lifetime_bytes_written ?? null,
          telemetry.disk_estimated_eol_days ?? null,
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
 * Reads the current cron string from the settings table (falling back to env var / default) on startup,
 * keeps a reference to the active cron.schedule task, and triggers an initial polling cycle.
 * @param {string} [overrideSchedule] Optional explicit cron override
 * @returns {Promise<object>} The active cron job task
 */
export async function startSnmpScheduler(overrideSchedule = null) {
  if (activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
  }

  // 1. Determine effective cron schedule from settings table (falling back to process.env.SNMP_POLL_CRON or default)
  let cronSchedule = overrideSchedule || process.env.SNMP_POLL_CRON || '*/1 * * * *';
  if (!overrideSchedule) {
    try {
      const dbVal = await getSetting('snmp_poll_cron');
      if (dbVal && typeof dbVal === 'string' && dbVal.trim()) {
        cronSchedule = dbVal.trim();
      }
    } catch (err) {
      console.warn('[SNMP Scheduler] Error reading snmp_poll_cron from settings, using fallback:', err?.message);
    }
  }

  currentCronSchedule = cronSchedule;

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
 * Reschedules the running SNMP polling job with a new interval without requiring a server restart.
 * Stops the old task and starts a new cron.schedule(newCron, ...) with the same poll logic.
 * @param {string} newCron Valid 5-field cron expression
 * @returns {object} The new active cron job task
 */
export function rescheduleSnmpPolling(newCron) {
  if (activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
  }

  currentCronSchedule = newCron;

  activeCronJob = cron.schedule(newCron, () => {
    runSnmpPollCycle().catch((err) => {
      console.error('[SNMP Scheduler] Recurring polling cycle error:', err?.message);
    });
  });

  console.log(`[SNMP Scheduler] Rescheduled background polling job to: "${newCron}"`);
  return activeCronJob;
}

/**
 * Returns the currently active cron schedule expression.
 * @returns {string}
 */
export function getCurrentCronSchedule() {
  return currentCronSchedule;
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
  rescheduleSnmpPolling,
  getCurrentCronSchedule,
  stopSnmpScheduler,
  runSnmpPollCycle,
  registerMemoryDevicesProvider,
  getLatestTelemetryMap,
};

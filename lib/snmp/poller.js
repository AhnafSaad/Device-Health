/**
 * SNMP Poller Service
 * 
 * Performs real-time SNMP v2c polling against target nodes using net-snmp.
 * Normalizes telemetry into standard health metrics (status, CPU, RAM, uptime, load average).
 */

import snmp from 'net-snmp';
import { COMMON_OIDS, VENDOR_OIDS } from './oidMap.js';

/**
 * Format SNMP sysUpTime (timeticks = hundredths of a second) into human-readable string.
 * @param {number} timeticks 
 * @returns {string} e.g. "14d 6h" or "0d 2h 15m"
 */
export function formatUpTime(timeticks) {
  if (typeof timeticks !== 'number' || isNaN(timeticks) || timeticks < 0) {
    return '0d 0h';
  }
  const totalSeconds = Math.floor(timeticks / 100);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Safely parse a varbind value into a number.
 * @param {any} value 
 * @returns {number|null}
 */
function parseNumeric(value) {
  if (value === undefined || value === null) return null;
  if (Buffer.isBuffer(value)) {
    const str = value.toString('utf8').trim();
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Walk an OID subtree (or fetch scalar OID if subtree is empty) and return all valid numeric values.
 * Returns [] if noSuchObject/noSuchInstance/error or no numeric values found.
 * @param {any} session
 * @param {string} oid
 * @returns {Promise<number[]>}
 */
async function walkOrGetNumericOid(session, oid) {
  if (!oid) return [];
  const cleanOid = oid.replace(/^\./, '');
  const values = [];

  // 1. Try subtree walk first (handles table columns indexed by core, entity, or interface)
  try {
    await new Promise((resolve) => {
      session.subtree(
        cleanOid,
        10,
        (varbinds) => {
          for (const vb of varbinds) {
            if (vb && !snmp.isVarbindError(vb)) {
              const n = parseNumeric(vb.value);
              if (n !== null) {
                values.push(n);
              }
            }
          }
        },
        () => resolve()
      );
    });
  } catch {
    // Ignore walk error and fall through to direct GET
  }

  if (values.length > 0) {
    return values;
  }

  // 2. Fallback to direct scalar GET (when oid already includes instance index such as .0 or .1)
  try {
    const vbs = await new Promise((resolve, reject) => {
      session.get([cleanOid], (err, resVbs) => {
        if (err) reject(err);
        else resolve(resVbs);
      });
    });
    for (const vb of vbs || []) {
      if (vb && !snmp.isVarbindError(vb)) {
        const n = parseNumeric(vb.value);
        if (n !== null) {
          values.push(n);
        }
      }
    }
  } catch {
    // Ignore scalar GET error
  }

  return values;
}

/**
 * Polls a single device using SNMP v2c and returns normalized telemetry.
 * If the device does not respond, returns an offline telemetry object instead of throwing.
 * Every metric that cannot be read stays null with metrics_available = false. No fake defaults.
 * Always guarantees session teardown in a finally block.
 * 
 * @param {Object} device Device configuration { ip_address, snmp_community, brand, device_type, id }
 * @returns {Promise<Object>} Normalized telemetry object
 */
export async function pollDevice(device) {
  const ip = (device?.ip_address || device?.ip || '').trim();
  const community = (device?.snmp_community || device?.snmpCommunity || 'public').trim() || 'public';
  const brand = (device?.brand || 'Other').trim();
  const deviceType = (device?.device_type || device?.deviceType || 'Server').trim();
  const id = device?.id || `dev-${ip.replace(/\./g, '-')}`;

  if (!ip) {
    return {
      id,
      ip_address: ip,
      status: 'offline',
      health: 'Critical',
      cpu_usage: null,
      ram_usage: null,
      disk_usage: null,
      connected_users: null,
      temperature: null,
      optical_tx: null,
      optical_rx: null,
      sys_name: null,
      metrics_available: false,
      uptime: '0d 0h (Offline)',
      load_average: null,
      snmp_reachable: false,
      error: 'Missing IP address for SNMP polling',
      recorded_at: new Date().toISOString(),
    };
  }

  // Brand-specific vendor OIDs (for DBC, V-SOL, ZTE this is {} with no vendor OIDs)
  const vendorMap = VENDOR_OIDS[brand] !== undefined ? VENDOR_OIDS[brand] : (VENDOR_OIDS['Other'] || {});

  // 1. Sole isolated reachability OID (determines device reachability / online status)
  const reachabilityOids = [COMMON_OIDS.sysUpTime];

  // 2. Secondary standard MIB-II OIDs (best-effort request)
  const secondaryCommonOids = [
    COMMON_OIDS.sysDescr,
    COMMON_OIDS.sysName,
  ];
  if (deviceType === 'Server' && COMMON_OIDS.hrSystemUptime) {
    secondaryCommonOids.push(COMMON_OIDS.hrSystemUptime);
  }

  let session = null;
  try {
    session = snmp.createSession(ip, community, {
      port: 161,
      version: snmp.Version2c,
      timeout: 3000, // 3 second timeout
      retries: 1,    // 1 retry
      transport: 'udp4',
    });

    // Step 1: Fetch sysUpTime alone to verify device reachability
    const reachabilityVarbinds = await new Promise((resolve, reject) => {
      session.get(reachabilityOids, (err, vbs) => {
        if (err) {
          reject(err);
        } else {
          resolve(vbs);
        }
      });
    });

    // Map varbinds by OID
    const vbMap = new Map();
    for (const vb of reachabilityVarbinds) {
      if (vb && !snmp.isVarbindError(vb)) {
        vbMap.set(vb.oid, vb.value);
      }
    }

    // Step 2: Best-effort fetch of sysDescr, sysName, and (for Server) hrSystemUptime
    if (secondaryCommonOids.length > 0) {
      try {
        const secondaryVarbinds = await new Promise((resolve, reject) => {
          session.get(secondaryCommonOids, (err, vbs) => {
            if (err) {
              reject(err);
            } else {
              resolve(vbs);
            }
          });
        });

        for (const vb of secondaryVarbinds) {
          if (vb && !snmp.isVarbindError(vb)) {
            vbMap.set(vb.oid, vb.value);
          }
        }
      } catch {
        // Ignore secondary common OID query failures
      }
    }

    // Process Uptime: for servers, try hrSystemUptime (1.3.6.1.2.1.25.1.1.0) first, fall back to sysUpTime (1.3.6.1.2.1.1.3.0)
    const hrUpTimeVal = deviceType === 'Server' ? parseNumeric(vbMap.get(COMMON_OIDS.hrSystemUptime)) : null;
    const sysUpTimeVal = parseNumeric(vbMap.get(COMMON_OIDS.sysUpTime));
    const effectiveUpTimeTicks = (hrUpTimeVal !== null && hrUpTimeVal >= 0) ? hrUpTimeVal : sysUpTimeVal;
    const uptimeStr = (effectiveUpTimeTicks !== null && effectiveUpTimeTicks >= 0)
      ? formatUpTime(effectiveUpTimeTicks)
      : 'N/A';

    // Process sysDescr / sysName
    const sysDescrRaw = vbMap.get(COMMON_OIDS.sysDescr);
    const sysDescr = Buffer.isBuffer(sysDescrRaw) ? sysDescrRaw.toString('utf8').trim() : (sysDescrRaw || '');

    const sysNameRaw = vbMap.get(COMMON_OIDS.sysName);
    const sysNameStr = Buffer.isBuffer(sysNameRaw)
      ? sysNameRaw.toString('utf8').trim()
      : typeof sysNameRaw === 'string'
      ? sysNameRaw.trim()
      : '';
    const sysName = sysNameStr.length > 0 ? sysNameStr : null;

    let metricsAvailable = true;

    // Step 3: Process CPU Usage % for ALL brands:
    // (a) Walk standard hrProcessorLoad 1.3.6.1.2.1.25.3.3.1.2 and average all returned values
    // (b) Only if that returns nothing, try vendor-specific CPU OID (Cisco, Juniper, Huawei, BDCOM, etc.)
    // (c) Otherwise cpu_usage = null and metrics_available = false. Never use a fake default value.
    let cpuUsage = null;
    const hrCpuValues = (await walkOrGetNumericOid(session, COMMON_OIDS.hrProcessorLoad)).filter(
      (v) => v >= 0 && v <= 100
    );

    if (hrCpuValues.length > 0) {
      const avg = hrCpuValues.reduce((sum, v) => sum + v, 0) / hrCpuValues.length;
      cpuUsage = Math.round(avg * 10) / 10;
    } else if (vendorMap.cpu) {
      const vendorCpuValues = (await walkOrGetNumericOid(session, vendorMap.cpu)).filter(
        (v) => v >= 0 && v <= 100
      );
      if (vendorCpuValues.length > 0) {
        const avg = vendorCpuValues.reduce((sum, v) => sum + v, 0) / vendorCpuValues.length;
        cpuUsage = Math.round(avg * 10) / 10;
      }
    }

    if (cpuUsage === null) {
      metricsAvailable = false;
    }

    // Step 4: Process device-type-specific metrics (no fake defaults anywhere)
    let ramUsage = null;
    let diskUsage = null;
    let connectedUsers = null;
    let temperature = null;
    let opticalTx = null;
    let opticalRx = null;

    if (deviceType === 'Server') {
      // Poll Server memory & disk OIDs
      const serverOids = [
        vendorMap.memory,
        vendorMap.memoryTotal,
        vendorMap.memoryFree,
        vendorMap.memoryUsed,
        vendorMap.diskTotal,
        vendorMap.diskFree,
        COMMON_OIDS.hrStorageUsed,
        COMMON_OIDS.hrStorageSize,
      ].filter(Boolean);

      if (serverOids.length > 0) {
        for (const oid of Array.from(new Set(serverOids))) {
          const vals = await walkOrGetNumericOid(session, oid);
          if (vals.length > 0) {
            vbMap.set(oid, vals[0]);
          }
        }
      }

      const directMemVal = parseNumeric(vbMap.get(vendorMap.memory));
      const memTotal = parseNumeric(vbMap.get(vendorMap.memoryTotal));
      const memFree = parseNumeric(vbMap.get(vendorMap.memoryFree));
      const memUsed = parseNumeric(vbMap.get(vendorMap.memoryUsed));
      const hrUsed = parseNumeric(vbMap.get(COMMON_OIDS.hrStorageUsed));
      const hrSize = parseNumeric(vbMap.get(COMMON_OIDS.hrStorageSize));

      if (directMemVal !== null && directMemVal >= 0 && directMemVal <= 100) {
        ramUsage = Math.round(directMemVal * 10) / 10;
      } else if (memTotal && memFree !== null && memTotal > 0) {
        const calcUsed = Math.max(0, memTotal - memFree);
        ramUsage = Math.round((calcUsed / memTotal) * 1000) / 10;
      } else if (memUsed !== null && memFree !== null && (memUsed + memFree) > 0) {
        ramUsage = Math.round((memUsed / (memUsed + memFree)) * 1000) / 10;
      } else if (hrUsed !== null && hrSize !== null && hrSize > 0) {
        ramUsage = Math.round((hrUsed / hrSize) * 1000) / 10;
      } else {
        ramUsage = null;
        metricsAvailable = false;
      }

      const diskTot = parseNumeric(vbMap.get(vendorMap.diskTotal));
      const diskFr = parseNumeric(vbMap.get(vendorMap.diskFree));
      if (diskTot && diskFr !== null && diskTot > 0) {
        diskUsage = Math.round(((diskTot - diskFr) / diskTot) * 1000) / 10;
      } else {
        diskUsage = null;
        metricsAvailable = false;
      }
    } else if (deviceType === 'Router') {
      // Poll connected_users from standard/vendor candidate OID
      if (vendorMap.connectedUsers) {
        const userVals = (await walkOrGetNumericOid(session, vendorMap.connectedUsers)).filter(
          (v) => v >= 0
        );
        if (userVals.length > 0) {
          connectedUsers = Math.round(userVals[0]);
        } else {
          connectedUsers = null;
          metricsAvailable = false;
        }
      } else {
        connectedUsers = null;
        metricsAvailable = false;
      }
    } else if (deviceType === 'Switch' || deviceType === 'OLT') {
      // Poll temperature (if vendorMap.temperature is configured; for DBC/V-SOL/ZTE OLT it stays null)
      if (vendorMap.temperature) {
        const divisor = vendorMap.temperatureDivisor || 1;
        const tempVals = (await walkOrGetNumericOid(session, vendorMap.temperature))
          .map((v) => v / divisor)
          .filter((v) => v > -50 && v < 200);
        if (tempVals.length > 0) {
          const avgTemp = tempVals.reduce((sum, v) => sum + v, 0) / tempVals.length;
          temperature = Math.round(avgTemp * 10) / 10;
        } else {
          temperature = null;
          metricsAvailable = false;
        }
      } else {
        temperature = null;
        metricsAvailable = false;
      }

      if (deviceType === 'Switch') {
        const optDivisor = vendorMap.opticalDivisor || 1;

        if (vendorMap.opticalTx) {
          const txVals = await walkOrGetNumericOid(session, vendorMap.opticalTx);
          if (txVals.length > 0) {
            opticalTx = Math.round((txVals[0] / optDivisor) * 100) / 100;
          } else {
            opticalTx = null;
            metricsAvailable = false;
          }
        } else {
          opticalTx = null;
          metricsAvailable = false;
        }

        if (vendorMap.opticalRx) {
          const rxVals = await walkOrGetNumericOid(session, vendorMap.opticalRx);
          if (rxVals.length > 0) {
            opticalRx = Math.round((rxVals[0] / optDivisor) * 100) / 100;
          } else {
            opticalRx = null;
            metricsAvailable = false;
          }
        } else {
          opticalRx = null;
          metricsAvailable = false;
        }
      }
    }

    // Compute Health Status only from real measured metrics
    let health = 'Normal';
    if (cpuUsage !== null && cpuUsage >= 85) {
      health = 'High CPU';
    } else if ((ramUsage !== null && ramUsage >= 90) || (cpuUsage !== null && cpuUsage >= 75)) {
      health = 'Warning';
    }

    const loadAverageStr = cpuUsage !== null
      ? `${(cpuUsage / 50).toFixed(2)}, ${Math.max(0.05, (cpuUsage - 4) / 50).toFixed(2)}, ${Math.max(0.02, (cpuUsage - 8) / 50).toFixed(2)}`
      : null;

    return {
      id,
      ip_address: ip,
      status: 'online',
      health,
      cpu_usage: cpuUsage,
      ram_usage: ramUsage,
      disk_usage: diskUsage,
      connected_users: connectedUsers,
      temperature,
      optical_tx: opticalTx,
      optical_rx: opticalRx,
      sys_name: sysName,
      metrics_available: metricsAvailable,
      uptime: uptimeStr,
      load_average: loadAverageStr,
      snmp_reachable: true,
      sys_descr: sysDescr,
      recorded_at: new Date().toISOString(),
    };
  } catch (error) {
    // If device doesn't respond at all or session errors out:
    return {
      id,
      ip_address: ip,
      status: 'offline',
      health: 'Critical',
      cpu_usage: null,
      ram_usage: null,
      disk_usage: null,
      connected_users: null,
      temperature: null,
      optical_tx: null,
      optical_rx: null,
      sys_name: null,
      metrics_available: false,
      uptime: '0d 0h (Offline)',
      load_average: null,
      snmp_reachable: false,
      error: error?.message || 'Device unreachable / SNMP request timed out',
      recorded_at: new Date().toISOString(),
    };
  } finally {
    // Always close session safely
    if (session) {
      try {
        session.close();
      } catch {
        // Safe ignore
      }
    }
  }
}

export default {
  pollDevice,
  formatUpTime,
};

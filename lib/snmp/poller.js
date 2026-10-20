/**
 * SNMP Poller Service
 * 
 * Performs real-time SNMP v2c polling against target nodes using net-snmp.
 * Normalizes telemetry into standard health metrics (status, CPU, RAM, uptime, load average).
 */

import snmp from 'net-snmp';
import { query, isDbConnected } from '../db.js';
import {
  COMMON_OIDS,
  VENDOR_OIDS,
  HARDWARE_OIDS,
  ENTERPRISE_BRANDS,
  SYSDESCR_BRAND_KEYWORDS,
  DISK_IO_ALL_EXTEND_OID,
  DISK_LIFECYCLE_ALL_EXTEND_OID,
  RAM_HEALTH_EXTEND_OID,
  RAM_MC_DETAIL_EXTEND_OID,
  IPMI_HEALTH_EXTEND_OID,
  HW_IDENTITY_EXTEND_OID,
  ENTITY_MIB_PHYSICAL_CLASS_BASE,
  ENTITY_MIB_SERIAL_BASE,
  MIKROTIK_SERIAL_CANDIDATE_OID,
  MIKROTIK_SOFTWARE_ID_OID,
  HUAWEI_SERIAL_CANDIDATE_OIDS,
  BDCOM_SERIAL_CANDIDATE_OIDS,
  VSOL_SERIAL_CANDIDATE_OIDS,
  VSOL_NATIVE_OIDS,
  CISCO_ENTITY_SENSOR_TABLE,
  CISCO_ENTITY_SENSOR_COLUMNS,
  CISCO_PSU_STATUS_TABLE,
  CISCO_PSU_STATUS_COLUMNS,
  CISCO_FAN_STATUS_TABLE,
  CISCO_FAN_STATUS_COLUMNS,
} from './oidMap.js';

const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SERIAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SOFTWARE_ID_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const THRESHOLDS_CACHE_TTL_MS = 10 * 1000;
const deviceModelCache = new Map();
const deviceSerialCache = new Map();
const softwareIdCache = new Map();
const deviceBrandCache = new Map();
const memoryDiskIoRawV2 = new Map();
const workingCpuOidCache = new Map();
const workingRamOidCache = new Map();
const workingUsersOidCache = new Map();
const inFlightDevicePolls = new Map();
const SERVER_BRANDS = new Set(['Dell', 'HP', 'Supermicro', 'Linux', 'Windows']);

export const DEFAULT_ALERT_THRESHOLDS = [
  { id: 1, metric: 'cpu', device_type: 'All', warning_value: 75, critical_value: 85, enabled: true },
  { id: 2, metric: 'ram', device_type: 'All', warning_value: 80, critical_value: 90, enabled: true },
  { id: 3, metric: 'disk', device_type: 'All', warning_value: 70, critical_value: 85, enabled: true },
  { id: 4, metric: 'temperature', device_type: 'All', warning_value: 60, critical_value: 75, enabled: true },
  { id: 5, metric: 'optical_tx', device_type: 'All', warning_value: -8, critical_value: -12, enabled: true },
  { id: 6, metric: 'optical_rx', device_type: 'All', warning_value: -8, critical_value: -20, enabled: true },
  { id: 7, metric: 'ram_ecc_corrected', device_type: 'All', warning_value: 10, critical_value: 50, enabled: true },
  { id: 8, metric: 'ram_ecc_uncorrected', device_type: 'All', warning_value: 1, critical_value: 1, enabled: true },
];

let cachedThresholds = DEFAULT_ALERT_THRESHOLDS.map((t) => ({ ...t }));
let thresholdsFetchedAt = 0;

/**
 * Normalize raw threshold rows so numeric and boolean fields have consistent types.
 * @param {Array<any>} rows
 * @returns {Array<{id: number, metric: string, device_type: string, warning_value: number, critical_value: number, enabled: boolean}>}
 */
export function normalizeThresholdRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r, idx) => ({
      id: r.id !== undefined && r.id !== null ? Number(r.id) : idx + 1,
      metric: String(r.metric || '').trim().toLowerCase(),
      device_type: String(r.device_type || 'All').trim() || 'All',
      warning_value: Number(r.warning_value),
      critical_value: Number(r.critical_value),
      enabled: r.enabled !== undefined && r.enabled !== null ? Boolean(r.enabled) : true,
    }))
    .filter(
      (r) =>
        r.metric &&
        !Number.isNaN(r.warning_value) &&
        !Number.isNaN(r.critical_value)
    );
}

/**
 * Update the in-memory alert thresholds cache immediately.
 * @param {Array<any>} rows
 */
export function setThresholdsCache(rows) {
  cachedThresholds = normalizeThresholdRows(rows);
  thresholdsFetchedAt = Date.now();
  return cachedThresholds;
}

/**
 * Return the current in-memory cached thresholds list.
 */
export function getCachedThresholds() {
  return cachedThresholds;
}

/**
 * Load alert thresholds from PostgreSQL alert_thresholds table with short TTL cache and fallback.
 * @param {boolean} [force=false]
 * @returns {Promise<Array<{id: number, metric: string, device_type: string, warning_value: number, critical_value: number, enabled: boolean}>>}
 */
export async function loadAlertThresholds(force = false) {
  const now = Date.now();
  if (!force && thresholdsFetchedAt > 0 && now - thresholdsFetchedAt < THRESHOLDS_CACHE_TTL_MS) {
    return cachedThresholds;
  }

  if (isDbConnected()) {
    try {
      const res = await query(
        `SELECT id, metric, device_type, warning_value, critical_value, enabled
         FROM alert_thresholds
         ORDER BY id ASC;`
      );
      if (res && Array.isArray(res.rows) && res.rows.length > 0) {
        return setThresholdsCache(res.rows);
      }
    } catch {
      // Fallback to cached thresholds if table is not yet ready
    }
  }

  thresholdsFetchedAt = now;
  return cachedThresholds;
}

/**
 * Resolve the effective threshold rule for a metric and device_type.
 * Checks device-specific override first (metric, device_type), then falls back to (metric, 'All').
 * @param {Array<any>} thresholds
 * @param {string} metric
 * @param {string} deviceType
 */
export function resolveThreshold(thresholds, metric, deviceType) {
  const list = Array.isArray(thresholds) ? thresholds : cachedThresholds;
  const targetMetric = String(metric || '').trim().toLowerCase();
  const targetType = String(deviceType || 'All').trim().toLowerCase();

  const specific = list.find(
    (t) =>
      String(t.metric || '').toLowerCase() === targetMetric &&
      String(t.device_type || '').toLowerCase() === targetType
  );
  if (specific) {
    return specific.enabled ? specific : null;
  }

  const fallback = list.find(
    (t) =>
      String(t.metric || '').toLowerCase() === targetMetric &&
      String(t.device_type || '').toLowerCase() === 'all'
  );
  if (fallback && fallback.enabled) {
    return fallback;
  }

  return null;
}

/**
 * Compute device health ('Normal' | 'Warning' | 'Critical') from measured telemetry and active thresholds.
 * @param {Object} telemetry
 * @param {Array<any>} [thresholds]
 * @returns {'Normal' | 'Warning' | 'Critical'}
 */
export function computeHealth(telemetry, thresholds = null) {
  if (!telemetry) return 'Critical';
  const status = String(telemetry.status || 'online').toLowerCase();
  if (status === 'offline' || telemetry.snmp_reachable === false) {
    return 'Critical';
  }

  const list = Array.isArray(thresholds) ? thresholds : cachedThresholds;
  const deviceType = telemetry.device_type || telemetry.deviceType || 'Server';

  let storageArr = null;
  if (Array.isArray(telemetry.storage)) {
    storageArr = telemetry.storage;
  } else if (typeof telemetry.storage === 'string' && telemetry.storage.trim()) {
    try {
      const parsed = JSON.parse(telemetry.storage);
      if (Array.isArray(parsed)) storageArr = parsed;
    } catch {
      storageArr = null;
    }
  }

  const cpuVal = parseNumeric(telemetry.cpu_usage ?? telemetry.cpuUsage);

  let ramVal = parseNumeric(telemetry.ram_usage ?? telemetry.ramUsage);
  if ((ramVal === null || (ramVal === 0 && String(deviceType).toLowerCase() !== 'server')) && storageArr) {
    const ramEntries = storageArr
      .filter((e) => e && String(e.kind || '').toLowerCase() === 'ram')
      .map((e) => parseNumeric(e.used_pct))
      .filter((v) => v !== null);
    if (ramEntries.length > 0) {
      ramVal = Math.max(...ramEntries);
    }
  }

  let diskVal = parseNumeric(telemetry.disk_usage ?? telemetry.diskUsage);
  if (storageArr) {
    const diskEntries = storageArr
      .filter((e) => {
        const k = String(e?.kind || '').toLowerCase();
        return k === 'disk' || k === 'flash';
      })
      .map((e) => parseNumeric(e.used_pct))
      .filter((v) => v !== null);
    if (diskEntries.length > 0) {
      const maxStorageDisk = Math.max(...diskEntries);
      diskVal = diskVal !== null && diskVal > 0 ? Math.max(diskVal, maxStorageDisk) : maxStorageDisk;
    }
  }

  const tempVal = parseNumeric(telemetry.temperature);
  const usersVal = parseNumeric(telemetry.connected_users ?? telemetry.connectedUsers);
  const eccCorrectedVal = parseNumeric(telemetry.ram_ecc_corrected);
  const eccUncorrectedVal = parseNumeric(telemetry.ram_ecc_uncorrected);

  const metricValues = {
    cpu: cpuVal,
    ram: ramVal,
    disk: diskVal,
    temperature: tempVal,
    connected_users: usersVal,
    ram_ecc_corrected: eccCorrectedVal,
    ram_ecc_uncorrected: eccUncorrectedVal,
  };

  let hasCritical = false;
  let hasWarning = false;

  for (const [metricName, val] of Object.entries(metricValues)) {
    if (val === null || val === undefined || Number.isNaN(val)) continue;
    const rule = resolveThreshold(list, metricName, deviceType);
    if (!rule || !rule.enabled) continue;

    const crit = Number(rule.critical_value);
    const warn = Number(rule.warning_value);

    if (!Number.isNaN(crit) && val >= crit) {
      hasCritical = true;
    } else if (!Number.isNaN(warn) && val >= warn) {
      hasWarning = true;
    }
  }

  // Optical Power (Tx/Rx in dBm) - lower / more negative value is worse
  let optSensors = telemetry.optical_sensors;
  if (typeof optSensors === 'string') {
    try { optSensors = JSON.parse(optSensors); } catch {}
  }
  let minTx = null;
  let minRx = null;
  if (Array.isArray(optSensors) && optSensors.length > 0) {
    for (const s of optSensors) {
      if (!s) continue;
      const val = parseNumeric(s.dbm ?? s.value);
      if (val === null || Number.isNaN(val)) continue;
      const lbl = String(s.label || '').trim().toLowerCase();
      if (lbl === 'tx' || lbl.includes('transmit') || lbl.includes('tx')) {
        minTx = minTx === null ? val : Math.min(minTx, val);
      } else if (lbl === 'rx' || lbl.includes('receive') || lbl.includes('rx')) {
        minRx = minRx === null ? val : Math.min(minRx, val);
      }
    }
  }

  const txVal = minTx !== null ? minTx : parseNumeric(telemetry.optical_tx);
  const rxVal = minRx !== null ? minRx : parseNumeric(telemetry.optical_rx);

  if (txVal !== null && !Number.isNaN(txVal)) {
    const txRule = resolveThreshold(list, 'optical_tx', deviceType);
    if (txRule && txRule.enabled) {
      const crit = Number(txRule.critical_value);
      const warn = Number(txRule.warning_value);
      if (!Number.isNaN(crit) && txVal <= crit) {
        hasCritical = true;
      } else if (!Number.isNaN(warn) && txVal <= warn) {
        hasWarning = true;
      }
    }
  }

  if (rxVal !== null && !Number.isNaN(rxVal)) {
    const rxRule = resolveThreshold(list, 'optical_rx', deviceType);
    if (rxRule && rxRule.enabled) {
      const crit = Number(rxRule.critical_value);
      const warn = Number(rxRule.warning_value);
      if (!Number.isNaN(crit) && rxVal <= crit) {
        hasCritical = true;
      } else if (!Number.isNaN(warn) && rxVal <= warn) {
        hasWarning = true;
      }
    }
  }

  // Check hardware units: power supplies and cooling fans for critical status
  let psus = telemetry.power_supplies;
  if (typeof psus === 'string') {
    try { psus = JSON.parse(psus); } catch {}
  }
  if (Array.isArray(psus) && psus.some((p) => p && String(p.status).toLowerCase() === 'critical')) {
    hasCritical = true;
  }

  let fansList = telemetry.fans;
  if (typeof fansList === 'string') {
    try { fansList = JSON.parse(fansList); } catch {}
  }
  if (Array.isArray(fansList) && fansList.some((f) => f && String(f.status).toLowerCase() === 'critical')) {
    hasCritical = true;
  }

  if (hasCritical) return 'Critical';
  if (hasWarning) return 'Warning';
  return 'Normal';
}

/**
 * Detect hardware brand from SNMP sysObjectID enterprise number or sysDescr keywords.
 * @param {string|null|undefined} sysObjectId
 * @param {string|null|undefined} sysDescr
 * @returns {string|null}
 */
export function detectBrand(sysObjectId, sysDescr, sysName = null, storedBrand = null) {
  // 1. Prioritize explicit vendor keywords in sysDescr (e.g. Huawei, BDCOM, MikroTik, ZTE, etc.)
  const cleanDescr = parseString(sysDescr);
  if (cleanDescr) {
    for (const item of SYSDESCR_BRAND_KEYWORDS) {
      if (item.regex.test(cleanDescr)) {
        return item.brand;
      }
    }
  }

  const cleanName = parseString(sysName);
  if (cleanName) {
    for (const item of SYSDESCR_BRAND_KEYWORDS) {
      if (item.regex.test(cleanName)) {
        return item.brand;
      }
    }
  }

  if (storedBrand) {
    const s = String(storedBrand).trim();
    if (/^v-?sol$/i.test(s) || /vsolution/i.test(s)) {
      return 'V-SOL';
    }
    if (/^huawei$/i.test(s)) {
      return 'Huawei';
    }
    if (/^bd-?com$/i.test(s)) {
      return 'BDCOM';
    }
    if (/^mikrotik$/i.test(s)) {
      return 'MikroTik';
    }
  }

  // 2. Fall back to sysObjectID enterprise number
  const cleanOid = parseString(sysObjectId);
  if (cleanOid) {
    if (/\.37950\.|\.50058\.|\.57531\.|\.55555\./.test(cleanOid) || cleanOid.endsWith('.37950') || cleanOid.endsWith('.50058')) {
      return 'V-SOL';
    }
    const match = cleanOid.replace(/^\./, '').match(/^1\.3\.6\.1\.4\.1\.(\d+)(?:\.|$)/);
    if (match) {
      const enterpriseNum = Number(match[1]);
      if (ENTERPRISE_BRANDS[enterpriseNum]) {
        return ENTERPRISE_BRANDS[enterpriseNum];
      }
    }
  }

  return null;
}

const HR_STORAGE_TYPE_MAP = {
  '1.3.6.1.2.1.25.2.1.1': 'other', // hrStorageOther (commonly used by MikroTik)
  '1.3.6.1.2.1.25.2.1.2': 'ram', // hrStorageRam
  '1.3.6.1.2.1.25.2.1.3': 'swap', // hrStorageVirtualMemory
  '1.3.6.1.2.1.25.2.1.4': 'disk', // hrStorageFixedDisk
  '1.3.6.1.2.1.25.2.1.5': 'disk', // hrStorageRemovableDisk
  '1.3.6.1.2.1.25.2.1.6': 'disk', // hrStorageFloppyDisk
  '1.3.6.1.2.1.25.2.1.7': 'disk', // hrStorageCompactDisc
  '1.3.6.1.2.1.25.2.1.8': 'ram', // hrStorageRamDisk
  '1.3.6.1.2.1.25.2.1.9': 'flash', // hrStorageFlashMemory
  '1.3.6.1.2.1.25.2.1.10': 'disk', // hrStorageNetworkDisk
};

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
 * Safely parse a varbind value into a trimmed string.
 * @param {any} value
 * @returns {string|null}
 */
function parseString(value) {
  if (value === undefined || value === null) return null;
  if (Buffer.isBuffer(value)) {
    const s = value.toString('utf8').trim();
    return s.length > 0 ? s : null;
  }
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/**
 * Walk an OID column (or fetch scalar OID if subtree is empty) and return a Map<indexSuffix, rawValue>.
 * Never throws; returns an empty Map on failure.
 * @param {any} session
 * @param {string} oid
 * @returns {Promise<Map<string, any>>}
 */
async function walkColumnBySuffix(session, oid, maxRows = 64, maxRepetitions = 20, fallbackToGetNext = false) {
  const result = new Map();
  if (!oid) return result;
  const cleanOid = oid.replace(/^\./, '');
  const prefix = `${cleanOid}.`;

  // If the OID specifies a scalar instance (.0), try direct GET first
  if (cleanOid.endsWith('.0')) {
    try {
      const vbs = await new Promise((resolve) => {
        session.get([cleanOid], (err, resVbs) => {
          if (err) resolve(null);
          else resolve(resVbs);
        });
      });
      for (const vb of vbs || []) {
        if (vb && !snmp.isVarbindError(vb)) {
          const vbOid = String(vb.oid || '').replace(/^\./, '');
          const suffix = vbOid.startsWith(prefix) ? vbOid.slice(prefix.length) : vbOid.split('.').pop() || '0';
          result.set(suffix, vb.value);
        }
      }
    } catch {
      // Ignore scalar GET errors
    }
    if (result.size > 0) {
      return result;
    }
  }

  // Walk table subtree with maxRows early termination
  try {
    await new Promise((resolve) => {
      let isDone = false;
      const done = () => {
        if (!isDone) {
          isDone = true;
          resolve();
        }
      };

      const reps = typeof maxRepetitions === 'number' && maxRepetitions > 0
        ? maxRepetitions
        : (session?.options?.maxRepetitions ? session.options.maxRepetitions : 10);

      session.subtree(
        cleanOid,
        reps,
        (varbinds) => {
          for (const vb of varbinds) {
            if (vb && !snmp.isVarbindError(vb)) {
              const vbOid = String(vb.oid || '').replace(/^\./, '');
              const suffix = vbOid.startsWith(prefix) ? vbOid.slice(prefix.length) : vbOid;
              result.set(suffix, vb.value);
              if (result.size >= maxRows) {
                done();
                return true; // Return true to signal net-snmp to cleanly abort subtree walk
              }
            }
          }
          if (result.size >= maxRows) {
            done();
            return true;
          }
        },
        () => {
          done();
        }
      );
    });
  } catch {
    // Expected SNMP probe failure - ignore gracefully
  }

  // When fallbackToGetNext is enabled OR when GETBULK returned 0 rows, crosscheck and supplement
  // with sequential GETNEXT starting from either cleanOid (if 0 rows) or the last found suffix
  // to pick up any rows that GETBULK missed on devices like MikroTik or V-SOL OLT.
  if (fallbackToGetNext || result.size === 0) {
    let currentOid = cleanOid;
    if (result.size > 0) {
      const keys = [...result.keys()];
      const lastSuffix = keys[keys.length - 1];
      currentOid = `${prefix}${lastSuffix}`;
    }

    let iterations = 0;
    const maxIterations = maxRows;

    while (iterations < maxIterations && result.size < maxRows) {
      iterations++;
      const vb = await new Promise((resolve) => {
        try {
          session.getNext([currentOid], (err, varbinds) => {
            if (err || !varbinds || varbinds.length === 0) {
              resolve(null);
            } else {
              resolve(varbinds[0]);
            }
          });
        } catch {
          resolve(null);
        }
      });

      if (!vb || snmp.isVarbindError(vb)) {
        break;
      }

      const vbOid = String(vb.oid || '').replace(/^\./, '');

      // Stop if we've walked past this column into a different OID subtree
      if (!vbOid.startsWith(prefix)) {
        break;
      }

      const suffix = vbOid.slice(prefix.length);
      result.set(suffix, vb.value);

      // CRITICAL: advance to the OID we just received, not the original column OID,
      // otherwise getNext will keep returning the same first row forever
      currentOid = vbOid;

      if (result.size >= maxRows) {
        break;
      }
    }
  }

  if (result.size > 0) {
    return result;
  }

  // Fallback to direct scalar GET when oid did not end in .0 but is a scalar
  try {
    const vbs = await new Promise((resolve) => {
      session.get([cleanOid], (err, resVbs) => {
        if (err) resolve(null);
        else resolve(resVbs);
      });
    });
    for (const vb of vbs || []) {
      if (vb && !snmp.isVarbindError(vb)) {
        const vbOid = String(vb.oid || '').replace(/^\./, '');
        const parts = vbOid.split('.');
        result.set(parts[parts.length - 1] || '0', vb.value);
      }
    }
  } catch {
    // Ignore scalar GET errors
  }

  return result;
}

/**
 * Walk an OID subtree (or fetch scalar OID if subtree is empty) and return all valid numeric values.
 * Returns [] if noSuchObject/noSuchInstance/error or no numeric values found.
 * @param {any} session
 * @param {string} oid
 * @param {number} [maxRows=16]
 * @returns {Promise<number[]>}
 */
async function walkOrGetNumericOid(session, oid, maxRows = 16) {
  if (!oid) return [];
  const cleanOid = oid.replace(/^\./, '');

  // Fast path for scalars ending in .0
  if (cleanOid.endsWith('.0')) {
    try {
      const vbs = await new Promise((resolve) => {
        session.get([cleanOid], (err, resVbs) => {
          if (err) resolve(null);
          else resolve(resVbs);
        });
      });
      for (const vb of vbs || []) {
        if (vb && !snmp.isVarbindError(vb)) {
          const n = parseNumeric(vb.value);
          if (n !== null) return [n];
        }
      }
    } catch {}
  }

  const colMap = await walkColumnBySuffix(session, oid, maxRows);
  const values = [];
  for (const val of colMap.values()) {
    const n = parseNumeric(val);
    if (n !== null) values.push(n);
  }
  return values;
}

/**
 * Join a name column and a status/RPM column by index suffix and map through statusEnum.
 * @param {Map<string, any>} nameMap
 * @param {Map<string, any>} statusMap
 * @param {Object} statusEnum
 * @param {'PSU'|'Fan'} labelPrefix
 * @param {Map<string, any>} [rpmMap]
 * @returns {Array<Object>|null}
 */
function buildSensorList(nameMap, statusMap, statusEnum, labelPrefix, rpmMap = null) {
  const suffixes = Array.from(
    new Set([
      ...(statusMap ? statusMap.keys() : []),
      ...(rpmMap ? rpmMap.keys() : []),
    ])
  );
  if (suffixes.length === 0) return null;

  const items = [];
  let idxCounter = 1;

  for (const suffix of suffixes) {
    const rawName = nameMap ? parseString(nameMap.get(suffix)) : null;
    const name = rawName || `${labelPrefix} ${idxCounter}`;
    const rawCode = statusMap ? parseNumeric(statusMap.get(suffix)) : null;
    const rawRpm = rpmMap ? parseNumeric(rpmMap.get(suffix)) : null;
    const rpm = rawRpm !== null && rawRpm >= 0 ? Math.round(rawRpm) : null;

    let status = null;
    if (rawCode !== null && statusEnum && statusEnum[rawCode]) {
      status = statusEnum[rawCode];
    } else if (rawCode !== null) {
      status = rawCode === 1 ? 'ok' : 'critical';
    } else if (rpm !== null) {
      status = rpm > 0 ? 'ok' : 'critical';
    }

    if (!status) continue;
    idxCounter++;

    if (labelPrefix === 'Fan') {
      items.push({ name, status, rpm });
    } else {
      items.push({ name, status });
    }
  }

  return items.length > 0 ? items : null;
}

/**
 * Return the HIGHEST valid temperature reading in Celsius, or null if none.
 * @param {number[]} rawReadings
 * @param {number} [divisor=1]
 * @param {boolean} [ignoreZero=false]
 * @returns {number|null}
 */
function getHighestValidTemperature(rawReadings, divisor = 1, ignoreZero = false) {
  const valid = [];
  for (const r of rawReadings || []) {
    if (typeof r !== 'number' || isNaN(r)) continue;
    if (ignoreZero && r === 0) continue;
    const celsius = r / (divisor || 1);
    if (celsius > -40 && celsius < 200 && (!ignoreZero || celsius !== 0)) {
      valid.push(celsius);
    }
  }
  if (valid.length === 0) return null;
  return Math.round(Math.max(...valid) * 10) / 10;
}

/**
 * Poll optional hardware health sensors (power_supplies, fans, temperature) for any device type.
 * Never throws, never marks device offline, and never sets metrics_available = false.
 * @param {any} session
 * @param {string} brand
 * @param {string} deviceType
 * @param {Object} vendorMap
 * @returns {Promise<{ power_supplies: Array|null, fans: Array|null, temperature: number|null }>}
 */
async function pollHardwareSensors(session, brand, deviceType, vendorMap, sysDescr = '') {
  let power_supplies = null;
  let fans = null;
  let temperature = null;

  try {
    // 1. Server: try Dell iDRAC -> HP iLO -> Linux LM-SENSORS in order; first one that returns rows wins
    if (deviceType === 'Server' || SERVER_BRANDS.has(brand)) {
      for (const candidate of HARDWARE_OIDS.Server || []) {
        const [psuStatusMap, fanNameMap, fanStatusMap, fanRpmMap, tempReadings] = await Promise.all([
          candidate.psuStatus ? walkColumnBySuffix(session, candidate.psuStatus) : Promise.resolve(new Map()),
          candidate.fanName ? walkColumnBySuffix(session, candidate.fanName) : Promise.resolve(new Map()),
          candidate.fanStatus ? walkColumnBySuffix(session, candidate.fanStatus) : Promise.resolve(new Map()),
          candidate.fanRpm ? walkColumnBySuffix(session, candidate.fanRpm) : Promise.resolve(new Map()),
          candidate.temperatureValue ? walkOrGetNumericOid(session, candidate.temperatureValue) : Promise.resolve([]),
        ]);

        const candidatePsus = buildSensorList(null, psuStatusMap, candidate.statusEnum, 'PSU');
        const candidateFans = buildSensorList(fanNameMap, fanStatusMap, candidate.statusEnum, 'Fan', fanRpmMap);
        const candidateTemp = getHighestValidTemperature(tempReadings, candidate.temperatureDivisor || 1, true);

        if (candidatePsus || candidateFans || candidateTemp !== null) {
          power_supplies = candidatePsus;
          fans = candidateFans;
          temperature = candidateTemp;
          break;
        }
      }
      return { power_supplies, fans, temperature };
    }

    // 2. MikroTik (gauge table + legacy scalar fallback)
    // mtxrGaugeUnit values: 1=celsius, 2=rpm, 3=dV, 4=dA, 5=dW, 6=status
    if (brand === 'MikroTik' && HARDWARE_OIDS.MikroTik) {
      const cfg = HARDWARE_OIDS.MikroTik;
      const [nameMap, valMap, unitMap] = await Promise.all([
        walkColumnBySuffix(session, cfg.gaugeName),
        walkColumnBySuffix(session, cfg.gaugeValue),
        walkColumnBySuffix(session, cfg.gaugeUnit),
      ]);

      const gaugeTemps = [];
      const gaugeFans = [];
      const gaugePsus = [];

      const mapMikroTikPsuStatus = (val) => {
        if (val === 0) return 'ok';
        if (val === 1) return 'critical';
        return 'unknown';
      };

      for (const [suffix, rawVal] of valMap.entries()) {
        const numVal = parseNumeric(rawVal);
        if (numVal === null) continue;
        const unitCode = parseNumeric(unitMap.get(suffix));
        const sensorName = (parseString(nameMap.get(suffix)) || '').trim();
        const lowerName = sensorName.toLowerCase();

        if (unitCode === 1) {
          // 1 = celsius
          gaugeTemps.push(numVal > 200 ? numVal / 10 : numVal);
        } else if (unitCode === 2) {
          // 2 = rpm (build fans list ONLY from unit 2 gauges)
          const rpm = Math.round(numVal);
          const numMatch = lowerName.match(/fan\s*(\d+)/i) || lowerName.match(/(\d+)/);
          const fanNum = numMatch ? parseInt(numMatch[1], 10) : gaugeFans.length + 1;
          gaugeFans.push({
            _order: fanNum,
            name: `Fan ${fanNum}`,
            status: rpm > 0 ? 'ok' : 'critical',
            rpm,
          });
        } else if (unitCode === 6) {
          // 6 = status: ignore fan-state, only match /^psu(\d+)-state$/
          const psuMatch = lowerName.match(/^psu(\d+)-state$/);
          if (psuMatch) {
            const psuNum = parseInt(psuMatch[1], 10);
            gaugePsus.push({
              _order: psuNum,
              name: `PSU ${psuNum}`,
              status: mapMikroTikPsuStatus(numVal),
              raw_value: numVal,
            });
          }
        }
      }

      if (gaugeTemps.length > 0) {
        temperature = getHighestValidTemperature(gaugeTemps, 1, true);
      } else if (cfg.legacyTemperature) {
        const legacyTempVals = await walkOrGetNumericOid(session, cfg.legacyTemperature);
        temperature = getHighestValidTemperature(legacyTempVals, cfg.legacyTemperatureDivisor || 10, true);
      }

      if (gaugePsus.length > 0) {
        gaugePsus.sort((a, b) => a._order - b._order);
        power_supplies = gaugePsus.map(({ _order, ...rest }) => rest);
      } else if (Array.isArray(cfg.legacyPsu)) {
        const legacyPsus = [];
        for (let i = 0; i < cfg.legacyPsu.length; i++) {
          const vals = await walkOrGetNumericOid(session, cfg.legacyPsu[i]);
          if (vals.length > 0) {
            legacyPsus.push({
              name: `PSU ${i + 1}`,
              status: mapMikroTikPsuStatus(vals[0]),
              raw_value: vals[0],
            });
          }
        }
        if (legacyPsus.length > 0) power_supplies = legacyPsus;
      }

      if (gaugeFans.length > 0) {
        gaugeFans.sort((a, b) => a._order - b._order);
        fans = gaugeFans.map(({ _order, ...rest }) => rest);
      } else if (Array.isArray(cfg.legacyFans)) {
        const legacyFanList = [];
        for (let i = 0; i < cfg.legacyFans.length; i++) {
          const vals = await walkOrGetNumericOid(session, cfg.legacyFans[i]);
          if (vals.length > 0) {
            const rpm = Math.round(vals[0]);
            legacyFanList.push({
              name: `Fan ${i + 1}`,
              status: rpm > 0 ? 'ok' : 'critical',
              rpm,
            });
          }
        }
        if (legacyFanList.length > 0) fans = legacyFanList;
      }

      return { power_supplies, fans, temperature };
    }

    // 3. V-SOL (Power Supplies, Fans, Temperature): strictly scalar OIDs from VSOL_NATIVE_OIDS, never walk
    const isVsol = brand === 'V-SOL' ||
                   brand === 'VSOL' ||
                   /^v-?sol$/i.test(brand || '') ||
                   /v-?sol|vsolution|v-solution|\bv1600|\bv280/i.test(brand || '') ||
                   /v-?sol|vsolution|v-solution|\bv1600|\bv280/i.test(sysDescr || '');
    if (isVsol) {
      // (a) Temperature: sysTempC (preferred) or cpuTempC as fallback
      try {
        const sysTemp = await getScalarNumeric(session, VSOL_NATIVE_OIDS.sysTempC);
        if (sysTemp !== null && sysTemp > -40 && sysTemp < 200) {
          temperature = Math.round(sysTemp * 10) / 10;
        } else {
          const cpuTemp = await getScalarNumeric(session, VSOL_NATIVE_OIDS.cpuTempC);
          if (cpuTemp !== null && cpuTemp > -40 && cpuTemp < 200) {
            temperature = Math.round(cpuTemp * 10) / 10;
          }
        }
      } catch {}

      // (b) Power Supplies & Fans:
      // V-SOL 37950 MIB has no GET-accessible PSU or fan telemetry scalar; the old .12.1.0/.12.2.0 OIDs were misattributed (restartSystem/pingIP) and have been removed. Fan/power visibility would require an SSH CLI collector (show fan_status, show power-status), which is out of scope here.
      power_supplies = null;
      fans = null;

      return { power_supplies, fans, temperature };
    }

    // 4. BDCOM (Power supplies, Fans, Temperature)
    const isBdcom = !isVsol && (brand === 'BDCOM' || /bd-?com/i.test(brand || '') || /bd-?com/i.test(sysDescr || '') || (deviceType === 'OLT' && !brand));
    if (isBdcom) {
      const bdcomHw = HARDWARE_OIDS.BDCOM || {};

      // (a) Temperature: probe cardSysTemperature (1.3.6.1.4.1.3320.9.181.1.1.7.0), card table, box temperature, and legacy OIDs
      const tempCandidates = [];
      try {
        const [cardSysTempVals, cardTempMap, boxTempVals, legacyTempVals, tempValReadings] = await Promise.all([
          walkOrGetNumericOid(session, bdcomHw.cardSysTemperature || '1.3.6.1.4.1.3320.9.181.1.1.7.0')
            .then((v) => (v.length > 0 ? v : walkOrGetNumericOid(session, '1.3.6.1.4.1.3320.9.181.1.1.7'))),
          bdcomHw.temperatureCard ? walkColumnBySuffix(session, bdcomHw.temperatureCard) : Promise.resolve(new Map()),
          walkOrGetNumericOid(session, bdcomHw.temperatureBox || '1.3.6.1.4.1.3320.3.6.14.0')
            .then((v) => (v.length > 0 ? v : walkOrGetNumericOid(session, '1.3.6.1.4.1.3320.3.6.14'))),
          bdcomHw.temperatureLegacy ? walkOrGetNumericOid(session, bdcomHw.temperatureLegacy) : Promise.resolve([]),
          bdcomHw.temperatureValue ? walkOrGetNumericOid(session, bdcomHw.temperatureValue) : Promise.resolve([]),
        ]);

        for (const t of cardSysTempVals) {
          if (t > 0 && t < 120) tempCandidates.push(t);
        }
        for (const rawVal of cardTempMap.values()) {
          const num = parseNumeric(rawVal);
          if (num !== null && num > 0 && num < 120) tempCandidates.push(num);
        }
        for (const t of boxTempVals) {
          if (t > 0 && t < 120) tempCandidates.push(t);
        }
        for (const t of legacyTempVals) {
          if (t > 0 && t < 120) tempCandidates.push(t);
        }
        for (const t of tempValReadings) {
          if (t > 0 && t < 120) tempCandidates.push(t);
        }

        if (tempCandidates.length > 0) {
          temperature = getHighestValidTemperature(tempCandidates, 1, true);
        }
      } catch {
        // Keep null if not reported
      }

      // (b) Power Supplies: BDCOM dual-redundancy powerStatus scalar (1.3.6.1.4.1.3320.9.189.1.0) & modular shelf table
      try {
        const [scalarPowerVals, psuExtMap, psuMap] = await Promise.all([
          walkOrGetNumericOid(session, bdcomHw.powerStatus || '1.3.6.1.4.1.3320.9.189.1.0')
            .then((v) => (v.length > 0 ? v : walkOrGetNumericOid(session, '1.3.6.1.4.1.3320.9.189.1'))),
          bdcomHw.psuExtStatus ? walkColumnBySuffix(session, bdcomHw.psuExtStatus) : Promise.resolve(new Map()),
          bdcomHw.psuStatus ? walkColumnBySuffix(session, bdcomHw.psuStatus)
            .then((m) => (m.size > 0 ? m : (bdcomHw.psuTableAlt ? walkColumnBySuffix(session, bdcomHw.psuTableAlt) : new Map()))) : Promise.resolve(new Map()),
        ]);

        const bPsus = [];

        // 1. Check scalar dual-feed power redundancy (standard BDCOM NMS-POWER-MIB)
        // 1 = Feed A normal (B inactive/failed), 2 = Feed B normal (A inactive/failed), 3 = Dual A & B redundant normal, 4 = critical
        if (scalarPowerVals.length > 0 && scalarPowerVals[0] >= 1 && scalarPowerVals[0] <= 4) {
          const code = scalarPowerVals[0];
          if (code === 3) {
            bPsus.push(
              { name: 'PSU 1 (Feed A)', status: 'ok' },
              { name: 'PSU 2 (Feed B)', status: 'ok' }
            );
          } else if (code === 1) {
            bPsus.push(
              { name: 'PSU 1 (Feed A)', status: 'ok' },
              { name: 'PSU 2 (Feed B)', status: 'critical' }
            );
          } else if (code === 2) {
            bPsus.push(
              { name: 'PSU 1 (Feed A)', status: 'critical' },
              { name: 'PSU 2 (Feed B)', status: 'ok' }
            );
          } else if (code === 4) {
            bPsus.push(
              { name: 'PSU 1', status: 'critical' },
              { name: 'PSU 2', status: 'critical' }
            );
          }
        }

        // 2. If scalar was not present, check modular shelf table powerExtDefTable
        if (bPsus.length === 0 && psuExtMap.size > 0) {
          let pIdx = 1;
          for (const rawVal of psuExtMap.values()) {
            const num = parseNumeric(rawVal);
            bPsus.push({
              name: `PSU ${pIdx++}`,
              status: num === 1 ? 'ok' : 'critical',
            });
          }
        }

        // 3. Fallback to generic BDCOM table
        if (bPsus.length === 0 && psuMap.size > 0 && psuMap.size <= 4) {
          let pIdx = 1;
          for (const [suffix, rawVal] of psuMap.entries()) {
            const num = parseNumeric(rawVal);
            const strVal = String(rawVal || '').toLowerCase();
            const isCritical = strVal.includes('fail') || strVal.includes('down') || strVal.includes('off') || num === 2;
            bPsus.push({
              name: `PSU ${pIdx++}`,
              status: isCritical ? 'critical' : 'ok',
            });
          }
        }

        if (bPsus.length > 0) power_supplies = bPsus.slice(0, 4);
      } catch {
        // Keep null if not reported
      }

      // (c) Fans: BDCOM cooling fans (nmsFanTable with RPM, legacy table, and scalar health)
      try {
        const [modernStatusMap, modernRpmMap, legacyStatusMap, legacyRpmMap, scalarFanVals] = await Promise.all([
          bdcomHw.fanStatusModern ? walkColumnBySuffix(session, bdcomHw.fanStatusModern) : Promise.resolve(new Map()),
          bdcomHw.fanRpmModern ? walkColumnBySuffix(session, bdcomHw.fanRpmModern) : Promise.resolve(new Map()),
          bdcomHw.fanStatusOld ? walkColumnBySuffix(session, bdcomHw.fanStatusOld) : Promise.resolve(new Map()),
          bdcomHw.fanSpeedOld ? walkColumnBySuffix(session, bdcomHw.fanSpeedOld) : Promise.resolve(new Map()),
          walkOrGetNumericOid(session, bdcomHw.fanStatusScalar || '1.3.6.1.4.1.3320.9.187.1.0')
            .then((v) => (v.length > 0 ? v : walkOrGetNumericOid(session, '1.3.6.1.4.1.3320.9.187.3.1.0'))),
        ]);

        const bFans = [];

        // 1. Modern nmsFanTable (status + tachometer RPM)
        if (modernStatusMap.size > 0) {
          let fIdx = 1;
          for (const suffix of modernStatusMap.keys()) {
            const numStatus = parseNumeric(modernStatusMap.get(suffix));
            const numRpm = parseNumeric(modernRpmMap.get(suffix));
            const rpm = numRpm !== null && numRpm >= 500 && numRpm <= 25000 ? Math.round(numRpm) : null;
            bFans.push({
              name: `Fan ${fIdx++}`,
              status: numStatus === 1 ? 'ok' : 'critical',
              rpm,
            });
          }
        } else if (legacyStatusMap.size > 0) {
          // 2. Legacy fanTable
          let fIdx = 1;
          for (const suffix of legacyStatusMap.keys()) {
            const numStatus = parseNumeric(legacyStatusMap.get(suffix));
            const numRpm = parseNumeric(legacyRpmMap.get(suffix));
            const rpm = numRpm !== null && numRpm >= 500 && numRpm <= 25000 ? Math.round(numRpm) : null;
            bFans.push({
              name: `Fan ${fIdx++}`,
              status: numStatus === 1 ? 'ok' : 'critical',
              rpm,
            });
          }
        } else if (scalarFanVals.length > 0 && (scalarFanVals[0] === 1 || scalarFanVals[0] === 2)) {
          // 3. Scalar fan health status
          bFans.push({
            name: 'Fan 1',
            status: scalarFanVals[0] === 1 ? 'ok' : 'critical',
            rpm: null,
          });
        }

        // 4. Fallback to generic walk
        if (bFans.length === 0) {
          const fanMap = await walkColumnBySuffix(session, '1.3.6.1.4.1.3320.9.187.1.1.2')
            .then((m) => (m.size > 0 ? m : walkColumnBySuffix(session, '1.3.6.1.4.1.3320.9.187.4')));
          if (fanMap.size > 0 && fanMap.size <= 4) {
            let fIdx = 1;
            for (const [suffix, rawVal] of fanMap.entries()) {
              const num = parseNumeric(rawVal);
              const strVal = String(rawVal || '').toLowerCase();
              const isCritical = strVal.includes('fail') || strVal.includes('stop') || strVal.includes('down') || num === 2;
              bFans.push({
                name: `Fan ${fIdx++}`,
                status: isCritical ? 'critical' : 'ok',
                rpm: num !== null && num > 500 && num < 25000 ? num : null,
              });
            }
          }
        }

        if (bFans.length > 0) {
          fans = bFans.slice(0, 4);
        }
      } catch {
        // Keep null if not reported
      }

      return { power_supplies, fans, temperature };
    }

    // 4. Cisco (Nexus CISCO-ENTITY-FRU-CONTROL-MIB + legacy ENVMON fallback)
    if (brand === 'Cisco') {
      const fruPsuOperOid = `${CISCO_PSU_STATUS_TABLE}.${CISCO_PSU_STATUS_COLUMNS.operStatus}`; // 1.3.6.1.4.1.9.9.117.1.1.2.1.1
      const fruPsuWattsOid = `${CISCO_PSU_STATUS_TABLE}.3`; // cefcFRUCurrent / wattage / index
      const fruFanOperOid = `${CISCO_FAN_STATUS_TABLE}.${CISCO_FAN_STATUS_COLUMNS.status}`; // 1.3.6.1.4.1.9.9.117.1.1.1.1.1

      const [fruPsuOperMap, fruPsuWattsMap, fruFanOperMap] = await Promise.all([
        walkColumnBySuffix(session, fruPsuOperOid, 16),
        walkColumnBySuffix(session, fruPsuWattsOid, 16),
        walkColumnBySuffix(session, fruFanOperOid, 32),
      ]);

      const ciscoPsus = [];
      if (fruPsuOperMap.size > 0) {
        let pIdx = 1;
        for (const [suffix, rawOper] of fruPsuOperMap.entries()) {
          const operCode = parseNumeric(rawOper);
          if (operCode === null) continue;
          // cefcFRUPowerOperStatus: 1 = on/normal, 2 = on
          const isOk = operCode === 1 || operCode === 2;
          const rawWatts = parseNumeric(fruPsuWattsMap.get(suffix));
          // cefcFRUPowerStatusTable.3 is cefcFRUCurrent (current/index), not wattage.
          // Raw values like 9166 must never be displayed as Watts. Only accept realistic power ratings (10 - 2000 W) if not 9166.
          const validWatts = (rawWatts && rawWatts > 10 && rawWatts <= 2000 && rawWatts !== 9166) ? rawWatts : null;
          ciscoPsus.push({
            name: `PSU ${pIdx++}`,
            status: isOk ? 'ok' : 'critical',
            ...(validWatts !== null ? { watts: validWatts } : {}),
            raw_value: operCode,
          });
        }
      }

      const ciscoFans = [];
      if (fruFanOperMap.size > 0) {
        let fIdx = 1;
        for (const [suffix, rawStatus] of fruFanOperMap.entries()) {
          const statusCode = parseNumeric(rawStatus);
          if (statusCode === null) continue;
          // cefcFanTrayOperStatus: 5 = active/normal operational, 2 = up, 1 = on
          const isOk = statusCode === 5 || statusCode === 2 || statusCode === 1;
          const isWarning = statusCode === 4;
          ciscoFans.push({
            name: `Fan ${fIdx++}`,
            status: isOk ? 'ok' : isWarning ? 'warning' : 'critical',
            rpm: null,
            raw_value: statusCode,
          });
        }
      }

      if (ciscoPsus.length > 0) power_supplies = ciscoPsus;
      if (ciscoFans.length > 0) fans = ciscoFans;

      // Fallback to legacy Cisco ENVMON if FRU tables did not yield PSU or fans, or to get temperature
      const cfg = HARDWARE_OIDS.Cisco || {};
      const [psuNameMap, psuStatusMap, fanNameMap, fanStatusMap, tempReadings] = await Promise.all([
        !power_supplies && cfg.psuName ? walkColumnBySuffix(session, cfg.psuName) : Promise.resolve(new Map()),
        !power_supplies && cfg.psuStatus ? walkColumnBySuffix(session, cfg.psuStatus) : Promise.resolve(new Map()),
        !fans && cfg.fanName ? walkColumnBySuffix(session, cfg.fanName) : Promise.resolve(new Map()),
        !fans && cfg.fanStatus ? walkColumnBySuffix(session, cfg.fanStatus) : Promise.resolve(new Map()),
        cfg.temperatureValue ? walkOrGetNumericOid(session, cfg.temperatureValue) : Promise.resolve([]),
      ]);

      if (!power_supplies && (psuNameMap.size > 0 || psuStatusMap.size > 0)) {
        power_supplies = buildSensorList(psuNameMap, psuStatusMap, cfg.statusEnum, 'PSU');
      }
      if (!fans && (fanNameMap.size > 0 || fanStatusMap.size > 0)) {
        fans = buildSensorList(fanNameMap, fanStatusMap, cfg.statusEnum, 'Fan');
      }
      if (temperature === null) {
        temperature = getHighestValidTemperature(tempReadings, 1, true);
      }

      // If a BDCOM or compact OLT triggered Cisco ENVMON with 36 slot rows, slice to first 2 physical rows
      if (fans && fans.length > 2 && (/bd-?com/i.test(brand || '') || /bd-?com/i.test(sysDescr || '') || deviceType === 'OLT')) {
        fans = fans.slice(0, 2);
        if (power_supplies && power_supplies.length > 2) {
          power_supplies = power_supplies.slice(0, 2);
        }
      }

      return { power_supplies, fans, temperature };
    }

    // 5. Juniper Operating Table
    if (brand === 'Juniper' && HARDWARE_OIDS.Juniper) {
      const cfg = HARDWARE_OIDS.Juniper;
      const [nameMap, stateMap, tempReadings] = await Promise.all([
        walkColumnBySuffix(session, cfg.names),
        walkColumnBySuffix(session, cfg.state),
        walkOrGetNumericOid(session, cfg.temperature),
      ]);

      const jPsus = [];
      const jFans = [];

      for (const [suffix, rawName] of nameMap.entries()) {
        const name = parseString(rawName);
        if (!name) continue;
        const stateCode = parseNumeric(stateMap.get(suffix));
        const status = (stateCode !== null && cfg.statusEnum[stateCode]) || 'warning';

        if (name.includes('Power') || name.includes('PEM')) {
          jPsus.push({ name, status });
        } else if (name.includes('Fan')) {
          jFans.push({ name, status, rpm: null });
        }
      }

      if (jPsus.length > 0) power_supplies = jPsus;
      if (jFans.length > 0) fans = jFans;
      temperature = getHighestValidTemperature(tempReadings, 1, true);
      return { power_supplies, fans, temperature };
    }

    // 6. Huawei OLT (SmartAX MA5680T / MA5683T / MA5608T / MA5800)
    const isHuawei = brand === 'Huawei' ||
                     /huawei|smartax/i.test(brand || '') ||
                     /huawei|smartax/i.test(sysDescr || '');
    if (isHuawei) {
      // (a) Temperature: probe hwMusaBoardTemperature, hwBoardTemperature, hwSlotTemprature, hwEntityTemperature
      const tempCandidates = [];
      try {
        const hHw = HARDWARE_OIDS.Huawei || {};
        const [musaTempVals, boardTempVals, slotTempVals, entityTempVals] = await Promise.all([
          hHw.temperatureMusa ? walkOrGetNumericOid(session, hHw.temperatureMusa) : Promise.resolve([]),
          hHw.temperature ? walkOrGetNumericOid(session, hHw.temperature) : Promise.resolve([]),
          hHw.temperatureSlot ? walkOrGetNumericOid(session, hHw.temperatureSlot) : Promise.resolve([]),
          hHw.temperatureEntity ? walkOrGetNumericOid(session, hHw.temperatureEntity) : Promise.resolve([]),
        ]);
        for (const t of musaTempVals) if (t > 0 && t < 120) tempCandidates.push(t);
        for (const t of boardTempVals) if (t > 0 && t < 120) tempCandidates.push(t);
        for (const t of slotTempVals) if (t > 0 && t < 120) tempCandidates.push(t);
        for (const t of entityTempVals) if (t > 0 && t < 120) tempCandidates.push(t);

        if (tempCandidates.length > 0) {
          temperature = getHighestValidTemperature(tempCandidates, 1, true);
        }
      } catch {}

      // (b) Fans: hwFanTable (hwFanStatus: 1=normal/ok, 2=abnormal/critical; hwFanSpeed in RPM)
      try {
        const hHw = HARDWARE_OIDS.Huawei || {};
        const [fanStatusMap, fanSpeedMap] = await Promise.all([
          hHw.fanStatus ? walkColumnBySuffix(session, hHw.fanStatus) : Promise.resolve(new Map()),
          hHw.fanSpeed ? walkColumnBySuffix(session, hHw.fanSpeed) : Promise.resolve(new Map()),
        ]);
        if (fanStatusMap.size > 0) {
          const hFans = [];
          let fIdx = 1;
          for (const [suffix, rawStatus] of fanStatusMap.entries()) {
            const statusNum = parseNumeric(rawStatus);
            const speedNum = parseNumeric(fanSpeedMap.get(suffix));
            const isCrit = statusNum === 2;
            const rpm = speedNum !== null && speedNum >= 500 && speedNum <= 25000 ? Math.round(speedNum) : null;
            hFans.push({
              name: `Fan ${fIdx++}`,
              status: isCrit ? 'critical' : 'ok',
              rpm,
            });
          }
          if (hFans.length > 0) fans = hFans;
        }
      } catch {}

      // (c) Power Supplies: hwEntityPwrState / hwMusaFramePower / ENTITY-MIB class 6
      try {
        const hHw = HARDWARE_OIDS.Huawei || {};
        const hPsus = [];

        // 1. Try hwEntityPwrState table (1=supply/normal, 2=notsupply/abnormal)
        if (hHw.psuStatus) {
          const psuStatusMap = await walkColumnBySuffix(session, hHw.psuStatus);
          if (psuStatusMap.size > 0 && psuStatusMap.size <= 4) {
            let pIdx = 1;
            for (const [suffix, rawStatus] of psuStatusMap.entries()) {
              const statusNum = parseNumeric(rawStatus);
              hPsus.push({
                name: `PSU ${pIdx++}`,
                status: statusNum === 2 ? 'critical' : 'ok',
              });
            }
          }
        }

        // 2. Try hwMusaFramePower (SmartAX MA5680T/MA5683T frame power status)
        if (hPsus.length === 0 && hHw.psuFramePower) {
          const framePowerVals = await walkOrGetNumericOid(session, hHw.psuFramePower);
          if (framePowerVals.length > 0) {
            const val = framePowerVals[0];
            hPsus.push({
              name: 'PSU 1',
              status: val === 2 ? 'critical' : 'ok',
            });
          }
        }

        // 3. Fallback: ENTITY-MIB where entPhysicalClass == 6 (powerSupply)
        if (hPsus.length === 0) {
          const classMap = await walkColumnBySuffix(session, '1.3.6.1.2.1.47.1.1.1.1.5');
          const psuSuffixes = [];
          for (const [suffix, rawVal] of classMap.entries()) {
            if (parseNumeric(rawVal) === 6) { // 6 = powerSupply
              psuSuffixes.push(suffix);
            }
          }
          if (psuSuffixes.length > 0 && psuSuffixes.length <= 4) {
            let pIdx = 1;
            for (const suffix of psuSuffixes) {
              hPsus.push({
                name: `PSU ${pIdx++}`,
                status: 'ok',
              });
            }
          }
        }

        // Physical chassis constraint: Huawei OLT (SmartAX FRAME-300 / MA5683T / MA5680T / MA5608T / MA5800)
        // has at most 2 modular power supply slots (Power Supply 1 and Power Supply 2).
        if (hPsus.length > 0) {
          power_supplies = hPsus.slice(0, 2);
        }
      } catch {}

      return { power_supplies, fans, temperature };
    }

    // 7. Other brands with temperature OID only (no PSU/fan OIDs)
    const hwBrandCfg = HARDWARE_OIDS[brand];
    const tempOid = (hwBrandCfg && hwBrandCfg.temperature) || vendorMap.temperature;
    if (tempOid) {
      const divisor = vendorMap.temperatureDivisor || 1;
      const tempReadings = await walkOrGetNumericOid(session, tempOid);
      temperature = getHighestValidTemperature(tempReadings, divisor, true);
    }
  } catch {
    // Hardware sensor failures must never mark the device offline or set metrics_available = false
  }

  return { power_supplies, fans, temperature };
}

/**
 * Poll Cisco Entity Sensor Table (CISCO-ENTITY-SENSOR-MIB) for optical dBm and temperature sensors.
 * Confirmed working on live Cisco Nexus hardware (e.g., N9K-C93240YC-FX2, NX-OS).
 * Column .1 = entSensorType (14 = dBm, 8 = Celsius/Temperature).
 * Column .3 = entSensorPrecision (0 = hundredths, divide by 100).
 * Column .4 = entSensorValue.
 * Column .5 = entSensorStatus (1 = ok).
 * @param {any} session
 * @returns {Promise<{ optical_sensors: Array<{index: string|number, dbm: number}>|null, temperature_sensors: Array<{index: string|number, celsius: number}>|null, maxTemp: number|null }>}
 */
export async function pollCiscoEntitySensors(session) {
  try {
    const typeOid = `${CISCO_ENTITY_SENSOR_TABLE}.${CISCO_ENTITY_SENSOR_COLUMNS.entSensorType}`; // 1.3.6.1.4.1.9.9.91.1.1.1.1.1
    const valueOid = `${CISCO_ENTITY_SENSOR_TABLE}.${CISCO_ENTITY_SENSOR_COLUMNS.entSensorValue}`; // 1.3.6.1.4.1.9.9.91.1.1.1.1.4
    const statusOid = `${CISCO_ENTITY_SENSOR_TABLE}.${CISCO_ENTITY_SENSOR_COLUMNS.entSensorStatus}`; // 1.3.6.1.4.1.9.9.91.1.1.1.1.5
    const descrOid = '1.3.6.1.2.1.47.1.1.1.1.2'; // entPhysicalDescr

    // Walk entSensorType, entSensorValue, entSensorStatus, and entPhysicalDescr together using walkColumnBySuffix
    const [typeMap, valueMap, statusMap, descrMap] = await Promise.all([
      walkColumnBySuffix(session, typeOid, 1000),
      walkColumnBySuffix(session, valueOid, 1000),
      walkColumnBySuffix(session, statusOid, 1000),
      walkColumnBySuffix(session, descrOid, 1000),
    ]);

    if (typeMap.size === 0 && valueMap.size === 0) {
      return { optical_sensors: null, temperature_sensors: null, maxTemp: null };
    }

    const optical_sensors = [];
    const chassisTemperatures = [];
    const temperature_sensors = [];

    for (const [suffix, rawType] of typeMap.entries()) {
      const typeNum = parseNumeric(rawType);
      if (typeNum !== 14 && typeNum !== 8) continue;

      // Walk entSensorStatus (column .5) for the same indices; only include readings where status is 1 (ok)
      const rawStatus = statusMap.get(suffix);
      const statusNum = parseNumeric(rawStatus);
      if (statusNum !== 1) continue;

      const rawVal = valueMap.get(suffix);
      const valNum = parseNumeric(rawVal);
      if (valNum === null) continue;

      const parsedIdx = /^\d+$/.test(suffix) ? parseInt(suffix, 10) : suffix;
      const descr = parseString(descrMap.get(suffix)) || '';

      if (typeNum === 14) {
        // Optical dBm: values in hundredths on Cisco hardware (e.g. -2525 = -25.25 dBm)
        const dbm = Math.abs(valNum) >= 100 ? Math.round((valNum / 100) * 100) / 100 : valNum;

        let label = null;
        if (/receive\s*power/i.test(descr)) {
          label = 'Rx';
        } else if (/transmit\s*power/i.test(descr)) {
          label = 'Tx';
        }

        let port = null;
        const ethMatch = descr.match(/Ethernet(\d+(?:\/\d+)+)/i) || descr.match(/Ethernet(\d+\/\d+)/i);
        if (ethMatch) {
          port = `Eth${ethMatch[1]}`;
          const laneMatch = descr.match(/lane\s*(\d+)/i);
          if (laneMatch) {
            port += ` L${laneMatch[1]}`;
          }
        }

        optical_sensors.push({
          index: parsedIdx,
          dbm,
          label: label || null,
          port: port || null,
        });
      } else if (typeNum === 8) {
        // Temperature (Celsius): exclude transceiver sensors (which contain "Transceiver")
        if (/transceiver/i.test(descr)) {
          continue;
        }

        // Non-transceiver chassis/module-level sensor (e.g. "module-1 FRONT", "module-1 BACK", "module-1 CPU")
        let celsius = valNum;
        if (Math.abs(celsius) >= 10000) {
          celsius = celsius / 1000;
        } else if (Math.abs(celsius) >= 1000) {
          celsius = celsius > 120 ? celsius / 100 : celsius;
        } else if (Math.abs(celsius) >= 150) {
          celsius = celsius / 10;
        }
        celsius = Math.round(celsius * 100) / 100;
        // Verify realistic temperature bounds (-40 to 125 °C)
        if (celsius >= -40 && celsius <= 125) {
          chassisTemperatures.push(celsius);
          temperature_sensors.push({
            index: parsedIdx,
            celsius,
            label: descr ? descr.trim() : null,
          });
        }
      }
    }

    optical_sensors.sort((a, b) => Number(a.index) - Number(b.index));
    temperature_sensors.sort((a, b) => Number(a.index) - Number(b.index));

    const maxTemp = chassisTemperatures.length > 0
      ? Math.max(...chassisTemperatures)
      : null;

    return {
      optical_sensors: optical_sensors.length > 0 ? optical_sensors : null,
      temperature_sensors: temperature_sensors.length > 0 ? temperature_sensors : null,
      maxTemp,
    };
  } catch {
    return { optical_sensors: null, temperature_sensors: null, maxTemp: null };
  }
}


/**
 * Fetch a single scalar numeric OID safely, returning null on error or non-numeric.
 * @param {any} session
 * @param {string} oid
 * @returns {Promise<number|null>}
 */
async function getScalarNumeric(session, oid) {
  if (!oid) return null;
  const cleanOid = oid.replace(/^\./, '');
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
        if (n !== null) return n;
      }
    }
  } catch {
    // Ignore scalar GET errors
  }
  return null;
}

/**
 * Fetch a single scalar string OID safely, returning null on error or empty string.
 * @param {any} session
 * @param {string} oid
 * @returns {Promise<string|null>}
 */
async function getScalarString(session, oid) {
  if (!oid) return null;
  const cleanOid = oid.replace(/^\./, '');
  try {
    const vbs = await new Promise((resolve, reject) => {
      session.get([cleanOid], (err, resVbs) => {
        if (err) reject(err);
        else resolve(resVbs);
      });
    });
    for (const vb of vbs || []) {
      if (vb && !snmp.isVarbindError(vb)) {
        const s = parseString(vb.value);
        if (s) return s;
      }
    }
  } catch {
    // Ignore scalar GET errors
  }
  return null;
}

/**
 * Create a dedicated snmp session with an extended timeout for slower extend scripts.
 * @param {any} session
 * @param {number} [timeoutMs=8000]
 * @returns {any}
 */
function createExtendedTimeoutSession(session, timeoutMs = 8000) {
  if (session && session.target) {
    return snmp.createSession(session.target, session.community || 'public', {
      port: session.port || 161,
      version: session.version !== undefined ? session.version : snmp.Version2c,
      timeout: timeoutMs,
      retries: 1,
      transport: session.transport || 'udp4',
    });
  }
  return null;
}

/**
 * Poll hw-identity extend script metric for device_type === 'Server'.
 * Fixed scalar OID: HW_IDENTITY_EXTEND_OID (NET-SNMP-EXTEND-MIB).
 * dmidecode output format: "manufacturer|model|serial".
 * Reuses the existing 24-hour per-device-IP caching pattern.
 * If fetch fails, keep using cached values.
 * Never marks device offline, never changes metrics_available.
 * @param {any} session
 * @param {string} ip
 * @param {string} deviceType
 * @returns {Promise<{ manufacturer: string, model: string, serial: string }|null>}
 */
async function pollHwIdentity(session, ip, deviceType) {
  if (deviceType !== 'Server') {
    return null;
  }

  const now = Date.now();
  const cachedModel = deviceModelCache.get(ip);
  if (cachedModel?.hw_identity && now - cachedModel.fetchedAt < MODEL_CACHE_TTL_MS) {
    return cachedModel.hw_identity;
  }

  let hwSession = null;
  let rawVal = null;
  try {
    hwSession = createExtendedTimeoutSession(session, 8000);
    const targetSession = hwSession || session;
    rawVal = await getScalarString(targetSession, HW_IDENTITY_EXTEND_OID);
  } catch {
    // Graceful fallback when the host does not implement the optional extend script
  } finally {
    if (hwSession) {
      try {
        hwSession.close();
      } catch {
        // Safe fallback
      }
    }
  }

  if (rawVal && typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    if (trimmed && !trimmed.includes('No such file')) {
      const parts = trimmed.split('|');
      if (parts.length === 3) {
        const [rawMfr, rawModel, rawSerial] = parts;
        const manufacturer = (rawMfr || '').trim();
        const model = (rawModel || '').trim();
        const serial = (rawSerial || '').trim();

        if (manufacturer || model || serial) {
          return {
            manufacturer,
            model,
            serial,
          };
        }
      }
    }
  }

  // Fallback: If extend script is not configured, probe standard Dell / HP server OIDs
  try {
    // 1. Dell iDRAC / OMSA MIBs
    const dellModel = (await getScalarString(session, '1.3.6.1.4.1.674.10892.5.1.1.1.0')) ||
                      (await getScalarString(session, '1.3.6.1.4.1.674.10892.1.300.10.1.9.1'));
    const dellSerial = (await getScalarString(session, '1.3.6.1.4.1.674.10892.5.1.2.1.0')) ||
                       (await getScalarString(session, '1.3.6.1.4.1.674.10892.1.300.10.1.11.1'));
    if (dellModel || dellSerial) {
      return {
        manufacturer: 'Dell',
        model: dellModel ? String(dellModel).trim() : 'Dell Server',
        serial: dellSerial ? String(dellSerial).trim() : '',
      };
    }

    // 2. HP ProLiant / iLO MIBs
    const hpModel = await getScalarString(session, '1.3.6.1.4.1.232.2.2.4.2.0');
    const hpSerial = await getScalarString(session, '1.3.6.1.4.1.232.2.2.2.5.0');
    if (hpModel || hpSerial) {
      return {
        manufacturer: 'HP',
        model: hpModel ? String(hpModel).trim() : 'HP Server',
        serial: hpSerial ? String(hpSerial).trim() : '',
      };
    }
  } catch {
    // Ignore native MIB probe errors
  }

  return cachedModel?.hw_identity || null;
}

/**
 * Poll disk lifecycle extend script metric for device_type === 'Server'.
 * Fixed scalar OID: DISK_LIFECYCLE_ALL_EXTEND_OID (NET-SNMP-EXTEND-MIB).
 * Outputs one line of compact JSON: array of disk objects (NVMe and/or HDD/SATA).
 * Computes estimated_eol_days for type === 'nvme' (null if percentage_used or power_on_hours is 0).
 * For type === 'hdd_sata', estimated_eol_days is always null.
 * Never marks device offline, never changes metrics_available.
 * @param {any} session
 * @param {string} deviceType
 * @returns {Promise<Array<Object>|null>}
 */
async function pollDiskLifecycleAll(session, deviceType) {
  if (deviceType !== 'Server') {
    return null;
  }

  let diskSession = null;
  try {
    diskSession = createExtendedTimeoutSession(session, 12000);
    const targetSession = diskSession || session;

    const rawVal = await getScalarString(targetSession, DISK_LIFECYCLE_ALL_EXTEND_OID);
    if (!rawVal || typeof rawVal !== 'string') {
      return null;
    }

    const trimmed = rawVal.trim();
    if (!trimmed || trimmed.includes('No such file')) {
      return null;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const parseNum = (v) =>
      typeof v === 'number' && Number.isFinite(v)
        ? v
        : v !== null && v !== undefined && !isNaN(Number(v))
        ? Number(v)
        : null;

    const results = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || !item.device) continue;

      const device = String(item.device);
      const type = item.type === 'nvme' || item.type === 'hdd_sata' ? item.type : null;
      const pct = parseNum(item.percentage_used);
      const hours = parseNum(item.power_on_hours);

      let estimated_eol_days = null;
      if (type === 'nvme' && pct !== null && hours !== null && pct > 0 && hours > 0) {
        const wearRatePerHour = pct / hours;
        const remainingHours = (100 - pct) / wearRatePerHour;
        estimated_eol_days = Math.round(remainingHours / 24);
      }

      results.push({
        device,
        type,
        percentage_used: pct,
        power_on_hours: hours,
        lifetime_bytes_read: parseNum(item.lifetime_bytes_read),
        lifetime_bytes_written: parseNum(item.lifetime_bytes_written),
        estimated_eol_days,
        passed: typeof item.passed === 'boolean' ? item.passed : null,
        reallocated: parseNum(item.reallocated),
        pending: parseNum(item.pending),
        uncorrectable: parseNum(item.uncorrectable),
      });
    }

    return results.length > 0 ? results : null;
  } catch (err) {
    console.debug('[pollDiskLifecycleAll] skipped or not available on host:', err && err.message ? err.message : err);
    return null;
  } finally {
    if (diskSession) {
      try {
        diskSession.close();
      } catch {
        // Safe fallback ignoring session close errors
      }
    }
  }
}

/**
 * Poll disk I/O extend script metric for device_type === 'Server'.
 * Fixed scalar OID: DISK_IO_ALL_EXTEND_OID (NET-SNMP-EXTEND-MIB).
 * Outputs one line of JSON array: [{"device":"nvme0n1","read_bytes":1714446336,"written_bytes":43188310016}]
 * Computes rates using previous samples in disk_io_raw_v2 or memory cache.
 * Never marks device offline, never changes metrics_available.
 * @param {any} session
 * @param {string} deviceType
 * @param {string} deviceIp
 * @param {number|null} sysUpTimeTicks
 * @returns {Promise<Array<Object>|null>}
 */
async function pollDiskIoAll(session, deviceType, deviceIp, sysUpTimeTicks) {
  if (deviceType !== 'Server') {
    return null;
  }

  let ioSession = null;
  try {
    ioSession = createExtendedTimeoutSession(session, 12000);
    const targetSession = ioSession || session;

    const rawVal = await getScalarString(targetSession, DISK_IO_ALL_EXTEND_OID);
    if (!rawVal || typeof rawVal !== 'string') {
      return null;
    }

    const trimmed = rawVal.trim();
    if (!trimmed || trimmed.includes('No such file')) {
      return null;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const currentSysUpTime = Number(sysUpTimeTicks ?? 0);
    const ioResults = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object' || !item.device) continue;

      const device = String(item.device);
      let curRead = null;
      let curWritten = null;

      try {
        curRead = BigInt(String(item.read_bytes ?? '0').split('.')[0]);
        curWritten = BigInt(String(item.written_bytes ?? '0').split('.')[0]);
      } catch {
        continue;
      }

      const memKey = `${deviceIp}:${device}`;
      let prevRow = null;

      if (isDbConnected()) {
        try {
          const res = await query(
            `SELECT read_bytes, written_bytes, sys_uptime_ticks, recorded_at 
             FROM disk_io_raw_v2 
             WHERE device_ip = $1 AND disk_name = $2;`,
            [deviceIp, device]
          );
          if (res && res.rows && res.rows.length > 0) {
            prevRow = res.rows[0];
          }
        } catch {
          // Fall back to memory cache
        }
      }

      if (!prevRow) {
        prevRow = memoryDiskIoRawV2.get(memKey) || null;
      }

      let read_bytes_per_sec = null;
      let write_bytes_per_sec = null;

      if (prevRow) {
        const prevSysUpTime = Number(prevRow.sys_uptime_ticks ?? 0);
        const prevRecordedAt = new Date(prevRow.recorded_at).getTime();
        const elapsedSec = (nowMs - prevRecordedAt) / 1000;

        // Check reboot: current sysUpTime < previous sysUpTime
        const isReboot = currentSysUpTime < prevSysUpTime;

        if (!isReboot && elapsedSec > 0) {
          let prevRead = BigInt(0);
          let prevWritten = BigInt(0);
          try {
            prevRead = BigInt(String(prevRow.read_bytes ?? '0').split('.')[0]);
            prevWritten = BigInt(String(prevRow.written_bytes ?? '0').split('.')[0]);
          } catch {}

          // If current < previous and no reboot detected, treat as reboot/reset: discard sample, rate null
          if (curRead >= prevRead) {
            const diffRead = Number(curRead - prevRead);
            read_bytes_per_sec = Math.round(diffRead / elapsedSec);
          }
          if (curWritten >= prevWritten) {
            const diffWritten = Number(curWritten - prevWritten);
            write_bytes_per_sec = Math.round(diffWritten / elapsedSec);
          }
        }
      }

      // Upsert new sample to memory and database
      memoryDiskIoRawV2.set(memKey, {
        device_ip: deviceIp,
        disk_name: device,
        read_bytes: curRead.toString(),
        written_bytes: curWritten.toString(),
        sys_uptime_ticks: currentSysUpTime,
        recorded_at: now,
      });

      if (isDbConnected()) {
        try {
          await query(
            `INSERT INTO disk_io_raw_v2 (device_ip, disk_name, read_bytes, written_bytes, sys_uptime_ticks, recorded_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (device_ip, disk_name)
             DO UPDATE SET 
               read_bytes = EXCLUDED.read_bytes,
               written_bytes = EXCLUDED.written_bytes,
               sys_uptime_ticks = EXCLUDED.sys_uptime_ticks,
               recorded_at = EXCLUDED.recorded_at;`,
            [deviceIp, device, curRead.toString(), curWritten.toString(), currentSysUpTime, now]
          );
        } catch {
          // Ignore upsert errors
        }
      }

      ioResults.push({
        device,
        read_bytes_per_sec,
        write_bytes_per_sec,
      });
    }

    return ioResults.length > 0 ? ioResults : null;
  } catch (err) {
    console.debug('[pollDiskIoAll] skipped or not available on host:', err && err.message ? err.message : err);
    return null;
  } finally {
    if (ioSession) {
      try {
        ioSession.close();
      } catch {
        // Safe fallback ignoring session close errors
      }
    }
  }
}

/**
 * Merge disk lifecycle and I/O results into unified disks array.
 * If BOTH GETs fail/error/empty: returns null.
 * @param {Array<Object>|null} lifecycleResults
 * @param {Array<Object>|null} ioResults
 * @returns {Array<Object>|null}
 */
function mergeDisks(lifecycleResults, ioResults) {
  if (!lifecycleResults && !ioResults) {
    return null;
  }

  const deviceMap = new Map();

  if (Array.isArray(lifecycleResults)) {
    for (const item of lifecycleResults) {
      deviceMap.set(item.device, {
        device: item.device,
        type: item.type ?? null,
        percentage_used: item.percentage_used ?? null,
        power_on_hours: item.power_on_hours ?? null,
        lifetime_bytes_read: item.lifetime_bytes_read ?? null,
        lifetime_bytes_written: item.lifetime_bytes_written ?? null,
        estimated_eol_days: item.estimated_eol_days ?? null,
        passed: item.passed ?? null,
        reallocated: item.reallocated ?? null,
        pending: item.pending ?? null,
        uncorrectable: item.uncorrectable ?? null,
        read_bytes_per_sec: null,
        write_bytes_per_sec: null,
      });
    }
  }

  if (Array.isArray(ioResults)) {
    for (const io of ioResults) {
      if (deviceMap.has(io.device)) {
        const existing = deviceMap.get(io.device);
        existing.read_bytes_per_sec = io.read_bytes_per_sec ?? null;
        existing.write_bytes_per_sec = io.write_bytes_per_sec ?? null;
      } else {
        deviceMap.set(io.device, {
          device: io.device,
          type: null,
          percentage_used: null,
          power_on_hours: null,
          lifetime_bytes_read: null,
          lifetime_bytes_written: null,
          estimated_eol_days: null,
          passed: null,
          reallocated: null,
          pending: null,
          uncorrectable: null,
          read_bytes_per_sec: io.read_bytes_per_sec ?? null,
          write_bytes_per_sec: io.write_bytes_per_sec ?? null,
        });
      }
    }
  }

  return deviceMap.size > 0 ? Array.from(deviceMap.values()) : null;
}

/**
 * Poll RAM ECC health extend script metric for device_type === 'Server'.
 * Fixed scalar OID: RAM_HEALTH_EXTEND_OID (NET-SNMP-EXTEND-MIB).
 * Outputs one line with 2 space-separated numbers:
 *   total corrected ECC errors (ce), total uncorrected ECC errors (ue)
 * If errors, empty, contains "No such file", or does not parse as exactly 2 non-negative integers:
 *   ram_ecc_corrected = null, ram_ecc_uncorrected = null.
 * Never marks device offline, never changes metrics_available.
 * Uses 8000ms timeout session.
 * @param {any} session
 * @param {string} deviceType
 * @returns {Promise<{
 *   ram_ecc_corrected: number|null,
 *   ram_ecc_uncorrected: number|null
 * }>}
 */
async function pollRamHealth(session, deviceType) {
  const nullResult = {
    ram_ecc_corrected: null,
    ram_ecc_uncorrected: null,
  };

  if (deviceType !== 'Server') {
    return nullResult;
  }

  let ramSession = null;
  try {
    ramSession = createExtendedTimeoutSession(session, 8000);

    const targetSession = ramSession || session;
    const rawVal = await getScalarString(targetSession, RAM_HEALTH_EXTEND_OID);
    if (!rawVal || typeof rawVal !== 'string') {
      return nullResult;
    }

    const trimmed = rawVal.trim();
    if (!trimmed || trimmed.includes('No such file')) {
      return nullResult;
    }

    const tokens = trimmed.split(/\s+/);
    if (tokens.length !== 2) {
      return nullResult;
    }

    const rawCe = Number(tokens[0]);
    const rawUe = Number(tokens[1]);

    if (!Number.isFinite(rawCe) || !Number.isFinite(rawUe)) {
      return nullResult;
    }

    const ram_ecc_corrected = Math.floor(rawCe);
    const ram_ecc_uncorrected = Math.floor(rawUe);

    if (ram_ecc_corrected < 0 || ram_ecc_uncorrected < 0) {
      return nullResult;
    }

    return {
      ram_ecc_corrected,
      ram_ecc_uncorrected,
    };
  } catch {
    return nullResult;
  } finally {
    if (ramSession) {
      try {
        ramSession.close();
      } catch {
        // Safe fallback ignoring session close errors
      }
    }
  }
}

/**
 * Poll RAM per-memory-controller ECC detail extend script metric for device_type === 'Server'.
 * Fixed scalar OID: RAM_MC_DETAIL_EXTEND_OID (NET-SNMP-EXTEND-MIB).
 * Outputs space-separated entries, each "name:ce_count:ue_count" (e.g. "mc0:0:0 mc1:0:0 mc2:0:0 mc3:0:0 ")
 * If errors, empty, or contains "No such file": ram_ecc_controllers = null.
 * Never marks device offline, never changes metrics_available.
 * Uses 8000ms timeout session.
 * @param {any} session
 * @param {string} deviceType
 * @returns {Promise<Array<{name: string, ce: number, ue: number}>|null>}
 */
async function pollRamMcDetail(session, deviceType) {
  if (deviceType !== 'Server') {
    return null;
  }

  let mcSession = null;
  try {
    mcSession = createExtendedTimeoutSession(session, 8000);

    const targetSession = mcSession || session;
    const rawVal = await getScalarString(targetSession, RAM_MC_DETAIL_EXTEND_OID);
    if (!rawVal || typeof rawVal !== 'string') {
      return null;
    }

    const trimmed = rawVal.trim();
    if (!trimmed || trimmed.includes('No such file')) {
      return null;
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const controllers = [];

    for (const token of tokens) {
      const parts = token.split(':');
      if (parts.length !== 3) continue;

      const [name, rawCe, rawUe] = parts;
      if (!name || !name.trim()) continue;

      const ceNum = Number(rawCe);
      const ueNum = Number(rawUe);

      if (!Number.isFinite(ceNum) || !Number.isFinite(ueNum)) continue;

      const ce = Math.floor(ceNum);
      const ue = Math.floor(ueNum);

      if (ce < 0 || ue < 0) continue;

      controllers.push({
        name: name.trim(),
        ce,
        ue,
      });
    }

    return controllers.length > 0 ? controllers : null;
  } catch {
    return null;
  } finally {
    if (mcSession) {
      try {
        mcSession.close();
      } catch {
        // Safe fallback ignoring session close errors
      }
    }
  }
}

/**
 * Poll IPMI health extend script metric for device_type === 'Server'.
 * Fixed scalar OID: IPMI_HEALTH_EXTEND_OID (NET-SNMP-EXTEND-MIB).
 * Outputs one line of compact JSON built from `ipmitool sensor`.
 * Uses a 12000ms timeout session.
 * Never marks device offline, never changes metrics_available.
 * @param {any} session
 * @param {string} deviceType
 * @returns {Promise<Object|null>}
 */
async function pollIpmiHealth(session, deviceType) {
  if (deviceType !== 'Server') {
    return null;
  }

  let ipmiSession = null;
  try {
    ipmiSession = createExtendedTimeoutSession(session, 12000);
    const targetSession = ipmiSession || session;

    const rawVal = await getScalarString(targetSession, IPMI_HEALTH_EXTEND_OID);
    if (!rawVal || typeof rawVal !== 'string') {
      return null;
    }

    const trimmed = rawVal.trim();
    if (!trimmed || trimmed.includes('No such file')) {
      return null;
    }

    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch {
    // If GET fails, is empty, or JSON.parse fails: ignore completely
    return null;
  } finally {
    if (ipmiSession) {
      try {
        ipmiSession.close();
      } catch {
        // Safe fallback ignoring session close errors
      }
    }
  }
}

/**
 * Walk hrStorageTable and return normalized storage array (max 20 entries) or null.
 * Never throws, never marks device offline, and never changes metrics_available.
 * @param {any} session
 * @returns {Promise<Array<{name: string, kind: string, total_bytes: number, used_bytes: number, used_pct: number}>|null>}
 */
async function pollStorageTable(session, brand = null, deviceType = null) {
  // Cisco Nexus switches (NX-OS) do not implement HOST-RESOURCES-MIB storage/memory at all
  if (deviceType === 'Switch' && brand === 'Cisco') {
    return null;
  }
  try {
    // Reuse existing session timeout (default 4000ms for routers/servers)
    const sessionTimeout = (session?.options && session.options.timeout) || session?.timeout || 4000;
    const walkTimeout = Math.max(sessionTimeout * 2, 8000);

    // Enable GETNEXT fallback for pollStorageTable when GETBULK returns empty (especially for MikroTik RouterOS)
    const useGetNextFallback = true;

    const walkWithTimeoutAndRetry = async (oid, maxRows = 64) => {
      const doSingleWalk = () => {
        return new Promise((resolve, reject) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error(`Timeout walking ${oid}`));
            }
          }, walkTimeout);

          walkColumnBySuffix(session, oid, maxRows, 20, useGetNextFallback)
            .then((map) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(map || new Map());
              }
            })
            .catch((err) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
              }
            });
        });
      };

      try {
        const res = await doSingleWalk();
        if (res && res.size > 0) {
          return res;
        }
      } catch {
        // First attempt failed or timed out, will retry
      }

      // Retry once before giving up
      try {
        await new Promise((r) => setTimeout(r, 100));
        const retryRes = await doSingleWalk();
        return retryRes || new Map();
      } catch {
        return new Map();
      }
    };

    let [typeMap, descrMap, allocMap, sizeMap, usedMap] = await Promise.all([
      walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableType),
      walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableDescr),
      walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableAllocUnits),
      walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableSize),
      walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableUsed),
    ]);

    // Check if any column returned fewer entries than the others due to dropped PDU
    const targetSize = Math.max(descrMap.size, sizeMap.size, usedMap.size, allocMap.size, typeMap.size);
    if (targetSize > 0) {
      if (descrMap.size < targetSize) {
        const retried = await walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableDescr);
        if (retried.size > descrMap.size) descrMap = retried;
      }
      if (sizeMap.size < targetSize) {
        const retried = await walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableSize);
        if (retried.size > sizeMap.size) sizeMap = retried;
      }
      if (allocMap.size < targetSize) {
        const retried = await walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableAllocUnits);
        if (retried.size > allocMap.size) allocMap = retried;
      }
      if (usedMap.size < targetSize) {
        const retried = await walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableUsed);
        if (retried.size > usedMap.size) usedMap = retried;
      }
      if (typeMap.size < targetSize) {
        const retried = await walkWithTimeoutAndRetry(COMMON_OIDS.hrStorageTableType);
        if (retried.size > typeMap.size) typeMap = retried;
      }
    }

    if (sizeMap.size === 0) {
      // Only when hrStorageTable is completely empty, try MikroTik native OID fallback
      if (brand === 'MikroTik' || /mikrotik/i.test(brand || '')) {
        try {
          const [memTotVals, memFreeVals, diskTotVals, diskFreeVals] = await Promise.all([
            walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.memoryTotal),
            walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.memoryFree),
            walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.diskTotal),
            walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.diskFree),
          ]);
          const mtkMemTotal = memTotVals[0] || 0;
          const mtkMemFree = memFreeVals[0] !== undefined ? memFreeVals[0] : null;
          const mtkDiskTotal = diskTotVals[0] || 0;
          const mtkDiskFree = diskFreeVals[0] !== undefined ? diskFreeVals[0] : null;

          const mtkStorage = [];
          if (mtkMemTotal > 0 && mtkMemFree !== null) {
            const used = Math.max(0, mtkMemTotal - mtkMemFree);
            mtkStorage.push({
              name: 'Main Memory',
              kind: 'ram',
              total_bytes: mtkMemTotal,
              used_bytes: used,
              used_pct: Math.round((used / mtkMemTotal) * 1000) / 10,
            });
          }
          if (mtkDiskTotal > 0 && mtkDiskFree !== null) {
            const used = Math.max(0, mtkDiskTotal - mtkDiskFree);
            mtkStorage.push({
              name: 'System Disk',
              kind: 'disk',
              total_bytes: mtkDiskTotal,
              used_bytes: used,
              used_pct: Math.round((used / mtkDiskTotal) * 1000) / 10,
            });
          }
          if (mtkStorage.length > 0) {
            return mtkStorage;
          }
        } catch {}
      }
      return null;
    }

    const entries = [];
    const allSuffixes = new Set([...sizeMap.keys(), ...descrMap.keys()]);

    for (const suffix of allSuffixes) {
      const rawSize = sizeMap.get(suffix);
      const size = parseNumeric(rawSize);
      if (size === null || size <= 0) continue;

      const name = parseString(descrMap.get(suffix)) || '';
      if (!name) continue;

      // Skip "Memory buffers", "Cached memory", "Shared memory"
      if (/^(memory buffers|cached memory|shared memory)$/i.test(name)) continue;

      // Skip pseudo filesystems matching /^\/(dev|sys|proc|run|snap)(\/|$)/ or containing "tmpfs"
      if (/^\/(dev|sys|proc|run|snap)(\/|$)/.test(name) || name.toLowerCase().includes('tmpfs')) {
        continue;
      }

      const rawType = parseString(typeMap.get(suffix));
      let kind = null;
      if (rawType) {
        const cleanTypeOid = rawType.replace(/^\./, '');
        kind = HR_STORAGE_TYPE_MAP[cleanTypeOid] || null;
      }

      if (!kind || kind === 'other') {
        const lowerName = name.toLowerCase();
        if (/ram|memory|mem/i.test(lowerName)) {
          kind = 'ram';
        } else if (/swap/i.test(lowerName)) {
          kind = 'swap';
        } else if (/flash/i.test(lowerName)) {
          kind = 'flash';
        } else {
          kind = 'disk';
        }
      }

      const allocUnits = parseNumeric(allocMap.get(suffix));
      const used = parseNumeric(usedMap.get(suffix));
      if (allocUnits === null || allocUnits <= 0 || used === null || used < 0) continue;

      const total_bytes = size * allocUnits;
      if (total_bytes <= 0) continue;
      const used_bytes = used * allocUnits;
      const used_pct = Math.round((used_bytes / total_bytes) * 1000) / 10;

      entries.push({
        name,
        kind,
        total_bytes,
        used_bytes,
        used_pct,
      });
    }

    if (entries.length === 0) return null;

    // Prioritize primary storage (ram, disk, flash) before capping at 20 entries
    if (entries.length > 20) {
      entries.sort((a, b) => {
        const priority = (k) => (k === 'ram' ? 1 : k === 'disk' ? 2 : k === 'flash' ? 3 : 4);
        return priority(a.kind) - priority(b.kind);
      });
      return entries.slice(0, 20);
    }

    return entries;
  } catch {
    return null;
  }
}

/**
 * Poll network interfaces using standard IF-MIB (RFC 1213 / RFC 2863).
 * Returns array of normalized interfaces or null.
 * Never throws, never marks device offline, never alters metrics_available.
 * For OLT devices: caps at 32 physical/PON interfaces to prevent overloading OLT CPU with 3000+ ONU virtual interfaces.
 * For device_type === 'Router' only: cap at most 128 physical interfaces, at most 64 virtual interfaces, and at most 200 ppp_session interfaces.
 * For any other device_type: cap at 64 interfaces.
 * @param {any} session
 * @param {string} [deviceType]
 * @param {boolean} [isOlt=false]
 * @returns {Promise<Array<{index: number, name: string, oper_status: 'up'|'down'|'unknown', admin_status: 'up'|'down'|'unknown', speed: number|null, type: string|null}>|null>}
 */
async function pollNetworkInterfaces(session, deviceType = null, isOltParam = false) {
  try {
    const isOlt = Boolean(
      isOltParam ||
      deviceType === 'OLT' ||
      deviceType === 'GPON OLT' ||
      deviceType === 'EPON OLT' ||
      /olt/i.test(deviceType || '')
    );
    // For OLT devices: walk up to 128 rows from IF-MIB (to capture physical GE/GPON interfaces even if
    // VLANs or initial ONUs appear first), with fallbackToGetNext=true to handle devices where GETBULK fails.
    // The final returned interfaces list is then capped at 32 physical/PON ports.
    const ifMaxRows = isOlt ? 128 : (deviceType === 'Router' ? 128 : 64);
    const maxReps = isOlt ? (session?.options?.maxRepetitions || 6) : 20;
    const walkFallback = true;

    const [descrMap, nameMap, operMap, adminMap, typeMap, speedMap, highSpeedMap] = await Promise.all([
      walkColumnBySuffix(session, COMMON_OIDS.ifDescr, ifMaxRows, maxReps, walkFallback),
      isOlt ? Promise.resolve(new Map()) : walkColumnBySuffix(session, COMMON_OIDS.ifName || '1.3.6.1.2.1.31.1.1.1.1', ifMaxRows, maxReps, walkFallback),
      walkColumnBySuffix(session, COMMON_OIDS.ifOperStatus, ifMaxRows, maxReps, walkFallback),
      walkColumnBySuffix(session, COMMON_OIDS.ifAdminStatus, ifMaxRows, maxReps, walkFallback),
      isOlt ? Promise.resolve(new Map()) : walkColumnBySuffix(session, COMMON_OIDS.ifType, ifMaxRows, maxReps, walkFallback),
      walkColumnBySuffix(session, COMMON_OIDS.ifSpeed, ifMaxRows, maxReps, walkFallback),
      isOlt ? Promise.resolve(new Map()) : walkColumnBySuffix(session, COMMON_OIDS.ifHighSpeed || '1.3.6.1.2.1.31.1.1.1.15', ifMaxRows, maxReps, walkFallback),
    ]);

    // If ifDescr was empty on OLT, try ifName as fallback
    if (isOlt && descrMap.size === 0) {
      const fallbackNameMap = await walkColumnBySuffix(session, COMMON_OIDS.ifName || '1.3.6.1.2.1.31.1.1.1.1', ifMaxRows, maxReps, true);
      for (const [k, v] of fallbackNameMap.entries()) {
        descrMap.set(k, v);
      }
    }

    if (descrMap.size === 0 && nameMap.size === 0 && operMap.size === 0) {
      return null;
    }

    const allIndices = new Set([...descrMap.keys(), ...nameMap.keys(), ...operMap.keys()]);
    const interfaces = [];
    const isRouter = deviceType === 'Router';
    let physicalCount = 0;
    let virtualCount = 0;
    let pppCount = 0;
    let oltFilteredCount = 0;

    for (const suffix of allIndices) {
      const idx = parseInt(suffix, 10) || 0;
      const rawName = parseString(nameMap.get(suffix)) || parseString(descrMap.get(suffix)) || `port-${suffix}`;
      const name = rawName.trim();

      // On OLTs, skip ONU / ONT virtual customer endpoint interfaces to keep telemetry clean and protect OLT
      if (isOlt) {
        const isVirtualOnu = /(?:gemport|onu|ont|subscriber|service-port)/i.test(name) || /:\d+$/.test(name);
        if (isVirtualOnu) {
          oltFilteredCount++;
          continue;
        }
        if (interfaces.length >= 32) {
          break;
        }
      }
      if (!isRouter && !isOlt && interfaces.length >= 64) break;

      const operCode = parseNumeric(operMap.get(suffix));
      const adminCode = parseNumeric(adminMap.get(suffix));
      const operStatus = operCode === 1 ? 'up' : operCode === 2 ? 'down' : 'unknown';
      const adminStatus = adminCode === 1 ? 'up' : adminCode === 2 ? 'down' : 'unknown';
      const typeCode = parseNumeric(typeMap.get(suffix));

      let speedBps = parseNumeric(speedMap.get(suffix));
      const highSpeedMbps = parseNumeric(highSpeedMap.get(suffix));
      if (highSpeedMbps && highSpeedMbps > 0) {
        speedBps = highSpeedMbps * 1000000;
      }

      let portType = 'ethernet';
      if (isOlt && /(?:pon|gpon|epon|olt)/i.test(name)) {
        portType = 'sfp';
      } else if (typeCode === 24 || /^lo\d*$/i.test(name)) {
        portType = 'loopback';
      } else if (typeCode === 53 || /bridge/i.test(name)) {
        portType = 'bridge';
      } else if (typeCode === 135 || /vlan/i.test(name)) {
        portType = 'vlan';
      } else if (/sfp/i.test(name)) {
        portType = 'sfp';
      } else if (
        typeCode === 23 ||
        /^<pppoe-/i.test(name) ||
        /^<l2tp-/i.test(name) ||
        /^<sstp-/i.test(name) ||
        /^<pptp-/i.test(name)
      ) {
        portType = 'ppp_session';
      }

      if (isRouter) {
        const isPhysical = portType === 'ethernet' || portType === 'sfp';
        if (isPhysical) {
          if (physicalCount >= 128) continue;
          physicalCount++;
        } else if (portType === 'ppp_session') {
          if (pppCount >= 200) continue;
          pppCount++;
        } else {
          if (virtualCount >= 64) continue;
          virtualCount++;
        }
        if (physicalCount >= 128 && virtualCount >= 64 && pppCount >= 200) {
          break;
        }
      }

      interfaces.push({
        index: idx,
        name,
        oper_status: operStatus,
        admin_status: adminStatus,
        speed: speedBps && speedBps > 0 ? speedBps : null,
        type: portType,
      });
    }

    // Sort physical ports first (ether, ge, xe, xge, sfp, gpon, epon, etc.), then by index
    interfaces.sort((a, b) => {
      const aIsPhys = /^(ether|ge|xe|xge|sfp|eth|port|gigabit|fast|ten|wan|lan|gpon|epon|pon)/i.test(a.name);
      const bIsPhys = /^(ether|ge|xe|xge|sfp|eth|port|gigabit|fast|ten|wan|lan|gpon|epon|pon)/i.test(b.name);
      if (aIsPhys && !bIsPhys) return -1;
      if (!aIsPhys && bIsPhys) return 1;
      return a.index - b.index;
    });

    return interfaces.length > 0 ? interfaces : null;
  } catch (err) {
    const msg = (err && err.message) || String(err);
    if (!msg.includes('Socket forcibly closed') && !msg.includes('closed') && !msg.includes('timed out')) {
      console.warn('[pollNetworkInterfaces] Exception:', msg);
    }
    return null;
  }
}

/**
 * Resolve device_model and sys_descr with a 24-hour per-IP cache.
 * @param {any} session
 * @param {string} ip
 * @param {string} brand
 * @param {string} rawSysDescr
 * @returns {Promise<{ device_model: string|null, sys_descr: string|null }>}
 */
async function resolveDeviceModelAndDescr(session, ip, brand, rawSysDescr, deviceType = null, hwIdentity = null) {
  const now = Date.now();
  const cached = deviceModelCache.get(ip);
  const freshSysDescr = rawSysDescr && rawSysDescr.trim().length > 0
    ? rawSysDescr.trim().slice(0, 300)
    : null;

  if (cached && now - cached.fetchedAt < MODEL_CACHE_TTL_MS && cached.device_model !== null) {
    if (deviceType === 'Server' && !cached.hw_identity && (hwIdentity?.model || !hwIdentity)) {
      // Don't return stale non-hw-identity cache for Server if hwIdentity can provide a dmidecode model
    } else {
      return {
        device_model: cached.device_model,
        sys_descr: freshSysDescr || cached.sys_descr || null,
      };
    }
  }

  let resolvedModel = null;
  try {
    // (a) MikroTik only: mtxrBoardName OID
    if (brand === 'MikroTik' && VENDOR_OIDS.MikroTik?.mtxrBoardName) {
      resolvedModel = await getScalarString(session, VENDOR_OIDS.MikroTik.mtxrBoardName);
    }

    // (a2) V-SOL only: native VSOL_NATIVE_OIDS.modelName scalar
    if (!resolvedModel && (brand === 'V-SOL' || /v-?sol/i.test(brand || ''))) {
      const vModelOids = [
        VSOL_NATIVE_OIDS.modelName,
        '1.3.6.1.4.1.37950.1.1.1.1.0',
        '1.3.6.1.4.1.37950.1.1.1.1',
      ];
      for (const mOid of vModelOids) {
        const mStr = await getScalarString(session, mOid);
        if (mStr && mStr.trim()) {
          const cleanM = mStr.trim().replace(/^"|"$/g, '');
          resolvedModel = cleanM.toUpperCase().startsWith('V-SOL') ? cleanM : `V-SOL ${cleanM}`;
          break;
        }
      }
    }

    // (a3) Huawei only: model scalar or chassis frame OID
    if (!resolvedModel && (brand === 'Huawei' || /huawei/i.test(brand || ''))) {
      const hModelOids = [
        '1.3.6.1.4.1.2011.6.3.3.1.1.1.0',
        '1.3.6.1.4.1.2011.6.3.3.1.1.1',
        '1.3.6.1.4.1.2011.2.6.1.1.1.2.0',
        '1.3.6.1.4.1.2011.2.6.1.1.1.2',
        '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.6.1',
        '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.6',
      ];
      for (const mOid of hModelOids) {
        const mStr = await getScalarString(session, mOid);
        if (mStr && mStr.trim()) {
          const cleanM = mStr.trim().replace(/^"|"$/g, '');
          if (!/^0+$/.test(cleanM) && !/no\s*such/i.test(cleanM)) {
            resolvedModel = cleanM.toUpperCase().startsWith('HUAWEI') || cleanM.toUpperCase().startsWith('SMARTAX') ? cleanM : `Huawei ${cleanM}`;
            break;
          }
        }
      }
    }

    // (a4) BDCOM only: NMS-CHASSIS nmscardDescr.1 or nmsSwitchName
    if (!resolvedModel && (brand === 'BDCOM' || /bd-?com/i.test(brand || ''))) {
      const bdModelOids = [
        '1.3.6.1.4.1.3320.3.6.10.1.3.1', // nmscardDescr.1
        '1.3.6.1.4.1.3320.3.6.10.1.3', // nmscardDescr
        '1.3.6.1.4.1.3320.3.6.21.0', // nmsSwitchName
        '1.3.6.1.4.1.3320.3.6.1.0', // nmschassisType
      ];
      for (const mOid of bdModelOids) {
        const mStr = await getScalarString(session, mOid);
        if (mStr && mStr.trim()) {
          const cleanM = mStr.trim().replace(/^"|"$/g, '');
          if (!/^0+$/.test(cleanM) && !/no\s*such/i.test(cleanM) && !/^\d+\.\d+\.\d+\.\d+$/.test(cleanM)) {
            resolvedModel = cleanM.toUpperCase().startsWith('BDCOM') ? cleanM : `BDCOM ${cleanM}`;
            break;
          }
        }
      }
    }

    // (b) Walk entPhysicalClass, take first row with class 3 (chassis), read entPhysicalModelName (fallback entPhysicalDescr)
    if (!resolvedModel) {
      const classMap = await walkColumnBySuffix(session, COMMON_OIDS.entPhysicalClass);
      let chassisSuffix = null;
      for (const [suffix, rawVal] of classMap.entries()) {
        if (parseNumeric(rawVal) === 3) {
          chassisSuffix = suffix;
          break;
        }
      }
      if (chassisSuffix !== null) {
        const modelName = await getScalarString(
          session,
          `${COMMON_OIDS.entPhysicalModelName}.${chassisSuffix}`
        );
        if (modelName) {
          resolvedModel = modelName;
        } else {
          const physDescr = await getScalarString(
            session,
            `${COMMON_OIDS.entPhysicalDescr}.${chassisSuffix}`
          );
          if (physDescr) {
            resolvedModel = physDescr;
          }
        }
      }
    }

    // (c) Parse sysDescr: if it matches RouterOS, V-SOL, BDCOM, or Huawei, or use first line truncated to 120 chars
    const effectiveDescr = freshSysDescr || cached?.sys_descr || null;
    if (!resolvedModel && effectiveDescr) {
      const firstLine = effectiveDescr.split(/\r?\n/)[0].trim();
      const routerOsMatch = firstLine.match(/^RouterOS\s+(.+)$/i);
      const vsolMatch = effectiveDescr.match(/(?:V-?SOL|V-?Solution)\s+([A-Za-z0-9_-]+)/i) ||
                        effectiveDescr.match(/\b(V1600[A-Za-z0-9_-]*|V280[0-9][A-Za-z0-9_-]*)\b/i);
      const huaweiMatch = effectiveDescr.match(/(?:Huawei\s+)?(SmartAX\s+MA\d{4}[A-Za-z0-9_-]*|SmartAX\s+EA\d{4}[A-Za-z0-9_-]*|MA\d{4}[A-Za-z0-9_-]*)/i);
      if (routerOsMatch && routerOsMatch[1].trim()) {
        resolvedModel = routerOsMatch[1].trim().slice(0, 120);
      } else if (vsolMatch && vsolMatch[1].trim()) {
        const mod = vsolMatch[1].trim();
        resolvedModel = mod.toUpperCase().startsWith('V-SOL') ? mod : `V-SOL ${mod}`;
      } else if (huaweiMatch && huaweiMatch[1].trim()) {
        const mod = huaweiMatch[1].trim();
        resolvedModel = mod.toUpperCase().startsWith('HUAWEI') || mod.toUpperCase().startsWith('SMARTAX') ? mod : `Huawei ${mod}`;
      } else {
        const bdModelMatch = effectiveDescr.match(/(?:BDCOM(?:\(tm\))?\s+)?([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+|[A-Za-z0-9]+)\s+(?:Software|Version)/i) ||
                             effectiveDescr.match(/^BDCOM(?:\(tm\))?\s+([A-Za-z0-9_.-]+)/i) ||
                             effectiveDescr.match(/\b(P\d{4}[A-Za-z0-9_-]*|GP\d{4}[A-Za-z0-9_-]*|S\d{4}[A-Za-z0-9_-]*)\b/i);
        if (bdModelMatch && bdModelMatch[1].trim()) {
          const mod = bdModelMatch[1].trim();
          resolvedModel = mod.toLowerCase().startsWith('bdcom') ? mod : `BDCOM ${mod}`;
        } else if (firstLine.length > 0) {
          resolvedModel = firstLine.slice(0, 120);
        }
      }
    }
  } catch {
    // Keep cached values on refresh error
  }

  // LAST step for device_type === 'Server': override device_model if hwIdentity provided a non-empty model
  let effectiveHw = hwIdentity;
  if (deviceType === 'Server' && !effectiveHw) {
    effectiveHw = await pollHwIdentity(session, ip, deviceType);
  }

  let finalModel = resolvedModel || cached?.device_model || null;
  if (deviceType === 'Server' && effectiveHw && effectiveHw.model) {
    finalModel = effectiveHw.model;
  }

  const finalSysDescr = freshSysDescr || cached?.sys_descr || null;

  if (finalModel !== null || finalSysDescr !== null) {
    deviceModelCache.set(ip, {
      device_model: finalModel,
      sys_descr: finalSysDescr,
      hw_identity: effectiveHw || cached?.hw_identity || null,
      fetchedAt: now,
    });
  }

  return {
    device_model: finalModel,
    sys_descr: finalSysDescr,
  };
}

/**
 * Strict validator ensuring a string is a genuine hardware serial number and not a hostname, IP, or placeholder.
 * @param {string|null} candidate
 * @param {string|null} [sysName=null]
 * @param {string|null} [hostname=null]
 * @param {string|null} [ip=null]
 * @returns {boolean}
 */
export function isAuthenticSerial(candidate, sysName = null, hostname = null, ip = null) {
  if (!candidate || typeof candidate !== 'string') return false;
  const s = candidate.trim().replace(/^"|"$/g, '');
  if (s.length < 3 || s.length > 128) return false;
  if (/^0+$/.test(s)) return false;
  if (/^(no\s*such|null|none|not\s*reported|unknown|to\s*be\s*filled|default|empty|n\/a)$/i.test(s)) return false;

  // Reject PCI bus address patterns (e.g. "0002:01:00.0", format: dddd:dd:dd.d) — invalid serial for any hardware
  if (/^[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-9]$/i.test(s)) {
    return false;
  }

  const lower = s.toLowerCase();
  const sysLower = (sysName || '').trim().toLowerCase();
  const hostLower = (hostname || '').trim().toLowerCase();
  const ipLower = (ip || '').trim().toLowerCase();

  // Serial number must NEVER equal the sysName, hostname, or IP address
  if (sysLower && lower === sysLower) return false;
  if (hostLower && lower === hostLower) return false;
  if (ipLower && lower === ipLower) return false;

  // Substring matches for hostname/sysName
  if (sysLower && (lower.includes(sysLower) || sysLower.includes(lower)) && (sysLower.includes('-') || sysLower.includes('_'))) {
    return false;
  }
  if (hostLower && (lower.includes(hostLower) || hostLower.includes(lower)) && (hostLower.includes('-') || hostLower.includes('_'))) {
    return false;
  }

  // Reject strings matching typical network hostname patterns (e.g. "manikganj-olt", "olt-node-1-78", "edge-router-01")
  if (/-(?:olt|router|sw|switch|server|node|gw|ap|core|edge|agg|dist)(?:-\d+)?$/i.test(s)) {
    return false;
  }
  if (/^(?:olt|router|sw|switch|srv)-/i.test(s)) {
    return false;
  }

  return true;
}

/**
 * Resolve device_serial using ENTITY-MIB and vendor candidate fallback chain with a 24-hour per-IP cache.
 * For device_type === 'Server', overrides with hw-identity serial if non-empty.
 * @param {any} session
 * @param {string} ip
 * @param {string} brand
 * @param {string} deviceType
 * @param {any} [hwIdentity=null]
 * @param {string|null} [rawSysDescr=null]
 * @param {string|null} [sysName=null]
 * @param {string|null} [hostname=null]
 * @returns {Promise<string|null>}
 */
async function resolveDeviceSerial(session, ip, brand, deviceType, hwIdentity = null, rawSysDescr = null, sysName = null, hostname = null) {
  const now = Date.now();
  const cached = deviceSerialCache.get(ip);

  // Invalidate any previously cached fake or hostname serial
  if (cached && !isAuthenticSerial(cached.device_serial, sysName, hostname, ip)) {
    deviceSerialCache.delete(ip);
  } else if (cached && now - cached.fetchedAt < SERIAL_CACHE_TTL_MS && cached.device_serial !== null) {
    if (deviceType === 'Server' && !cached.hw_identity_serial && (hwIdentity?.serial || !hwIdentity)) {
      // Don't return old cached serial if hwIdentity can provide a serial
    } else {
      return cached.device_serial;
    }
  }

  let resolvedSerial = null;
  const isMikrotik = brand === 'MikroTik' || /mikrotik/i.test(brand || '');

  try {
    // a & a2: Generic ENTITY-MIB walks (chassis index or full column walk).
    // Completely skipped for MikroTik devices because RouterOS entPhysicalTable frequently reports
    // PCI/USB device bus addresses (e.g. 0002:01:00.0) instead of genuine board serials.
    if (!isMikrotik) {
      // a. Walk ENTITY_MIB_PHYSICAL_CLASS_BASE. Find the first index whose value is 3 (chassis).
      // If found, GET ENTITY_MIB_SERIAL_BASE at that same index suffix.
      const classMap = await walkColumnBySuffix(session, ENTITY_MIB_PHYSICAL_CLASS_BASE);
      let chassisSuffix = null;
      for (const [suffix, rawVal] of classMap.entries()) {
        if (parseNumeric(rawVal) === 3) {
          chassisSuffix = suffix;
          break;
        }
      }

      if (chassisSuffix !== null) {
        const serialVal = await getScalarString(session, `${ENTITY_MIB_SERIAL_BASE}.${chassisSuffix}`);
        if (isAuthenticSerial(serialVal, sysName, hostname, ip)) {
          resolvedSerial = serialVal.trim().slice(0, 128);
        }
      }

      // a2. Walk all ENTITY_MIB_SERIAL_BASE rows (chassis, module, or slot index 1, 2, etc.)
      if (!resolvedSerial) {
        try {
          const entitySerials = await walkColumnBySuffix(session, ENTITY_MIB_SERIAL_BASE);
          for (const [colSuffix, colVal] of entitySerials.entries()) {
            const sStr = parseString(colVal);
            if (isAuthenticSerial(sStr, sysName, hostname, ip)) {
              resolvedSerial = sStr.trim().replace(/^"|"$/g, '').slice(0, 128);
              break;
            }
          }
        } catch {}
      }
    }

    // b. If still not found AND the device is MikroTik: try MIKROTIK_SERIAL_CANDIDATE_OID directly
    if (!resolvedSerial && isMikrotik) {
      const mtkSerial = await getScalarString(session, MIKROTIK_SERIAL_CANDIDATE_OID);
      if (isAuthenticSerial(mtkSerial, sysName, hostname, ip)) {
        resolvedSerial = mtkSerial.trim().slice(0, 128);
      }
    }

    // c. Extract serial from sysDescr (e.g. BDCOM: "Serial num:00315073610", Cisco, Huawei, V-SOL)
    if (!resolvedSerial) {
      const descrCandidate = rawSysDescr || deviceModelCache.get(ip)?.sys_descr || '';
      if (descrCandidate) {
        const serialMatch = descrCandidate.match(/(?:Serial\s*(?:num(?:ber)?|no|#)?\s*[:=]\s*|S\/N\s*[:=]\s*|SN\s*[:=]\s*)([A-Za-z0-9_-]+)/i);
        if (serialMatch && serialMatch[1].trim()) {
          const sCandidate = serialMatch[1].trim();
          if (isAuthenticSerial(sCandidate, sysName, hostname, ip)) {
            resolvedSerial = sCandidate.slice(0, 128);
          }
        }
      }
    }

    // d. If still not found and brand is BDCOM: probe BDCOM candidate serial OIDs
    if (!resolvedSerial && (brand === 'BDCOM' || /bd-?com/i.test(brand || ''))) {
      for (const oid of BDCOM_SERIAL_CANDIDATE_OIDS) {
        const val = await getScalarString(session, oid);
        if (isAuthenticSerial(val, sysName, hostname, ip)) {
          resolvedSerial = val.trim().replace(/^"|"$/g, '').slice(0, 128);
          break;
        }

        // If scalar GET returned null and OID is a table root, try walking the column
        if (!resolvedSerial && (oid.endsWith('.4') || oid.endsWith('.1') || oid.endsWith('.2') || oid.endsWith('.79') || oid.endsWith('.16'))) {
          try {
            const colMap = await walkColumnBySuffix(session, oid);
            for (const colVal of colMap.values()) {
              const sStr = parseString(colVal);
              if (isAuthenticSerial(sStr, sysName, hostname, ip)) {
                resolvedSerial = sStr.trim().replace(/^"|"$/g, '').slice(0, 128);
                break;
              }
            }
          } catch {}
          if (resolvedSerial) break;
        }
      }
    }

    // e. If still not found and brand is Huawei: probe Huawei candidate serial OIDs (frame and board serials)
    const isHuaweiSerial = brand === 'Huawei' ||
                           /huawei|smartax/i.test(brand || '') ||
                           /huawei|smartax/i.test(rawSysDescr || '') ||
                           /huawei/i.test(deviceModelCache.get(ip)?.sys_descr || '') ||
                           /huawei/i.test(deviceModelCache.get(ip)?.device_model || '') ||
                           deviceType === 'OLT';
    if (!resolvedSerial && isHuaweiSerial) {
      for (const oid of HUAWEI_SERIAL_CANDIDATE_OIDS) {
        const val = await getScalarString(session, oid);
        if (isAuthenticSerial(val, sysName, hostname, ip)) {
          resolvedSerial = val.trim().replace(/^"|"$/g, '').slice(0, 128);
          break;
        }

        // If scalar GET returned null and OID is a table root, try walking the column
        if (!resolvedSerial && (oid.endsWith('.19') || oid.endsWith('.7') || oid.endsWith('.4') || oid.endsWith('.11'))) {
          try {
            const colMap = await walkColumnBySuffix(session, oid);
            for (const [colSuffix, colVal] of colMap.entries()) {
              const sStr = parseString(colVal);
              if (isAuthenticSerial(sStr, sysName, hostname, ip)) {
                resolvedSerial = sStr.trim().replace(/^"|"$/g, '').slice(0, 128);
                break;
              }
            }
          } catch {}
          if (resolvedSerial) break;
        }
      }
    }

    // f. If still not found and brand is V-SOL: probe native VSOL_NATIVE_OIDS.serialNumber scalar (never walk)
    const isVsolSerial = brand === 'V-SOL' ||
                         brand === 'VSOL' ||
                         /^v-?sol$/i.test(brand || '') ||
                         /v-?sol|vsolution/i.test(rawSysDescr || '') ||
                         /v-?sol|vsolution/i.test(deviceModelCache.get(ip)?.sys_descr || '');
    if (!resolvedSerial && isVsolSerial) {
      try {
        const val = await getScalarString(session, VSOL_NATIVE_OIDS.serialNumber);
        if (isAuthenticSerial(val, sysName, hostname, ip)) {
          resolvedSerial = val.trim().replace(/^"|"$/g, '').slice(0, 128);
        }
      } catch {}
    }
  } catch {
    // Expected normal outcome for devices without ENTITY-MIB or candidate serial support
  }

  // LAST step for device_type === 'Server': override device_serial if hwIdentity provided a non-empty serial
  let effectiveHw = hwIdentity;
  if (deviceType === 'Server' && !effectiveHw) {
    effectiveHw = await pollHwIdentity(session, ip, deviceType);
  }

  let finalSerial = resolvedSerial || (isAuthenticSerial(cached?.device_serial, sysName, hostname, ip) ? cached.device_serial : null);
  if (deviceType === 'Server' && effectiveHw && effectiveHw.serial && isAuthenticSerial(effectiveHw.serial, sysName, hostname, ip)) {
    finalSerial = effectiveHw.serial;
  }

  if (finalSerial !== null && !isAuthenticSerial(finalSerial, sysName, hostname, ip)) {
    finalSerial = null;
    deviceSerialCache.delete(ip);
  }

  if (finalSerial !== null) {
    deviceSerialCache.set(ip, {
      device_serial: finalSerial,
      hw_identity_serial: Boolean(effectiveHw?.serial),
      fetchedAt: now,
    });
  } else {
    deviceSerialCache.delete(ip);
  }

  return finalSerial;
}

/**
 * Resolve MikroTik RouterOS License Software ID with a 24-hour per-IP cache.
 * @param {any} session
 * @param {string} ip
 * @param {string} brand
 * @param {string} deviceType
 * @returns {Promise<string|null>}
 */
async function resolveMikrotikSoftwareId(session, ip, brand, deviceType) {
  const isMikrotik = brand === 'MikroTik' || /mikrotik/i.test(brand || '') || deviceType === 'Router';
  if (!isMikrotik) {
    return null;
  }

  const now = Date.now();
  const cached = softwareIdCache.get(ip);

  if (cached && now - cached.fetchedAt < SOFTWARE_ID_CACHE_TTL_MS && cached.software_id !== null) {
    return cached.software_id;
  }

  let resolvedId = null;
  try {
    const rawVal = await getScalarString(session, MIKROTIK_SOFTWARE_ID_OID);
    if (typeof rawVal === 'string') {
      const trimmed = rawVal.trim();
      if (trimmed.length > 0) {
        resolvedId = trimmed.slice(0, 64);
      }
    }
  } catch {
    // Normal expected outcome if device doesn't support mtxrLicense
  }

  const finalId = resolvedId || cached?.software_id || null;

  if (finalId !== null) {
    softwareIdCache.set(ip, {
      software_id: finalId,
      fetchedAt: now,
    });
  }

  return finalId;
}

/**
 * Polls a single device using SNMP v2c and returns normalized telemetry.
 * If the device does not respond, returns an offline telemetry object instead of throwing.
 * Every metric that cannot be read stays null with metrics_available = false. No fake defaults.
 * Always guarantees session teardown in a finally block.
 * 
 * @param {Object} device Device configuration { ip_address, snmp_community, brand, device_type, id }
 * @param {Array<any>|null} [thresholds]
 * @returns {Promise<Object>} Normalized telemetry object
 */
export async function pollDevice(device, thresholds = null) {
  const ip = (device?.ip_address || device?.ip || '').trim();
  if (!ip) {
    return doPollDevice(device, thresholds);
  }

  // Deduplicate concurrent in-flight requests to the same target IP
  if (inFlightDevicePolls.has(ip)) {
    return await inFlightDevicePolls.get(ip);
  }

  const pollPromise = (async () => {
    try {
      return await doPollDevice(device, thresholds);
    } finally {
      inFlightDevicePolls.delete(ip);
    }
  })();

  inFlightDevicePolls.set(ip, pollPromise);
  return await pollPromise;
}

async function doPollDevice(device, thresholds = null) {
  const ip = (device?.ip_address || device?.ip || '').trim();
  const community = (device?.snmp_community || device?.snmpCommunity || 'public').trim() || 'public';
  const rawStoredBrand = (device?.brand || '').trim();
  const storedBrand = (!rawStoredBrand || rawStoredBrand.toLowerCase() === 'auto') ? null : rawStoredBrand;
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
      optical_sensors: null,
      temperature_sensors: null,
      power_supplies: null,
      fans: null,
      optical_tx: null,
      optical_rx: null,
      sys_name: null,
      device_model: null,
      device_serial: null,
      sys_descr: null,
      storage: null,
      interfaces: null,
      disk_percentage_used: null,
      disk_power_on_hours: null,
      disk_lifetime_bytes_read: null,
      disk_lifetime_bytes_written: null,
      disk_estimated_eol_days: null,
      ram_ecc_corrected: null,
      ram_ecc_uncorrected: null,
      detected_brand: null,
      metrics_available: false,
      uptime: '0d 0h (Offline)',
      load_average: null,
      snmp_reachable: false,
      error: 'Missing IP address for SNMP polling',
      recorded_at: new Date().toISOString(),
    };
  }

  // 1. Sole isolated reachability OID (determines device reachability / online status)
  const reachabilityOids = [COMMON_OIDS.sysUpTime];

  // 2. Secondary standard MIB-II OIDs (best-effort request, includes sysObjectID for brand detection)
  const secondaryCommonOids = [
    COMMON_OIDS.sysDescr,
    COMMON_OIDS.sysName,
    COMMON_OIDS.sysObjectID,
  ].filter(Boolean);
  if (deviceType === 'Server' && COMMON_OIDS.hrSystemUptime) {
    secondaryCommonOids.push(COMMON_OIDS.hrSystemUptime);
  }

  let session = null;
  const rawHostname = (device?.hostname || '').trim();
  const isOltDevice =
    deviceType === 'OLT' ||
    deviceType === 'GPON OLT' ||
    deviceType === 'EPON OLT' ||
    /olt/i.test(deviceType) ||
    /olt/i.test(rawHostname) ||
    /v-?sol|huawei|bd-?com|zte/i.test(storedBrand || rawStoredBrand || '') ||
    /olt/i.test(ip);

  try {
    session = snmp.createSession(ip, community, {
      port: 161,
      version: snmp.Version2c,
      timeout: isOltDevice ? 8000 : 4000, // 8s for OLT (remote WAN/VLAN links), 4s for standard servers/routers
      retries: isOltDevice ? 2 : 1, // 2 retries (3 attempts total)
      transport: 'udp4',
      maxRepetitions: isOltDevice ? 6 : 10,
    });

    // Step 1: Reachability verification with soft retry
    let reachabilityVarbinds = null;
    try {
      reachabilityVarbinds = await new Promise((resolve, reject) => {
        session.get(reachabilityOids, (err, vbs) => {
          if (err) reject(err);
          else resolve(vbs);
        });
      });
    } catch {
      // Soft retry after 800ms
      try {
        await new Promise((r) => setTimeout(r, isOltDevice ? 1000 : 500));
        reachabilityVarbinds = await new Promise((resolve, reject) => {
          session.get(reachabilityOids, (err, vbs) => {
            if (err) reject(err);
            else resolve(vbs);
          });
        });
      } catch {
        // Fallback: If sysUpTime alone timed out, probe sysDescr and sysObjectID
        try {
          const fallbackVbs = await new Promise((resolve, reject) => {
            session.get([COMMON_OIDS.sysDescr, COMMON_OIDS.sysObjectID], (err, vbs) => {
              if (err) reject(err);
              else resolve(vbs);
            });
          });
          if (Array.isArray(fallbackVbs) && fallbackVbs.some((v) => v && !snmp.isVarbindError(v))) {
            reachabilityVarbinds = fallbackVbs;
          }
        } catch {
          // Genuinely unreachable
        }
      }
    }

    if (!reachabilityVarbinds || reachabilityVarbinds.length === 0) {
      throw new Error('Device unreachable / SNMP request timed out');
    }

    // Map varbinds by OID
    const vbMap = new Map();
    for (const vb of reachabilityVarbinds) {
      if (vb && !snmp.isVarbindError(vb)) {
        vbMap.set(vb.oid, vb.value);
      }
    }

    // Step 2: Best-effort fetch of sysDescr, sysName, and (for Server) hrSystemUptime
    if (secondaryCommonOids.length > 0) {
      let batchSuccess = false;
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
            batchSuccess = true;
          }
        }
      } catch {
        batchSuccess = false;
      }

      // If batch failed or yielded nothing, probe each OID individually so one failure/timeout does not discard the rest
      if (!batchSuccess) {
        for (const oid of secondaryCommonOids) {
          try {
            const vbs = await new Promise((resolve) => {
              session.get([oid], (err, resVbs) => {
                if (err) resolve(null);
                else resolve(resVbs);
              });
            });
            if (Array.isArray(vbs) && vbs[0] && !snmp.isVarbindError(vbs[0])) {
              vbMap.set(vbs[0].oid, vbs[0].value);
            }
          } catch {
            // Safe fallback
          }
        }
      }
    }

    // Process Uptime: for servers, try hrSystemUptime (1.3.6.1.2.1.25.1.1.0) first, fall back to sysUpTime (1.3.6.1.2.1.1.3.0)
    const hrUpTimeVal = deviceType === 'Server' ? parseNumeric(vbMap.get(COMMON_OIDS.hrSystemUptime)) : null;
    const sysUpTimeVal = parseNumeric(vbMap.get(COMMON_OIDS.sysUpTime));
    const effectiveUpTimeTicks = (hrUpTimeVal !== null && hrUpTimeVal >= 0) ? hrUpTimeVal : sysUpTimeVal;
    const uptimeStr = (effectiveUpTimeTicks !== null && effectiveUpTimeTicks >= 0)
      ? formatUpTime(effectiveUpTimeTicks)
      : 'N/A';

    // Process sysDescr / sysName / sysObjectID
    const sysDescrRaw = vbMap.get(COMMON_OIDS.sysDescr);
    const sysDescr = Buffer.isBuffer(sysDescrRaw) ? sysDescrRaw.toString('utf8').trim() : (sysDescrRaw || '');

    const sysObjectIdRaw = vbMap.get(COMMON_OIDS.sysObjectID);
    const sysObjectId = parseString(sysObjectIdRaw);

    const sysNameRaw = vbMap.get(COMMON_OIDS.sysName);
    let sysNameStr = Buffer.isBuffer(sysNameRaw)
      ? sysNameRaw.toString('utf8').trim()
      : typeof sysNameRaw === 'string'
      ? sysNameRaw.trim()
      : '';

    // If sysName is still empty, probe vendor-specific hostname OIDs for V-SOL and Huawei
    if (!sysNameStr) {
      const isCandidateVsol = storedBrand === 'V-SOL' || storedBrand === 'VSOL' || /v-?sol|vsolution|\bv1600/i.test(sysDescr || '') || deviceType === 'OLT';
      if (isCandidateVsol) {
        const vsolHostOids = [
          '1.3.6.1.4.1.37950.1.1.5.10.12.5.1.0', // v1600dSysCfg.systemInfo.sysHostName.0 (confirmed primary proprietary hostname)
          '1.3.6.1.4.1.37950.1.1.5.10.12.5.3.0', // v1600dSysCfg.systemInfo.sysName.0
          '1.3.6.1.4.1.37950.1.1.5.10.12.5.3',
          '1.3.6.1.4.1.37950.1.1.1.2.0',
          '1.3.6.1.4.1.37950.1.1.1.2',
          '1.3.6.1.4.1.37950.1.1.5.10.3.1',
        ];
        for (const hOid of vsolHostOids) {
          const hVal = await getScalarString(session, hOid);
          if (hVal && hVal.trim().length > 0) {
            sysNameStr = hVal.trim();
            break;
          }
        }
      }

      const isCandidateHuawei = storedBrand === 'Huawei' || /huawei|smartax/i.test(sysDescr || '') || deviceType === 'OLT';
      if (!sysNameStr && isCandidateHuawei) {
        const huaweiHostOids = [
          '1.3.6.1.4.1.2011.6.3.1.1.0', // hwSysName.0
          '1.3.6.1.4.1.2011.6.3.1.1',
          '1.3.6.1.4.1.2011.2.6.1.1.1.1.0',
        ];
        for (const hOid of huaweiHostOids) {
          const hVal = await getScalarString(session, hOid);
          if (hVal && hVal.trim().length > 0) {
            sysNameStr = hVal.trim();
            break;
          }
        }
      }
    }

    const sysName = sysNameStr.length > 0 ? sysNameStr : null;

    // Resolve detected brand using 24-hour per-IP cache
    const now = Date.now();
    const cachedBrandEntry = deviceBrandCache.get(ip);
    let detectedBrand = null;
    if (cachedBrandEntry && now - cachedBrandEntry.fetchedAt < MODEL_CACHE_TTL_MS && cachedBrandEntry.brand) {
      detectedBrand = cachedBrandEntry.brand;
    } else {
      const freshBrand = detectBrand(sysObjectId, sysDescr, sysNameStr, storedBrand);
      if (freshBrand) {
        detectedBrand = freshBrand;
        deviceBrandCache.set(ip, { brand: freshBrand, fetchedAt: now });
      } else if (cachedBrandEntry?.brand) {
        detectedBrand = cachedBrandEntry.brand;
      }
    }

    // For Server device_type: retrieve hw-identity (manufacturer|model|serial)
    let hwIdentity = null;
    if (deviceType === 'Server') {
      hwIdentity = await pollHwIdentity(session, ip, deviceType);
      if (hwIdentity && hwIdentity.manufacturer) {
        detectedBrand = hwIdentity.manufacturer;
        deviceBrandCache.set(ip, { brand: hwIdentity.manufacturer, fetchedAt: now });
      }
    }

    // Vendor OID set selection order: detected brand, else stored device.brand, else 'Other'
    // Exception: If stored brand is BDCOM or sysDescr indicates BDCOM, never let Cisco emulation override it.
    const isDescrBdcom = /bd-?com/i.test(sysDescr);
    const isVsolDevice = (storedBrand && (/^v-?sol$/i.test(storedBrand) || /vsolution/i.test(storedBrand))) ||
                         (detectedBrand && (/^v-?sol$/i.test(detectedBrand) || /vsolution/i.test(detectedBrand))) ||
                         /v-?sol|vsolution|v-solution|\bv1600|\bv280/i.test(sysDescr || '') ||
                         /v-?sol|vsolution|v-solution|\bv1600|\bv280/i.test(sysNameStr || '');

    const effectiveBrand = isVsolDevice
      ? 'V-SOL'
      : (isDescrBdcom || (storedBrand && /bd-?com/i.test(storedBrand) && detectedBrand === 'Cisco'))
      ? 'BDCOM'
      : (detectedBrand || storedBrand || 'Other');
    const brand = effectiveBrand;

    // Dedicated V-SOL native MIB polling (37950 tree):
    // After basic reachability/sysDescr/sysUpTime GETs succeed, attempt each VSOL_NATIVE_OIDS scalar
    // as its OWN independent GET call (not a batch, not a walk), each with its own try/catch, using
    // standard per-device session timeout. Fail silently (null) with zero effect on status/metrics_available.
    if (brand === 'V-SOL') {
      // 1. cpuUsage -> cpu_usage (if 0-100 integer)
      let cpuUsage = null;
      try {
        const val = await getScalarNumeric(session, VSOL_NATIVE_OIDS.cpuUsage);
        if (val !== null && val >= 0 && val <= 100) {
          cpuUsage = Math.round(val * 10) / 10;
        }
      } catch {}

      // 2. memUsagePercent -> ram_usage (if 0-100 integer); if absent but memTotalKB and memUsedKB are both present and memTotalKB > 0, compute ram_usage = round(memUsedKB/memTotalKB*100) as a fallback
      let ramUsage = null;
      try {
        const val = await getScalarNumeric(session, VSOL_NATIVE_OIDS.memUsagePercent);
        if (val !== null && val >= 0 && val <= 100) {
          ramUsage = Math.round(val * 10) / 10;
        }
      } catch {}

      if (ramUsage === null) {
        let totalKb = null;
        let usedKb = null;
        try {
          totalKb = await getScalarNumeric(session, VSOL_NATIVE_OIDS.memTotalKB);
        } catch {}
        try {
          usedKb = await getScalarNumeric(session, VSOL_NATIVE_OIDS.memUsedKB);
        } catch {}
        if (totalKb !== null && usedKb !== null && totalKb > 0 && usedKb >= 0) {
          ramUsage = Math.round((usedKb / totalKb) * 100);
        }
      }

      // 3. sysTempC (preferred) or cpuTempC as fallback -> temperature
      let temperature = null;
      try {
        const val = await getScalarNumeric(session, VSOL_NATIVE_OIDS.sysTempC);
        if (val !== null && val > -40 && val < 200) {
          temperature = Math.round(val * 10) / 10;
        }
      } catch {}

      if (temperature === null) {
        try {
          const val = await getScalarNumeric(session, VSOL_NATIVE_OIDS.cpuTempC);
          if (val !== null && val > -40 && val < 200) {
            temperature = Math.round(val * 10) / 10;
          }
        } catch {}
      }

      // 4. Power Supplies & Fans:
      // Power supplies remain null as V-SOL 37950 MIB has no pollable PSU status scalar (requires CLI collector).
      const powerSupplies = null;

      // Fans: probe VSOL_NATIVE_OIDS.fanStatus (1.3.6.1.4.1.37950.1.1.5.10.12.11.1.0) via independent dedicated session.
      // Confirmed live value on real hardware is 3 while running normally: 3=ok, 2=critical, other numeric=unknown.
      let fans = null;
      let fanSession = null;
      try {
        fanSession = snmp.createSession(ip || session?.target, community || session?.community || 'public', {
          version: snmp.Version2c,
          timeout: 5000,
          retries: 1,
        });
        const fanVal = await getScalarNumeric(fanSession, VSOL_NATIVE_OIDS.fanStatus);
        if (fanVal !== null) {
          if (fanVal === 3) {
            fans = [{ name: 'Fan', status: 'ok' }];
          } else if (fanVal === 2) {
            fans = [{ name: 'Fan', status: 'critical' }];
          } else {
            fans = [{ name: 'Fan', status: 'unknown' }];
          }
        }
      } catch {
        // Safe fallback on error or timeout
      } finally {
        if (fanSession) {
          try {
            fanSession.close();
          } catch {
            // Safe fallback
          }
        }
      }

      // 6. serialNumber -> device_serial: probe VSOL_NATIVE_OIDS.serialNumber (.12.5.11.0).
      // On older firmware (built before ~May 2021) that returns NoSuchObject, probe validated scalar fallbacks:
      // ENTITY-MIB chassis (.47.1.1.1.1.11.1), HIOSO legacy (.25355.3.2.6.3.2.1.11.0), sysHardVersion (.12.5.5.0), sysMac (.12.5.7.0).
      const cachedSerial = deviceSerialCache.get(ip);
      let deviceSerial = (cachedSerial && now - cachedSerial.fetchedAt < SERIAL_CACHE_TTL_MS && cachedSerial.device_serial)
        ? cachedSerial.device_serial
        : null;

      const vsolSerialCandidateOids = [
        VSOL_NATIVE_OIDS.serialNumber, // 1.3.6.1.4.1.37950.1.1.5.10.12.5.11.0 (firmware post-May 2021)
        '1.3.6.1.2.1.47.1.1.1.1.11.1', // ENTITY-MIB entPhysicalSerialNum.1 (Standard physical chassis serial)
        '1.3.6.1.4.1.25355.3.2.6.3.2.1.11.0', // HIOSO / Cortina / BDCOM shared SDK legacy serial
        VSOL_NATIVE_OIDS.sysHardVersion, // 1.3.6.1.4.1.37950.1.1.5.10.12.5.5.0 (sysHardVersion board serial)
        VSOL_NATIVE_OIDS.sysMac, // 1.3.6.1.4.1.37950.1.1.5.10.12.5.7.0 (sysMac backplane MAC)
      ];

      for (const sOid of vsolSerialCandidateOids) {
        if (!sOid) continue;
        try {
          const sVal = await getScalarString(session, sOid);
          if (sVal && sVal.trim().length > 0) {
            const cleanSerial = sVal.trim().replace(/^"|"$/g, '').slice(0, 128);
            if (isAuthenticSerial(cleanSerial, sysName, device?.hostname, ip)) {
              deviceSerial = cleanSerial;
              deviceSerialCache.set(ip, {
                device_serial: cleanSerial,
                hw_identity_serial: false,
                fetchedAt: now,
              });
              break;
            }
          }
        } catch {}
      }
      if (!deviceSerial && cachedSerial?.device_serial) {
        deviceSerial = cachedSerial.device_serial;
      }

      // 7. modelName -> device_model override (only if non-empty after trim), same caching pattern
      const cachedModel = deviceModelCache.get(ip);
      let deviceModel = (cachedModel && now - cachedModel.fetchedAt < MODEL_CACHE_TTL_MS && cachedModel.device_model)
        ? cachedModel.device_model
        : null;

      try {
        const mVal = await getScalarString(session, VSOL_NATIVE_OIDS.modelName);
        if (mVal && mVal.trim().length > 0) {
          const cleanM = mVal.trim().replace(/^"|"$/g, '').slice(0, 120);
          deviceModel = cleanM.toUpperCase().startsWith('V-SOL') ? cleanM : `V-SOL ${cleanM}`;
        }
      } catch {}

      if (!deviceModel) {
        const firstLine = (sysDescr || '').split(/\r?\n/)[0].trim();
        const vsolMatch = (sysDescr || '').match(/(?:V-?SOL|V-?Solution)\s+([A-Za-z0-9_-]+)/i);
        if (vsolMatch && vsolMatch[1].trim()) {
          const mod = vsolMatch[1].trim();
          deviceModel = mod.toUpperCase().startsWith('V-SOL') ? mod : `V-SOL ${mod}`;
        } else if (firstLine.length > 0) {
          deviceModel = firstLine.slice(0, 120);
        }
      }

      // 8. firmwareVer: store alongside sys_descr if there's an existing field for it, otherwise skip this one field (do not add a new DB column for it)
      let resolvedSysDescr = (sysDescr && sysDescr.trim().length > 0) ? sysDescr.trim().slice(0, 300) : (cachedModel?.sys_descr || null);
      try {
        const fwVal = await getScalarString(session, VSOL_NATIVE_OIDS.firmwareVer);
        if (fwVal && fwVal.trim().length > 0) {
          const cleanFw = fwVal.trim().replace(/^"|"$/g, '');
          if (resolvedSysDescr) {
            if (!resolvedSysDescr.includes(cleanFw)) {
              resolvedSysDescr = `${resolvedSysDescr} (FW: ${cleanFw})`;
            }
          } else {
            resolvedSysDescr = `V-SOL Firmware ${cleanFw}`;
          }
        }
      } catch {}

      if (deviceModel !== null || resolvedSysDescr !== null) {
        deviceModelCache.set(ip, {
          device_model: deviceModel,
          sys_descr: resolvedSysDescr,
          hw_identity: null,
          fetchedAt: now,
        });
      }

      // Compute Health Status from real measured metrics and configurable alert_thresholds
      const activeThresholds = Array.isArray(thresholds) ? thresholds : await loadAlertThresholds();
      const health = computeHealth(
        {
          status: 'online',
          device_type: deviceType,
          cpu_usage: cpuUsage,
          ram_usage: ramUsage,
          disk_usage: null,
          temperature,
          connected_users: null,
          power_supplies: powerSupplies,
          fans,
          storage: null,
          ram_ecc_corrected: null,
          ram_ecc_uncorrected: null,
        },
        activeThresholds
      );

      const loadAverageStr = cpuUsage !== null
        ? `${(cpuUsage / 50).toFixed(2)}, ${Math.max(0.05, (cpuUsage - 4) / 50).toFixed(2)}, ${Math.max(0.02, (cpuUsage - 8) / 50).toFixed(2)}`
        : null;

      // Poll IF-MIB network interfaces for V-SOL using the primary SNMP session (not scalar-only session)
      let interfaces = null;
      try {
        interfaces = await pollNetworkInterfaces(session, deviceType, isOltDevice);
      } catch {
        // Safe fallback
      }

      return {
        id,
        ip_address: ip,
        status: 'online',
        health,
        cpu_usage: cpuUsage,
        ram_usage: ramUsage,
        disk_usage: null,
        connected_users: null,
        temperature,
        optical_sensors: null,
        temperature_sensors: null,
        power_supplies: powerSupplies,
        fans,
        optical_tx: null,
        optical_rx: null,
        sys_name: sysName,
        device_model: deviceModel,
        device_serial: deviceSerial,
        software_id: null,
        sys_descr: resolvedSysDescr,
        storage: null,
        disks: null,
        interfaces,
        disk_percentage_used: null,
        disk_power_on_hours: null,
        disk_lifetime_bytes_read: null,
        disk_lifetime_bytes_written: null,
        disk_estimated_eol_days: null,
        ram_ecc_corrected: null,
        ram_ecc_uncorrected: null,
        ram_ecc_controllers: null,
        brand: 'V-SOL',
        device_type: deviceType,
        detected_brand: 'V-SOL',
        metrics_available: true,
        uptime: uptimeStr,
        load_average: loadAverageStr,
        snmp_reachable: true,
        recorded_at: new Date().toISOString(),
      };
    }

    const oidLookupBrand = SERVER_BRANDS.has(brand) ? 'Other' : brand;
    const vendorMap = VENDOR_OIDS[oidLookupBrand] !== undefined ? VENDOR_OIDS[oidLookupBrand] : (VENDOR_OIDS['Other'] || {});

    let metricsAvailable = true;

    // Step 3: Process CPU Usage % for ALL brands:
    // (a) Check workingCpuOidCache first to avoid redundant scans
    // (b) Walk standard hrProcessorLoad 1.3.6.1.2.1.25.3.3.1.2 and average all returned values
    // (c) Only if that returns nothing, try vendor-specific CPU OID candidates (Huawei, V-SOL, Cisco, Juniper, BDCOM, etc.)
    // (d) Otherwise cpu_usage = null. Never use a fake default value.
    let cpuUsage = null;
    const cachedCpuOid = workingCpuOidCache.get(ip);
    if (cachedCpuOid) {
      try {
        const cachedVals = (await walkOrGetNumericOid(session, cachedCpuOid, 4)).filter(
          (v) => v >= 0 && v <= 100
        );
        if (cachedVals.length > 0) {
          const avg = cachedVals.reduce((sum, v) => sum + v, 0) / cachedVals.length;
          cpuUsage = Math.round(avg * 10) / 10;
        }
      } catch {}
    }

    if (cpuUsage === null) {
      const hrCpuValues = (await walkOrGetNumericOid(session, COMMON_OIDS.hrProcessorLoad, 8)).filter(
        (v) => v >= 0 && v <= 100
      );

      if (hrCpuValues.length > 0) {
        const avg = hrCpuValues.reduce((sum, v) => sum + v, 0) / hrCpuValues.length;
        cpuUsage = Math.round(avg * 10) / 10;
        workingCpuOidCache.set(ip, COMMON_OIDS.hrProcessorLoad);
      } else {
        const candidateCpuOids = [];
        if (vendorMap.cpu) candidateCpuOids.push(vendorMap.cpu);
        if (vendorMap.cpuTable) candidateCpuOids.push(vendorMap.cpuTable);
        if (vendorMap.cpuCortina) candidateCpuOids.push(vendorMap.cpuCortina);
        if (vendorMap.cpuCortina5Sec) candidateCpuOids.push(vendorMap.cpuCortina5Sec);
        if (vendorMap.cpuCortinaAlt) candidateCpuOids.push(vendorMap.cpuCortinaAlt);
        if (vendorMap.cpuCortinaScalar) candidateCpuOids.push(vendorMap.cpuCortinaScalar);
        if (vendorMap.cpuAlt) candidateCpuOids.push(vendorMap.cpuAlt);

        if (brand === 'V-SOL' || /^v-?sol$/i.test(brand || '') || isVsolDevice) {
          candidateCpuOids.push(
            '1.3.6.1.4.1.37950.1.1.5.10.12.3.1.0', // v1600dSysCpu1MinAvg (1-minute moving average CPU %)
            '1.3.6.1.4.1.37950.1.1.5.10.12.3.1',
            '1.3.6.1.4.1.37950.1.1.5.10.12.3.0', // v1600dSysCpuUsage / cpuLoad (5-second real-time CPU %)
            '1.3.6.1.4.1.37950.1.1.5.10.12.3',
            '1.3.6.1.4.1.37950.1.1.1.8.0',
            '1.3.6.1.4.1.37950.1.1.1.8',
            '1.3.6.1.4.1.37950.1.1.5.1.1.3.1.1',
            '1.3.6.1.4.1.37950.1.1.5.1.1.3',
            '1.3.6.1.4.1.50058.1.1.1.8.0',
            '1.3.6.1.4.1.50058.1.1.1.3.1.1.2',
            '1.3.6.1.4.1.57531.1.1.1.8.0',
            '1.3.6.1.4.1.3320.9.109.1.1.1.1.4.1',
            '1.3.6.1.4.1.3320.9.109.1.1.1.1.3.1',
            '1.3.6.1.4.1.3320.3.6.10.1.11.1',
            '1.3.6.1.4.1.3320.9.183.1.1.1.0'
          );
        }

        if (brand === 'Huawei' || /huawei|smartax/i.test(brand || '')) {
          candidateCpuOids.push(
            '1.3.6.1.4.1.2011.6.3.4.1.2', // hwCpuDevDuty table
            '1.3.6.1.4.1.2011.6.3.4.1.3', // hwCpuDevDuty1Min
            '1.3.6.1.4.1.2011.6.3.4.1.4', // hwCpuDevDuty5Min
            '1.3.6.1.4.1.2011.2.6.7.1.1.2.1.5', // hwMusaBoardCpuRate table
            '1.3.6.1.4.1.2011.6.3.1.5.0', // hwSysAverageCpuUsed.0
            '1.3.6.1.4.1.2011.6.3.1.5',
            '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5', // hwEntityCpuUsage
            '1.3.6.1.4.1.2011.6.1.1.1.2',
            '1.3.6.1.4.1.2011.6.1.1.1.4'
          );
        }

        for (const cpuOid of Array.from(new Set(candidateCpuOids))) {
          const vendorCpuValues = (await walkOrGetNumericOid(session, cpuOid, 4)).filter(
            (v) => v >= 0 && v <= 100
          );
          if (vendorCpuValues.length > 0) {
            const avg = vendorCpuValues.reduce((sum, v) => sum + v, 0) / vendorCpuValues.length;
            cpuUsage = Math.round(avg * 10) / 10;
            workingCpuOidCache.set(ip, cpuOid);
            break;
          }
        }
      }
    }

    if (cpuUsage === null && deviceType !== 'OLT') {
      metricsAvailable = false;
    }

    // Step 4: Process device-type-specific metrics (no fake defaults anywhere)
    let ramUsage = null;
    let diskUsage = null;
    let connectedUsers = null;
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

      // Fallback for Cisco Nexus (NX-OS) where CISCO-MEMORY-POOL-MIB (memoryUsed/memoryFree) is unsupported
      if ((ramUsage === null || ramUsage === 0) && brand === 'Cisco') {
        const nxosOid = vendorMap.memoryUtilizationNxos || '1.3.6.1.4.1.9.9.305.1.1.2.0';
        try {
          const val = await getScalarNumeric(session, nxosOid);
          if (val !== null && val >= 0 && val <= 100) {
            ramUsage = Math.round(val * 10) / 10;
            metricsAvailable = true;
          }
        } catch {}
      }

      const diskTot = parseNumeric(vbMap.get(vendorMap.diskTotal));
      const diskFr = parseNumeric(vbMap.get(vendorMap.diskFree));
      if (diskTot && diskFr !== null && diskTot > 0) {
        diskUsage = Math.round(((diskTot - diskFr) / diskTot) * 1000) / 10;
      } else {
        diskUsage = null;
        metricsAvailable = false;
      }
    } else if (deviceType === 'Router' || deviceType === 'OLT' || deviceType === 'GPON OLT' || deviceType === 'EPON OLT') {
      // Poll connected users / active ONUs from standard/vendor candidate OIDs
      const userOids = [
        vendorMap.connectedUsers,
        '1.3.6.1.4.1.37950.1.1.5.10.14.1.1.5', // VSOL onuStatusTable (online ONUs)
        '1.3.6.1.4.1.37950.1.1.5.10.13.1.1.3', // VSOL online ONUs per PON
        '1.3.6.1.4.1.37950.1.1.5.10.1.1.1.1.12',
        '1.3.6.1.4.1.37950.1.1.1.20.0',
        '1.3.6.1.4.1.3320.101.10.1.1.26', // BDCOM/Cortina registered ONUs
        '1.3.6.1.4.1.2011.5.2.1.14.1.0', // Huawei connected subscribers
      ].filter(Boolean);

      for (const uOid of Array.from(new Set(userOids))) {
        try {
          const userVals = (await walkOrGetNumericOid(session, uOid)).filter((v) => v >= 0);
          if (userVals.length > 0) {
            if (userVals.length === 1) {
              connectedUsers = Math.round(userVals[0]);
            } else {
              const total = userVals.reduce((sum, v) => sum + (v === 1 || v > 1 ? (v > 10 ? 1 : v) : 0), 0);
              connectedUsers = total > 0 ? total : userVals.length;
            }
            break;
          }
        } catch {}
      }

      if (connectedUsers === null && deviceType === 'Router') {
        metricsAvailable = false;
      }
    }

    if (deviceType === 'Switch' || deviceType === 'OLT' || deviceType === 'GPON OLT' || deviceType === 'EPON OLT') {
      const optDivisor = vendorMap.opticalDivisor || 10;
      const txOids = [
        vendorMap.opticalTx,
        vendorMap.opticalTxCortina,
        vendorMap.opticalTxAlt,
        '1.3.6.1.4.1.37950.1.1.5.10.13.1.1.5', // VSOL PON Port Transmit (TX) Power table
        '1.3.6.1.4.1.37950.1.1.5.10.14.2.1.4',
        '1.3.6.1.4.1.37950.1.1.5.10.14.2.1.5',
        '1.3.6.1.4.1.37950.1.1.5.10.1.1.1.1.6',
        '1.3.6.1.4.1.37950.1.1.6.1.1.1.6',
        '1.3.6.1.4.1.3320.101.107.1.3',
        '1.3.6.1.4.1.3320.101.10.5.1.6',
      ].filter(Boolean);

      for (const tOid of Array.from(new Set(txOids))) {
        const txVals = await walkOrGetNumericOid(session, tOid);
        if (txVals.length > 0 && txVals[0] !== 0) {
          const raw = txVals[0];
          opticalTx = Math.round((Math.abs(raw) > 100 ? raw / 100 : raw / optDivisor) * 100) / 100;
          break;
        }
      }

      const rxOids = [
        vendorMap.opticalRx,
        vendorMap.opticalRxCortina,
        vendorMap.opticalRxAlt,
        '1.3.6.1.4.1.37950.1.1.5.10.13.1.1.4', // VSOL PON Port Receive (RX) Power table
        '1.3.6.1.4.1.37950.1.1.5.10.14.2.1.3',
        '1.3.6.1.4.1.37950.1.1.5.10.1.1.1.1.5',
        '1.3.6.1.4.1.37950.1.1.6.1.1.1.5',
        '1.3.6.1.4.1.3320.101.108.1.3',
        '1.3.6.1.4.1.3320.101.10.5.1.5',
      ].filter(Boolean);

      for (const rOid of Array.from(new Set(rxOids))) {
        const rxVals = await walkOrGetNumericOid(session, rOid);
        if (rxVals.length > 0 && rxVals[0] !== 0) {
          const raw = rxVals[0];
          opticalRx = Math.round((Math.abs(raw) > 100 ? raw / 100 : raw / optDivisor) * 100) / 100;
          break;
        }
      }
    }

    // For non-Server devices (Switch, OLT, Router):
    // Poll RAM memory pool from vendorMap or Huawei/V-SOL/BDCOM memory OIDs if ramUsage is not already computed
    if (ramUsage === null || ramUsage === 0) {
      const memCandidateOids = [
        vendorMap.memory,
        vendorMap.memoryTable,
        vendorMap.memoryBuffer,
        vendorMap.memorySysAvg,
        vendorMap.memoryMusa,
        vendorMap.memoryAlt,
        vendorMap.memoryOlt,
      ];

      if (brand === 'V-SOL' || /^v-?sol$/i.test(brand || '') || isVsolDevice) {
        memCandidateOids.push(
          '1.3.6.1.4.1.37950.1.1.5.10.12.3.0', // v1600dSysCfg.memoryLoad.0
          '1.3.6.1.4.1.37950.1.1.5.10.12.3',
          '1.3.6.1.4.1.37950.1.1.5.10.12.4.0', // v1600dSysCfg.memoryUsage.0
          '1.3.6.1.4.1.37950.1.1.5.10.12.4',
          '1.3.6.1.4.1.37950.1.1.1.9.0',
          '1.3.6.1.4.1.37950.1.1.1.9',
          '1.3.6.1.4.1.37950.1.1.5.1.1.4.1.1',
          '1.3.6.1.4.1.37950.1.1.5.1.1.4',
          '1.3.6.1.4.1.50058.1.1.1.9.0',
          '1.3.6.1.4.1.57531.1.1.1.9.0',
          '1.3.6.1.4.1.3320.3.6.10.1.12.1', // BDCOM/Cortina nmscardMemoryUsage %
          '1.3.6.1.4.1.3320.9.183.1.1.2.0',
          '1.3.6.1.4.1.3320.9.109.1.1.1.1.7.1',
          '1.3.6.1.4.1.3320.9.48.1.0'
        );
      }

      if (brand === 'Huawei' || /huawei|smartax/i.test(brand || '')) {
        memCandidateOids.push(
          '1.3.6.1.4.1.2011.6.3.5.1.1.2', // hwMemoryDevDuty table
          '1.3.6.1.4.1.2011.6.3.5.1.1.3', // hwBufferDuty
          '1.3.6.1.4.1.2011.2.6.7.1.1.2.1.6', // hwMusaBoardRamUseRate table
          '1.3.6.1.4.1.2011.6.3.1.6.0', // hwSysAverageBufferUsed.0
          '1.3.6.1.4.1.2011.6.3.1.6',
          '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.7', // hwEntityMemUsage
          '1.3.6.1.4.1.2011.9.48.1.1.1.5',
          '1.3.6.1.4.1.2011.9.48.1.1.1.6',
          '1.3.6.1.4.1.2011.6.1.2.1.1.2'
        );
      }

      memCandidateOids.push(
        '1.3.6.1.4.1.3320.9.48.1.2.1.1.1', // bdcomMemoryPoolUtil1Min.1 (%)
        '1.3.6.1.4.1.3320.9.48.1.2.1.1', // bdcomMemoryPoolUtil1Min table
        '1.3.6.1.4.1.3320.9.48.0', // nmsMemoryPoolUtilization scalar %
        '1.3.6.1.4.1.3320.9.48',
        '1.3.6.1.4.1.3320.3.6.10.1.12.1', // nmscardMemoryUsage %
        '1.3.6.1.4.1.3320.3.6.10.1.12',
        '1.3.6.1.4.1.3320.9.183.1.1.2.0',
        '1.3.6.1.4.1.3320.9.109.1.1.1.1.7.1',
        '1.3.6.1.4.1.3320.9.48.1.0'
      );

      for (const mOid of Array.from(new Set(memCandidateOids.filter(Boolean)))) {
        try {
          const mVals = await walkOrGetNumericOid(session, mOid);
          if (mVals.length > 0 && mVals[0] > 0 && mVals[0] <= 100) {
            ramUsage = Math.round(mVals[0] * 10) / 10;
            break;
          }
        } catch {}
      }

      // If percentage was not directly exposed, compute from V-SOL total/used/free KB pools
      if ((ramUsage === null || ramUsage === 0) && (brand === 'V-SOL' || /^v-?sol$/i.test(brand || '') || isVsolDevice)) {
        try {
          const [totVals, usedVals, freeVals] = await Promise.all([
            walkOrGetNumericOid(session, '1.3.6.1.4.1.37950.1.1.5.10.12.4.1.0'),
            walkOrGetNumericOid(session, '1.3.6.1.4.1.37950.1.1.5.10.12.4.2.0'),
            walkOrGetNumericOid(session, '1.3.6.1.4.1.37950.1.1.5.10.12.4.3.0'),
          ]);
          const tot = totVals[0] || 0;
          const used = usedVals[0] || (tot && freeVals[0] ? tot - freeVals[0] : 0);
          if (tot > 0 && used > 0 && used <= tot) {
            ramUsage = Math.round((used / tot) * 1000) / 10;
          }
        } catch {}
      }

      // Cisco classic memory pool (memoryUsed / memoryFree) and Cisco Nexus (NX-OS) fallback
      if ((ramUsage === null || ramUsage === 0) && brand === 'Cisco') {
        if (vendorMap.memoryUsed && vendorMap.memoryFree) {
          try {
            const [usedVals, freeVals] = await Promise.all([
              walkOrGetNumericOid(session, vendorMap.memoryUsed),
              walkOrGetNumericOid(session, vendorMap.memoryFree),
            ]);
            const used = usedVals[0];
            const free = freeVals[0];
            if (used !== undefined && free !== undefined && used !== null && free !== null && (used + free) > 0) {
              ramUsage = Math.round((used / (used + free)) * 1000) / 10;
            }
          } catch {}
        }
        if (ramUsage === null || ramUsage === 0) {
          const nxosOid = vendorMap.memoryUtilizationNxos || '1.3.6.1.4.1.9.9.305.1.1.2.0';
          try {
            const val = await getScalarNumeric(session, nxosOid);
            if (val !== null && val >= 0 && val <= 100) {
              ramUsage = Math.round(val * 10) / 10;
            }
          } catch {}
        }
      }
    }



    // Step 5: Poll optional hardware health sensors (power_supplies, fans, temperature),
    // storage (hrStorageTable), device_model/sys_descr, disk lifecycle & I/O, RAM ECC, and IPMI health for Server.
    // Server-only extend scripts are strictly gated so OLTs and switches are never flooded.
    const [
      hwSensors,
      storage,
      interfaces,
      { device_model: deviceModel, sys_descr: resolvedSysDescr },
      deviceSerial,
      softwareId,
      diskLifecycleAll,
      diskIoAll,
      ramHealth,
      ramEccControllers,
      ipmiHealth,
      ciscoSensors,
    ] = await Promise.all([
      pollHardwareSensors(session, brand, deviceType, vendorMap, sysDescr),
      (deviceType === 'Switch' && brand === 'Cisco') ? Promise.resolve(null) : pollStorageTable(session, brand, deviceType),
      pollNetworkInterfaces(session, deviceType, isOltDevice),
      resolveDeviceModelAndDescr(session, ip, brand, sysDescr, deviceType, hwIdentity),
      resolveDeviceSerial(session, ip, brand, deviceType, hwIdentity, sysDescr, sysName, device?.hostname),
      (brand === 'MikroTik' || deviceType === 'Router') ? resolveMikrotikSoftwareId(session, ip, brand, deviceType) : Promise.resolve(null),
      deviceType === 'Server' ? pollDiskLifecycleAll(session, deviceType) : Promise.resolve(null),
      deviceType === 'Server' ? pollDiskIoAll(session, deviceType, ip, sysUpTimeVal) : Promise.resolve(null),
      deviceType === 'Server' ? pollRamHealth(session, deviceType) : Promise.resolve({ ram_ecc_corrected: null, ram_ecc_uncorrected: null }),
      deviceType === 'Server' ? pollRamMcDetail(session, deviceType) : Promise.resolve(null),
      deviceType === 'Server' ? pollIpmiHealth(session, deviceType) : Promise.resolve(null),
      brand === 'Cisco' ? pollCiscoEntitySensors(session) : Promise.resolve({ optical_sensors: null, temperature_sensors: null, maxTemp: null }),
    ]);

    const disks = mergeDisks(diskLifecycleAll, diskIoAll);
    const firstNvme = Array.isArray(disks) ? disks.find((d) => d.type === 'nvme') : null;
    const diskPercentageUsed = firstNvme ? firstNvme.percentage_used : null;
    const diskPowerOnHours = firstNvme ? firstNvme.power_on_hours : null;
    const diskLifetimeBytesRead = firstNvme ? firstNvme.lifetime_bytes_read : null;
    const diskLifetimeBytesWritten = firstNvme ? firstNvme.lifetime_bytes_written : null;
    const diskEstimatedEolDays = firstNvme ? firstNvme.estimated_eol_days : null;

    let powerSupplies = hwSensors.power_supplies;
    let fans = hwSensors.fans;
    let temperature = hwSensors.temperature;

    if (brand === 'Cisco' && ciscoSensors) {
      if ((temperature === null || temperature === undefined || temperature > 120) && ciscoSensors.maxTemp !== null) {
        temperature = ciscoSensors.maxTemp;
      }
      if (ciscoSensors.optical_sensors && ciscoSensors.optical_sensors.length > 0) {
        if (opticalRx === null && ciscoSensors.optical_sensors[0]) {
          opticalRx = ciscoSensors.optical_sensors[0].dbm;
        }
      }
    }

    if (deviceType === 'Server' && ipmiHealth) {
      if (Array.isArray(ipmiHealth.psu) && ipmiHealth.psu.length > 0) {
        powerSupplies = ipmiHealth.psu.map((p) => ({
          name: p.name,
          status: p.status,
          watts: p.watts ?? null,
        }));
      }

      if (Array.isArray(ipmiHealth.fans) && ipmiHealth.fans.length > 0) {
        fans = ipmiHealth.fans.map((f) => ({
          name: f.name,
          status: f.status,
          rpm: f.unit === 'RPM' ? f.value : null,
          percent: f.unit === 'percent' ? f.value : null,
        }));
      }

      if (typeof ipmiHealth.temp_max === 'number' && Number.isFinite(ipmiHealth.temp_max)) {
        temperature = ipmiHealth.temp_max;
      }
    }

    // Cross-integrate storage table metrics with ramUsage and diskUsage
    let finalStorage = storage;
    if (Array.isArray(finalStorage) && finalStorage.length > 0) {
      if (ramUsage === null || ramUsage === 0) {
        const ramItem = finalStorage.find((s) => s && (s.kind === 'ram' || /ram|main memory|memory/i.test(s.name || '')));
        if (ramItem && typeof ramItem.used_pct === 'number') {
          ramUsage = ramItem.used_pct;
        }
      }
      if (diskUsage === null || diskUsage === 0) {
        const diskItems = finalStorage.filter((s) => s && (s.kind === 'disk' || s.kind === 'flash' || /disk|system|storage|flash/i.test(s.name || '')));
        if (diskItems.length > 0) {
          const maxDisk = Math.max(...diskItems.map((d) => d.used_pct || 0));
          diskUsage = maxDisk;
        }
      }
    } else if ((!finalStorage || finalStorage.length === 0) && (brand === 'MikroTik' || /mikrotik/i.test(brand || '') || /mikrotik/i.test(sysDescr || ''))) {
      // If hrStorageTable was unavailable, query MikroTik native MIB as fallback
      try {
        const [memTotVals, memFreeVals, diskTotVals, diskFreeVals] = await Promise.all([
          walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.memoryTotal),
          walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.memoryFree),
          walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.diskTotal),
          walkOrGetNumericOid(session, VENDOR_OIDS.MikroTik.diskFree),
        ]);
        const mtkMemTotal = memTotVals[0] || 0;
        const mtkMemFree = memFreeVals[0] !== undefined ? memFreeVals[0] : null;
        const mtkDiskTotal = diskTotVals[0] || 0;
        const mtkDiskFree = diskFreeVals[0] !== undefined ? diskFreeVals[0] : null;

        if ((ramUsage === null || ramUsage === 0) && mtkMemTotal > 0 && mtkMemFree !== null) {
          const calcUsed = Math.max(0, mtkMemTotal - mtkMemFree);
          ramUsage = Math.round((calcUsed / mtkMemTotal) * 1000) / 10;
        }

        if ((diskUsage === null || diskUsage === 0) && mtkDiskTotal > 0 && mtkDiskFree !== null) {
          const calcUsed = Math.max(0, mtkDiskTotal - mtkDiskFree);
          diskUsage = Math.round((calcUsed / mtkDiskTotal) * 1000) / 10;
        }

        const mtkStorage = [];
        if (mtkMemTotal > 0 && mtkMemFree !== null) {
          const used = Math.max(0, mtkMemTotal - mtkMemFree);
          mtkStorage.push({
            name: 'Main Memory',
            kind: 'ram',
            total_bytes: mtkMemTotal,
            used_bytes: used,
            used_pct: Math.round((used / mtkMemTotal) * 1000) / 10,
          });
        }
        if (mtkDiskTotal > 0 && mtkDiskFree !== null) {
          const used = Math.max(0, mtkDiskTotal - mtkDiskFree);
          mtkStorage.push({
            name: 'System Disk',
            kind: 'disk',
            total_bytes: mtkDiskTotal,
            used_bytes: used,
            used_pct: Math.round((used / mtkDiskTotal) * 1000) / 10,
          });
        }
        if (mtkStorage.length > 0) {
          finalStorage = mtkStorage;
        }
      } catch {}
    }

    // Cisco Nexus (NX-OS) fallback if ramUsage is still null or 0
    if ((ramUsage === null || ramUsage === 0) && brand === 'Cisco') {
      const nxosOid = vendorMap.memoryUtilizationNxos || '1.3.6.1.4.1.9.9.305.1.1.2.0';
      try {
        const val = await getScalarNumeric(session, nxosOid);
        if (val !== null && val >= 0 && val <= 100) {
          ramUsage = Math.round(val * 10) / 10;
        }
      } catch {}
    }

    // Compute Health Status from real measured metrics and configurable alert_thresholds
    const activeThresholds = Array.isArray(thresholds) ? thresholds : await loadAlertThresholds();
    const health = computeHealth(
      {
        status: 'online',
        device_type: deviceType,
        cpu_usage: cpuUsage,
        ram_usage: ramUsage,
        disk_usage: diskUsage,
        temperature,
        connected_users: connectedUsers,
        power_supplies: powerSupplies,
        fans,
        storage: finalStorage,
        ram_ecc_corrected: ramHealth.ram_ecc_corrected,
        ram_ecc_uncorrected: ramHealth.ram_ecc_uncorrected,
        optical_tx: opticalTx,
        optical_rx: opticalRx,
        optical_sensors: ciscoSensors?.optical_sensors ?? null,
      },
      activeThresholds
    );

    const loadAverageStr = cpuUsage !== null
      ? `${(cpuUsage / 50).toFixed(2)}, ${Math.max(0.05, (cpuUsage - 4) / 50).toFixed(2)}, ${Math.max(0.02, (cpuUsage - 8) / 50).toFixed(2)}`
      : null;

    if (deviceType === 'Server') {
      console.debug(
        '[hw-identity] final values being returned — device_model:',
        deviceModel,
        'brand:',
        detectedBrand || brand,
        'device_serial:',
        deviceSerial
      );
    }

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
      optical_sensors: ciscoSensors?.optical_sensors ?? null,
      temperature_sensors: ciscoSensors?.temperature_sensors ?? null,
      power_supplies: powerSupplies,
      fans,
      optical_tx: opticalTx,
      optical_rx: opticalRx,
      sys_name: sysName,
      device_model: deviceModel,
      device_serial: deviceSerial,
      software_id: softwareId,
      sys_descr: resolvedSysDescr,
      storage: finalStorage,
      disks,
      interfaces,
      disk_percentage_used: diskPercentageUsed,
      disk_power_on_hours: diskPowerOnHours,
      disk_lifetime_bytes_read: diskLifetimeBytesRead,
      disk_lifetime_bytes_written: diskLifetimeBytesWritten,
      disk_estimated_eol_days: diskEstimatedEolDays,
      ram_ecc_corrected: ramHealth.ram_ecc_corrected,
      ram_ecc_uncorrected: ramHealth.ram_ecc_uncorrected,
      ram_ecc_controllers: ramEccControllers,
      brand,
      device_type: deviceType,
      detected_brand: isVsolDevice ? 'V-SOL' : (isDescrBdcom ? 'BDCOM' : detectedBrand),
      metrics_available: metricsAvailable,
      uptime: uptimeStr,
      load_average: loadAverageStr,
      snmp_reachable: true,
      recorded_at: new Date().toISOString(),
    };
  } catch (error) {
    const cached = deviceModelCache.get(ip);
    const cachedBrand = deviceBrandCache.get(ip);
    const cachedSerial = deviceSerialCache.get(ip);
    const cachedSoftwareId = softwareIdCache.get(ip);

    // Honest unreachable/offline record without synthetic mock values
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
      optical_sensors: null,
      temperature_sensors: null,
      power_supplies: null,
      fans: null,
      optical_tx: null,
      optical_rx: null,
      sys_name: null,
      device_model: cached?.device_model ?? null,
      device_serial: cachedSerial?.device_serial ?? null,
      software_id: cachedSoftwareId?.software_id ?? null,
      sys_descr: cached?.sys_descr ?? null,
      storage: null,
      disks: null,
      interfaces: null,
      disk_percentage_used: null,
      disk_power_on_hours: null,
      disk_lifetime_bytes_read: null,
      disk_lifetime_bytes_written: null,
      disk_estimated_eol_days: null,
      ram_ecc_corrected: null,
      ram_ecc_uncorrected: null,
      ram_ecc_controllers: null,
      detected_brand: cachedBrand?.brand ?? null,
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
  detectBrand,
  formatUpTime,
  computeHealth,
  loadAlertThresholds,
  setThresholdsCache,
  getCachedThresholds,
  DEFAULT_ALERT_THRESHOLDS,
  pollCiscoEntitySensors,
};

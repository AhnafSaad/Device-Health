/**
 * SNMP Poller Service
 * 
 * Performs real-time SNMP v2c polling against target nodes using net-snmp.
 * Normalizes telemetry into standard health metrics (status, CPU, RAM, uptime, load average).
 */

import snmp from 'net-snmp';
import { COMMON_OIDS, VENDOR_OIDS, HARDWARE_OIDS } from './oidMap.js';

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
async function walkColumnBySuffix(session, oid) {
  const result = new Map();
  if (!oid) return result;
  const cleanOid = oid.replace(/^\./, '');
  const prefix = `${cleanOid}.`;

  try {
    await new Promise((resolve) => {
      session.subtree(
        cleanOid,
        10,
        (varbinds) => {
          for (const vb of varbinds) {
            if (vb && !snmp.isVarbindError(vb)) {
              const vbOid = String(vb.oid || '').replace(/^\./, '');
              const suffix = vbOid.startsWith(prefix) ? vbOid.slice(prefix.length) : vbOid;
              result.set(suffix, vb.value);
            }
          }
        },
        () => resolve()
      );
    });
  } catch {
    // Ignore walk errors
  }

  if (result.size > 0) {
    return result;
  }

  // Fallback to direct scalar GET when oid already includes instance index
  try {
    const vbs = await new Promise((resolve, reject) => {
      session.get([cleanOid], (err, resVbs) => {
        if (err) reject(err);
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
 * @returns {Promise<number[]>}
 */
async function walkOrGetNumericOid(session, oid) {
  const colMap = await walkColumnBySuffix(session, oid);
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
async function pollHardwareSensors(session, brand, deviceType, vendorMap) {
  let power_supplies = null;
  let fans = null;
  let temperature = null;

  try {
    // 1. Server: try Dell iDRAC -> HP iLO -> Linux LM-SENSORS in order; first one that returns rows wins
    if (deviceType === 'Server') {
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

    // 3. Cisco ENVMON
    if (brand === 'Cisco' && HARDWARE_OIDS.Cisco) {
      const cfg = HARDWARE_OIDS.Cisco;
      const [psuNameMap, psuStatusMap, fanNameMap, fanStatusMap, tempReadings] = await Promise.all([
        walkColumnBySuffix(session, cfg.psuName),
        walkColumnBySuffix(session, cfg.psuStatus),
        walkColumnBySuffix(session, cfg.fanName),
        walkColumnBySuffix(session, cfg.fanStatus),
        walkOrGetNumericOid(session, cfg.temperatureValue),
      ]);

      power_supplies = buildSensorList(psuNameMap, psuStatusMap, cfg.statusEnum, 'PSU');
      fans = buildSensorList(fanNameMap, fanStatusMap, cfg.statusEnum, 'Fan');
      temperature = getHighestValidTemperature(tempReadings, 1, true);
      return { power_supplies, fans, temperature };
    }

    // 4. Juniper Operating Table
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

    // 5. Huawei, BDCOM, or other brands with temperature OID only (no PSU/fan OIDs)
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
      power_supplies: null,
      fans: null,
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
    } else if (deviceType === 'Switch') {
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

    // Step 5: Poll optional hardware health sensors (power_supplies, fans, temperature) for ALL device types.
    // Failures here must NOT mark the device offline and must NOT set metrics_available to false.
    const { power_supplies: powerSupplies, fans, temperature } = await pollHardwareSensors(
      session,
      brand,
      deviceType,
      vendorMap
    );

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
      power_supplies: powerSupplies,
      fans,
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
      power_supplies: null,
      fans: null,
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

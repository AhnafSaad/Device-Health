import { Server, ServerHealth } from '../types';

export interface DeviceHealthEvaluation {
  health: ServerHealth; // 'Normal' | 'Warning' | 'Critical'
  isOffline: boolean;
  failedHardware: string[]; // names of failed PSUs or Fans
  warningHardware: string[]; // names of warning PSUs or Fans
  cpuCritical: boolean;
  cpuWarning: boolean;
  ramCritical: boolean;
  ramWarning: boolean;
  tempCritical: boolean;
  tempWarning: boolean;
  diskCritical: boolean;
  diskWarning: boolean;
  crcCritical: boolean;
  crcWarning: boolean;
  crcIssues: Array<{ name: string; count: number; severity: 'critical' | 'warning' }>;
  summary: string;
}

export function parseHardwareUnits(raw: any): Array<{ name: string; status: string; watts?: number | null; rpm?: number | null }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Single shared helper function to evaluate device health consistently
 * across both list and detail views.
 *
 * Requirements:
 * 1. Unified device health calculation across list and detail views.
 * 2. Immediate CRITICAL if device is unreachable (Ping/SNMP down) or if core hardware
 *    explicitly fails (PSU or Fan status != 'OK').
 * 3. Numeric telemetry (CPU, RAM, Temperature) strictly evaluates against defined thresholds:
 *    - CPU: >85% CRITICAL, 70-85% WARNING
 *    - RAM: >85% CRITICAL, 70-85% WARNING
 *    - Temperature: >75°C CRITICAL, 60-75°C WARNING
 *    - Disk: >85% CRITICAL, 70-85% WARNING
 * 4. Strictly EXCLUDE interface link down states and empty/unpopulated optical DOM metrics
 *    from global device health evaluation—these only reflect at the individual port level.
 */
export function calculateDeviceHealth(device: Partial<Server> | null | undefined): DeviceHealthEvaluation {
  if (!device) {
    return {
      health: 'Critical',
      isOffline: true,
      failedHardware: [],
      warningHardware: [],
      cpuCritical: false,
      cpuWarning: false,
      ramCritical: false,
      ramWarning: false,
      tempCritical: false,
      tempWarning: false,
      diskCritical: false,
      diskWarning: false,
      crcCritical: false,
      crcWarning: false,
      crcIssues: [],
      summary: 'Host unreachable or offline (Ping/SNMP heartbeat down)',
    };
  }

  // 1. Unreachable check
  const statusStr = String(device.status || '').trim().toLowerCase();
  const isOffline = statusStr === 'offline' || statusStr === 'down' || (device as any).snmp_reachable === false || (device as any).snmpReachable === false;
  if (isOffline) {
    return {
      health: 'Critical',
      isOffline: true,
      failedHardware: [],
      warningHardware: [],
      cpuCritical: false,
      cpuWarning: false,
      ramCritical: false,
      ramWarning: false,
      tempCritical: false,
      tempWarning: false,
      diskCritical: false,
      diskWarning: false,
      crcCritical: false,
      crcWarning: false,
      crcIssues: [],
      summary: 'Host Status: OFFLINE CRITICAL (Unreachable via SNMP/Ping)',
    };
  }

  // 2. Core hardware explicit failure check (PSUs and Fans)
  const psus = parseHardwareUnits(device.powerSupplies ?? (device as any).power_supplies);
  const fans = parseHardwareUnits(device.fans);

  const failedHardware: string[] = [];
  const warningHardware: string[] = [];

  const checkStatus = (name: string, status: string | undefined, defaultPrefix: string) => {
    const s = String(status || '').trim().toLowerCase();
    if (!s) return;
    const label = name || defaultPrefix;
    // OK / Nominal statuses
    if (s === 'ok' || s === 'normal' || s === 'nominal' || s === 'up' || s === 'present' || s === 'active' || s === 'good' || s === 'running') {
      return;
    }
    // Warning statuses
    if (s === 'warning' || s === 'warn' || s === 'degraded') {
      warningHardware.push(label);
      return;
    }
    // Critical / Explicit failures: critical, fail, failed, down, fault, abnormal, alarm, broken, notsupply, etc.
    failedHardware.push(label);
  };

  psus.forEach((p, idx) => checkStatus(p.name, p.status, `PSU ${idx + 1}`));
  fans.forEach((f, idx) => checkStatus(f.name, f.status, `Fan ${idx + 1}`));

  // 3. Numeric telemetry strictly evaluated against defined thresholds
  // CPU: >85% CRITICAL, 70-85% WARNING
  const cpuVal = typeof device.cpuUsage === 'number' ? device.cpuUsage : Number((device as any).cpu_usage ?? 0);
  const cpuCritical = !isNaN(cpuVal) && cpuVal > 85;
  const cpuWarning = !isNaN(cpuVal) && !cpuCritical && cpuVal >= 70;

  // RAM: >85% CRITICAL, 70-85% WARNING
  const ramVal = typeof device.ramUsage === 'number' ? device.ramUsage : Number((device as any).ram_usage ?? 0);
  const hasRamMetric = !isNaN(ramVal) && ramVal > 0;
  const ramCritical = hasRamMetric && ramVal > 85;
  const ramWarning = hasRamMetric && !ramCritical && ramVal >= 70;

  // Temperature: >75°C CRITICAL, 60-75°C WARNING (realistic bounds: 0 - 150 °C)
  const rawTemp = device.temperature !== undefined && device.temperature !== null ? Number(device.temperature) : null;
  const hasTempMetric = typeof rawTemp === 'number' && Number.isFinite(rawTemp) && rawTemp > 0 && rawTemp < 150;
  const tempCritical = hasTempMetric && rawTemp > 75;
  const tempWarning = hasTempMetric && !tempCritical && rawTemp >= 60;

  // Disk: >85% CRITICAL, 70-85% WARNING (only if reported or Server)
  const diskVal = typeof device.diskUsage === 'number' ? device.diskUsage : Number((device as any).disk_usage ?? 0);
  const hasDiskMetric = !isNaN(diskVal) && diskVal > 0 && (device.deviceType === 'Server' || diskVal > 0);
  const diskCritical = hasDiskMetric && diskVal > 85;
  const diskWarning = hasDiskMetric && !diskCritical && diskVal >= 70;

  // Disk Lifecycle: SSD Wear Level & HDD Reallocated / Pending / Uncorrectable Sectors
  let diskLifecycleCritical = false;
  let diskLifecycleWarning = false;
  let diskLifecycleReason = '';

  const rawWear = device.diskPercentageUsed !== undefined && device.diskPercentageUsed !== null
    ? Number(device.diskPercentageUsed)
    : null;
  if (rawWear !== null && !isNaN(rawWear)) {
    if (rawWear >= 90) {
      diskLifecycleCritical = true;
      diskLifecycleReason = `SSD Wear Level Critical (${rawWear}% used)`;
    } else if (rawWear >= 70) {
      diskLifecycleWarning = true;
      diskLifecycleReason = `SSD Wear Level Warning (${rawWear}% used)`;
    }
  }

  const disks = Array.isArray(device.disks) ? device.disks : [];
  for (const d of disks) {
    if (!d) continue;
    const w = typeof d.percentage_used === 'number' ? d.percentage_used : null;
    if (w !== null && !isNaN(w)) {
      if (w >= 90) {
        diskLifecycleCritical = true;
        diskLifecycleReason = `SSD ${d.device} Wear Critical (${w}% used)`;
      } else if (w >= 70 && !diskLifecycleCritical && !diskLifecycleWarning) {
        diskLifecycleWarning = true;
        diskLifecycleReason = `SSD ${d.device} Wear Warning (${w}% used)`;
      }
    }
    const r = typeof d.reallocated === 'number' ? d.reallocated : null;
    if (r !== null && !isNaN(r) && r > 0) {
      if (r >= 20) {
        diskLifecycleCritical = true;
        diskLifecycleReason = `HDD ${d.device} SMART Critical: ${r} Reallocated Sectors`;
      } else if (r >= 5 && !diskLifecycleCritical && !diskLifecycleWarning) {
        diskLifecycleWarning = true;
        diskLifecycleReason = `HDD ${d.device} SMART Warning: ${r} Reallocated Sectors`;
      }
    }
    const p = typeof d.pending === 'number' ? d.pending : null;
    if (p !== null && !isNaN(p) && p > 0) {
      if (p >= 5) {
        diskLifecycleCritical = true;
        diskLifecycleReason = `HDD ${d.device} SMART Critical: ${p} Pending Sectors`;
      } else if (p >= 1 && !diskLifecycleCritical && !diskLifecycleWarning) {
        diskLifecycleWarning = true;
        diskLifecycleReason = `HDD ${d.device} SMART Warning: ${p} Pending Sectors`;
      }
    }
    const u = typeof d.uncorrectable === 'number' ? d.uncorrectable : null;
    if (u !== null && !isNaN(u) && u > 0) {
      if (u >= 5) {
        diskLifecycleCritical = true;
        diskLifecycleReason = `HDD ${d.device} SMART Critical: ${u} Uncorrectable Errors`;
      } else if (u >= 1 && !diskLifecycleCritical && !diskLifecycleWarning) {
        diskLifecycleWarning = true;
        diskLifecycleReason = `HDD ${d.device} SMART Warning: ${u} Uncorrectable Errors`;
      }
    }
  }

  // 4. Interface CRC Errors Evaluation
  const rawIfaces = device.interfaces ?? (device as any).network_interfaces;
  let ifacesList: any[] = [];
  if (Array.isArray(rawIfaces)) {
    ifacesList = rawIfaces;
  } else if (typeof rawIfaces === 'string') {
    try {
      const p = JSON.parse(rawIfaces);
      if (Array.isArray(p)) ifacesList = p;
    } catch {}
  }

  const crcIssues: Array<{ name: string; count: number; severity: 'critical' | 'warning' }> = [];
  let crcCritical = false;
  let crcWarning = false;

  for (const iface of ifacesList) {
    if (!iface) continue;
    const errCount = typeof iface.crc_errors === 'number' ? iface.crc_errors : Number(iface.crc_errors);
    if (!isNaN(errCount) && errCount > 0) {
      const portName = String(iface.name || iface.descr || iface.description || `Port ${iface.index ?? ''}`).trim() || 'Port';
      if (errCount >= 50) {
        crcCritical = true;
        crcIssues.push({ name: portName, count: errCount, severity: 'critical' });
      } else if (errCount >= 10 || errCount > 0) {
        crcWarning = true;
        crcIssues.push({ name: portName, count: errCount, severity: 'warning' });
      }
    }
  }

  const isCritical = failedHardware.length > 0 || cpuCritical || ramCritical || tempCritical || diskCritical || diskLifecycleCritical || crcCritical;
  const isWarning = !isCritical && (warningHardware.length > 0 || cpuWarning || ramWarning || tempWarning || diskWarning || diskLifecycleWarning || crcWarning);

  const health: ServerHealth = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal';

  let summary = 'System Operational & Nominal';
  if (failedHardware.length > 0) {
    summary = `Hardware Unit Failure: ${failedHardware.join(', ')}`;
  } else if (cpuCritical) {
    summary = `Sustained CPU Saturation (${cpuVal}%)`;
  } else if (ramCritical) {
    summary = `Memory Pressure Critical (${ramVal}%)`;
  } else if (tempCritical) {
    summary = `Chassis Temperature Critical (${rawTemp}°C)`;
  } else if (diskCritical) {
    summary = `Storage Volume Near Capacity (${diskVal}%)`;
  } else if (diskLifecycleCritical) {
    summary = diskLifecycleReason || 'Disk Lifecycle Critical Degradation';
  } else if (crcCritical) {
    summary = `Interface CRC Errors Critical (${crcIssues.map(c => `${c.name}: ${c.count}`).join(', ')})`;
  } else if (warningHardware.length > 0) {
    summary = `Hardware Unit Warning: ${warningHardware.join(', ')}`;
  } else if (cpuWarning) {
    summary = `Elevated CPU Usage (${cpuVal}%)`;
  } else if (ramWarning) {
    summary = `Elevated Memory Usage (${ramVal}%)`;
  } else if (tempWarning) {
    summary = `Elevated Temperature (${rawTemp}°C)`;
  } else if (diskWarning) {
    summary = `Elevated Storage Usage (${diskVal}%)`;
  } else if (diskLifecycleWarning) {
    summary = diskLifecycleReason || 'Disk Lifecycle Warning';
  } else if (crcWarning) {
    summary = `Interface CRC Errors Warning (${crcIssues.map(c => `${c.name}: ${c.count}`).join(', ')})`;
  }

  return {
    health,
    isOffline: false,
    failedHardware,
    warningHardware,
    cpuCritical,
    cpuWarning,
    ramCritical,
    ramWarning,
    tempCritical,
    tempWarning,
    diskCritical,
    diskWarning,
    crcCritical,
    crcWarning,
    crcIssues,
    summary,
  };
}

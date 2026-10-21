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

  // 4. NOTE: Interface link down states and empty/unpopulated optical DOM metrics
  // are deliberately EXCLUDED from device-wide health calculation per Requirement 4.

  const isCritical = failedHardware.length > 0 || cpuCritical || ramCritical || tempCritical || diskCritical;
  const isWarning = !isCritical && (warningHardware.length > 0 || cpuWarning || ramWarning || tempWarning || diskWarning);

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
    summary,
  };
}

import React from 'react';
import { Server } from '../types';
import { calculateDeviceHealth } from '../utils/deviceHealth';
import { 
  AlertTriangle, 
  WifiOff, 
  Cpu, 
  Layers, 
  Thermometer, 
  HardDrive, 
  Zap, 
  Fan as FanIcon,
  AlertOctagon,
  Network,
  CheckCircle2,
  Disc,
  ShieldAlert
} from 'lucide-react';

interface ActiveIssuesCellProps {
  server: Server;
  isCompact?: boolean;
}

export const ActiveIssuesCell: React.FC<ActiveIssuesCellProps> = ({ server, isCompact = false }) => {
  const healthInfo = calculateDeviceHealth(server);
  const isOnline = server.status === 'online';

  interface IssueItem {
    id: string;
    label: string;
    detail: string;
    severity: 'critical' | 'warning';
    type: 'offline' | 'hardware-psu' | 'hardware-fan' | 'cpu' | 'ram' | 'temp' | 'disk' | 'crc' | 'disk-lifecycle' | 'ecc' | 'general';
  }

  const issues: IssueItem[] = [];

  // 1. Host Offline / Down
  if (!isOnline || healthInfo.isOffline) {
    issues.push({
      id: 'offline',
      label: 'Host Offline',
      detail: 'ICMP / SNMP heartbeat failure — host completely unreachable',
      severity: 'critical',
      type: 'offline',
    });
  }

  // 2. Hardware Unit Failures (PSUs and Fans)
  healthInfo.failedHardware.forEach((name, idx) => {
    const isFan = /fan/i.test(name);
    issues.push({
      id: `failed-hw-${idx}`,
      label: `${name} Failed`,
      detail: `${name} operational status: CRITICAL FAULT / Unpowered`,
      severity: 'critical',
      type: isFan ? 'hardware-fan' : 'hardware-psu',
    });
  });

  // 3. Hardware Unit Warnings (PSUs and Fans)
  healthInfo.warningHardware.forEach((name, idx) => {
    const isFan = /fan/i.test(name);
    issues.push({
      id: `warning-hw-${idx}`,
      label: `${name} Warning`,
      detail: `${name} status: DEGRADED / WARNING`,
      severity: 'warning',
      type: isFan ? 'hardware-fan' : 'hardware-psu',
    });
  });

  // 4. Memory (RAM) Saturation
  if (healthInfo.ramCritical) {
    issues.push({
      id: 'ram-crit',
      label: `RAM: ${server.ramUsage}%`,
      detail: `RAM usage (${server.ramUsage}%) exceeds Critical SLA (>85%)`,
      severity: 'critical',
      type: 'ram',
    });
  } else if (healthInfo.ramWarning) {
    issues.push({
      id: 'ram-warn',
      label: `RAM: ${server.ramUsage}%`,
      detail: `RAM usage (${server.ramUsage}%) exceeds Warning threshold (>70%)`,
      severity: 'warning',
      type: 'ram',
    });
  }

  // 5. CPU Saturation
  if (healthInfo.cpuCritical) {
    issues.push({
      id: 'cpu-crit',
      label: `CPU: ${server.cpuUsage}%`,
      detail: `CPU load (${server.cpuUsage}%) exceeds Critical SLA (>85%)`,
      severity: 'critical',
      type: 'cpu',
    });
  } else if (healthInfo.cpuWarning) {
    issues.push({
      id: 'cpu-warn',
      label: `CPU: ${server.cpuUsage}%`,
      detail: `CPU load (${server.cpuUsage}%) exceeds Warning threshold (>70%)`,
      severity: 'warning',
      type: 'cpu',
    });
  }

  // 6. Thermal Alerts
  if (healthInfo.tempCritical) {
    issues.push({
      id: 'temp-crit',
      label: `Temp: ${server.temperature}°C`,
      detail: `Chassis temperature (${server.temperature}°C) exceeds Critical limit (>75°C)`,
      severity: 'critical',
      type: 'temp',
    });
  } else if (healthInfo.tempWarning) {
    issues.push({
      id: 'temp-warn',
      label: `Temp: ${server.temperature}°C`,
      detail: `Chassis temperature (${server.temperature}°C) elevated (>60°C)`,
      severity: 'warning',
      type: 'temp',
    });
  }

  // 7. Storage / Disk Alerts (Global)
  if (healthInfo.diskCritical) {
    issues.push({
      id: 'disk-crit',
      label: `Disk: ${server.diskUsage}%`,
      detail: `Storage utilization (${server.diskUsage}%) exceeds Critical threshold (>85%)`,
      severity: 'critical',
      type: 'disk',
    });
  } else if (healthInfo.diskWarning) {
    issues.push({
      id: 'disk-warn',
      label: `Disk: ${server.diskUsage}%`,
      detail: `Storage utilization (${server.diskUsage}%) exceeds Warning threshold (>70%)`,
      severity: 'warning',
      type: 'disk',
    });
  }

  // 8. Individual Storage Partitions & Mounts
  const rawStorage = server.storage;
  let storageList: Array<{ name: string; kind?: string; used_pct?: number }> = [];
  if (Array.isArray(rawStorage)) {
    storageList = rawStorage;
  } else if (typeof rawStorage === 'string') {
    try {
      const p = JSON.parse(rawStorage);
      if (Array.isArray(p)) storageList = p;
    } catch {}
  }
  storageList.forEach((s, idx) => {
    const pct = typeof s?.used_pct === 'number' ? s.used_pct : null;
    const mountName = s?.name || `Disk ${idx + 1}`;
    if (pct !== null) {
      if (pct > 85) {
        issues.push({
          id: `storage-crit-${idx}`,
          label: `Vol ${mountName}: ${pct}%`,
          detail: `Partition ${mountName} is near capacity (${pct}% used)`,
          severity: 'critical',
          type: 'disk',
        });
      } else if (pct >= 70) {
        issues.push({
          id: `storage-warn-${idx}`,
          label: `Vol ${mountName}: ${pct}%`,
          detail: `Partition ${mountName} elevated capacity (${pct}% used)`,
          severity: 'warning',
          type: 'disk',
        });
      }
    }
  });

  // 9. Interface CRC Errors (Threshold breaches on physical/optical ports)
  const crcList = healthInfo.crcIssues || [];
  if (crcList.length > 0) {
    crcList.forEach((c, idx) => {
      issues.push({
        id: `crc-${idx}-${c.name}`,
        label: `CRC: ${c.name} (${c.count.toLocaleString()})`,
        detail: `Interface ${c.name} recorded ${c.count.toLocaleString()} CRC packet check failures`,
        severity: c.severity,
        type: 'crc',
      });
    });
  } else {
    // Check raw interfaces if crcIssues wasn't populated
    const rawIfaces = server.interfaces ?? (server as any).network_interfaces;
    let ifacesList: any[] = [];
    if (Array.isArray(rawIfaces)) {
      ifacesList = rawIfaces;
    } else if (typeof rawIfaces === 'string') {
      try {
        const p = JSON.parse(rawIfaces);
        if (Array.isArray(p)) ifacesList = p;
      } catch {}
    }
    ifacesList.forEach((iface, idx) => {
      const errCount = typeof iface?.crc_errors === 'number' ? iface.crc_errors : Number(iface?.crc_errors);
      if (!isNaN(errCount) && errCount > 0) {
        const portName = String(iface.name || iface.descr || iface.description || `Port ${iface.index ?? idx + 1}`).trim();
        const isCrit = errCount >= 50;
        issues.push({
          id: `crc-raw-${idx}-${portName}`,
          label: `CRC: ${portName} (${errCount.toLocaleString()})`,
          detail: `Interface ${portName} recorded ${errCount.toLocaleString()} CRC packet check failures`,
          severity: isCrit ? 'critical' : 'warning',
          type: 'crc',
        });
      }
    });
  }

  // 10. Disk Lifecycle: SSD Wear & HDD SMART Sectors
  const rawWear = typeof server.diskPercentageUsed === 'number' ? server.diskPercentageUsed : null;
  if (rawWear !== null && !isNaN(rawWear)) {
    if (rawWear >= 90) {
      issues.push({
        id: 'ssd-wear-crit',
        label: `SSD Wear: ${rawWear}%`,
        detail: `SSD endurance critical (${rawWear}% wear life consumed)`,
        severity: 'critical',
        type: 'disk-lifecycle',
      });
    } else if (rawWear >= 70) {
      issues.push({
        id: 'ssd-wear-warn',
        label: `SSD Wear: ${rawWear}%`,
        detail: `SSD endurance warning (${rawWear}% wear life consumed)`,
        severity: 'warning',
        type: 'disk-lifecycle',
      });
    }
  }

  const disks = Array.isArray(server.disks) ? server.disks : [];
  disks.forEach((d, idx) => {
    if (!d) return;
    const r = typeof d.reallocated === 'number' ? d.reallocated : null;
    const p = typeof d.pending === 'number' ? d.pending : null;
    const u = typeof d.uncorrectable === 'number' ? d.uncorrectable : null;
    const dName = d.device || `Disk ${idx + 1}`;

    if ((r !== null && r >= 20) || (p !== null && p >= 5) || (u !== null && u >= 5)) {
      issues.push({
        id: `smart-crit-${dName}`,
        label: `SMART: ${dName}`,
        detail: `HDD ${dName} SMART Critical: ${r || 0} reallocated, ${p || 0} pending, ${u || 0} uncorrectable sectors`,
        severity: 'critical',
        type: 'disk-lifecycle',
      });
    } else if ((r !== null && r >= 5) || (p !== null && p >= 1) || (u !== null && u >= 1)) {
      issues.push({
        id: `smart-warn-${dName}`,
        label: `SMART: ${dName}`,
        detail: `HDD ${dName} SMART Warning: ${r || 0} reallocated, ${p || 0} pending sectors`,
        severity: 'warning',
        type: 'disk-lifecycle',
      });
    }
  });

  // 11. RAM ECC Memory Parity Errors
  const eccUncorrected = typeof server.ramEccUncorrected === 'number' ? server.ramEccUncorrected : null;
  const eccCorrected = typeof server.ramEccCorrected === 'number' ? server.ramEccCorrected : null;
  if (eccUncorrected !== null && eccUncorrected > 0) {
    issues.push({
      id: 'ecc-uncorrected',
      label: `RAM ECC: ${eccUncorrected} Uncorrected`,
      detail: `Hardware uncorrected multi-bit memory parity errors detected`,
      severity: 'critical',
      type: 'ecc',
    });
  } else if (eccCorrected !== null && eccCorrected > 50) {
    issues.push({
      id: 'ecc-corrected',
      label: `RAM ECC: ${eccCorrected} Corrected`,
      detail: `High rate of single-bit ECC memory corrections detected`,
      severity: 'warning',
      type: 'ecc',
    });
  }

  // 12. Fallback if health is marked critical/warning but no specific items matched
  if (issues.length === 0) {
    if (healthInfo.health === 'Critical') {
      issues.push({
        id: 'generic-crit',
        label: 'Critical Fault',
        detail: healthInfo.summary || 'Device state critical',
        severity: 'critical',
        type: 'general',
      });
    } else if (healthInfo.health === 'Warning') {
      issues.push({
        id: 'generic-warn',
        label: 'Warning Alert',
        detail: healthInfo.summary || 'Device state warning',
        severity: 'warning',
        type: 'general',
      });
    }
  }

  const renderIssueIcon = (item: IssueItem) => {
    const iconClass = 'w-3 h-3 shrink-0';
    switch (item.type) {
      case 'offline':
        return <WifiOff className={iconClass} />;
      case 'hardware-psu':
        return <Zap className={iconClass} />;
      case 'hardware-fan':
        return <FanIcon className={iconClass} />;
      case 'cpu':
        return <Cpu className={iconClass} />;
      case 'ram':
        return <Layers className={iconClass} />;
      case 'temp':
        return <Thermometer className={iconClass} />;
      case 'disk':
        return <HardDrive className={iconClass} />;
      case 'crc':
        return <Network className={iconClass} />;
      case 'disk-lifecycle':
        return <Disc className={iconClass} />;
      case 'ecc':
        return <ShieldAlert className={iconClass} />;
      default:
        return item.severity === 'critical' ? (
          <AlertOctagon className={iconClass} />
        ) : (
          <AlertTriangle className={iconClass} />
        );
    }
  };

  // If completely nominal with zero issues
  if (issues.length === 0) {
    return (
      <div className="py-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>All systems nominal</span>
      </div>
    );
  }

  return (
    <div className={`py-1 w-full ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
      {/* Visual Issue Badges (All threshold-breaching errors rendered cleanly) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {issues.map((issue) => {
          const isCrit = issue.severity === 'critical';
          return (
            <span
              key={issue.id}
              title={issue.detail}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all shadow-xs ${
                isCrit
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-600 dark:text-rose-400 shadow-rose-500/10 hover:bg-rose-500/25'
                  : 'bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-400 shadow-amber-500/10 hover:bg-amber-500/25'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCrit ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
              {renderIssueIcon(issue)}
              <span className="whitespace-nowrap">{issue.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveIssuesCell;

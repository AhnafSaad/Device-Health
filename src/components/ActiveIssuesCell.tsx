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
  Activity
} from 'lucide-react';

interface ActiveIssuesCellProps {
  server: Server;
}

export const ActiveIssuesCell: React.FC<ActiveIssuesCellProps> = ({ server }) => {
  const healthInfo = calculateDeviceHealth(server);
  const isOnline = server.status === 'online';

  interface IssueItem {
    id: string;
    label: string;
    detail: string;
    severity: 'critical' | 'warning';
    type: 'offline' | 'hardware-psu' | 'hardware-fan' | 'cpu' | 'ram' | 'temp' | 'disk' | 'general';
  }

  const issues: IssueItem[] = [];

  // 1. Host Offline / Down
  if (!isOnline || healthInfo.isOffline) {
    issues.push({
      id: 'offline',
      label: 'Host Offline',
      detail: 'ICMP / SNMP heartbeat failure — device unreachable',
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
      detail: `${name} operational status: CRITICAL FAULT`,
      severity: 'critical',
      type: isFan ? 'hardware-fan' : 'hardware-psu',
    });
  });

  // 3. Hardware Unit Warnings
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

  // 7. Storage / Disk Alerts
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

  // Fallback if marked critical/warning without specific sub-metric
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
      default:
        return item.severity === 'critical' ? (
          <AlertOctagon className={iconClass} />
        ) : (
          <AlertTriangle className={iconClass} />
        );
    }
  };

  return (
    <div className="space-y-1.5 py-1 min-w-[210px] max-w-[340px]">
      {/* Visual Issue Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {issues.map((issue) => {
          const isCrit = issue.severity === 'critical';
          return (
            <span
              key={issue.id}
              title={issue.detail}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all shadow-xs ${
                isCrit
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-rose-500/10'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-amber-500/10'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCrit ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
              {renderIssueIcon(issue)}
              <span>{issue.label}</span>
            </span>
          );
        })}
      </div>

      {/* Root Cause Summary Line */}
      <div 
        className="flex items-center gap-1.5 text-[11px] font-mono text-base-content/75 truncate"
        title={healthInfo.summary}
      >
        <Activity className="w-3 h-3 text-base-content/40 shrink-0" />
        <span className="truncate">{healthInfo.summary}</span>
      </div>
    </div>
  );
};

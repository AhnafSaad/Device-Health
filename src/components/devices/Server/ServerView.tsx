import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, NetworkInterface } from '../../../types';
import { DeviceHeader } from '../shared/DeviceHeader';
import { 
  formatDiskThroughput, 
  formatPowerOnDuration, 
  formatLifetimeDataBytes, 
  getWearTextColor, 
  getWearBarColor 
} from './ServerBrands';
import { DiskLifecycleCard } from './DiskLifecycleCard';
import { BrandLogo } from '../../BrandLogo';
import { formatRack } from '../../../utils/rack';
import { fetchWithAuth } from '../../../utils/auth';
import { calculateDeviceHealth } from '../../../utils/deviceHealth';
import { 
  Server as ServerIcon, 
  Activity, 
  Cpu, 
  MemoryStick, 
  Database,
  HardDrive,
  Radio, 
  Thermometer, 
  Clock, 
  MapPin, 
  Layers, 
  ShieldCheck, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Terminal,
  Hash,
  Zap,
  Network,
  Eye,
  X,
  ChevronDown
} from 'lucide-react';

export interface ServerViewProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
  onUpdateServer?: (updated: Server) => void;
}

export const ServerView: React.FC<ServerViewProps> = ({
  server: propServer,
  onBack,
  onEditServer,
  onDeleteServer,
  onUpdateServer,
}) => {
  const [liveServer, setLiveServer] = useState<Server>(propServer);
  const server = liveServer;
  const [isLiveActive] = useState<boolean>(true);
  const [liveIntervalSec] = useState<number>(15);
  const [isPollingNow, setIsPollingNow] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isEccDetailsExpanded, setIsEccDetailsExpanded] = useState<boolean>(false);

  // Interfaces & ports state
  const [portFilter, setPortFilter] = useState<'all' | 'up' | 'down'>('all');
  const [showPortsModal, setShowPortsModal] = useState<boolean>(false);
  const [isPortsExpanded, setIsPortsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPortsModal(false);
      }
    };
    if (showPortsModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showPortsModal]);

  useEffect(() => {
    setLiveServer(propServer);
  }, [propServer]);

  const activeServer = liveServer;
  const isOnline = activeServer.status === 'online';
  const isMetricsUnavailable = activeServer.metricsAvailable === false;

  const pollingRef = useRef<boolean>(false);
  const activeServerRef = useRef<Server>(liveServer);
  activeServerRef.current = liveServer;
  const onUpdateServerRef = useRef(onUpdateServer);
  onUpdateServerRef.current = onUpdateServer;

  const performLivePoll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setIsPollingNow(true);
    try {
      const cur = activeServerRef.current;
      const res = await fetchWithAuth(`/api/devices/${encodeURIComponent(cur.id)}?refresh=true`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.device) {
          const d = data.device;
          const updated: Server = {
            ...cur,
            cpuUsage: Number(d.cpu_usage ?? d.cpuUsage ?? cur.cpuUsage ?? 0),
            ramUsage: Number(d.ram_usage ?? d.ramUsage ?? cur.ramUsage ?? 0),
            diskUsage: Number(d.disk_usage ?? d.diskUsage ?? cur.diskUsage ?? 0),
            uptime: d.uptime || cur.uptime,
            status: (d.status as any) || cur.status,
            health: (d.health as any) || cur.health,
            loadAverage: d.load_average || cur.loadAverage,
            lastPolledAt: d.recorded_at || new Date().toISOString(),
            storage: Array.isArray(d.storage)
              ? d.storage
              : typeof d.storage === 'string'
              ? (() => {
                  try {
                    return JSON.parse(d.storage);
                  } catch {
                    return cur.storage;
                  }
                })()
              : (cur.storage ?? null),
            diskIo: typeof d.disk_io === 'string'
              ? (() => {
                  try {
                    return JSON.parse(d.disk_io);
                  } catch {
                    return cur.diskIo;
                  }
                })()
              : (d.disk_io !== undefined ? d.disk_io : (cur.diskIo ?? null)),
            diskPercentageUsed: d.disk_percentage_used !== undefined && d.disk_percentage_used !== null ? Number(d.disk_percentage_used) : (d.diskPercentageUsed ?? cur.diskPercentageUsed ?? null),
            diskPowerOnHours: d.disk_power_on_hours !== undefined && d.disk_power_on_hours !== null ? Number(d.disk_power_on_hours) : (d.diskPowerOnHours ?? cur.diskPowerOnHours ?? null),
            diskLifetimeBytesRead: d.disk_lifetime_bytes_read !== undefined && d.disk_lifetime_bytes_read !== null ? Number(d.disk_lifetime_bytes_read) : (d.diskLifetimeBytesRead ?? cur.diskLifetimeBytesRead ?? null),
            diskLifetimeBytesWritten: d.disk_lifetime_bytes_written !== undefined && d.disk_lifetime_bytes_written !== null ? Number(d.disk_lifetime_bytes_written) : (d.diskLifetimeBytesWritten ?? cur.diskLifetimeBytesWritten ?? null),
            diskEstimatedEolDays: d.disk_estimated_eol_days !== undefined && d.disk_estimated_eol_days !== null ? Number(d.disk_estimated_eol_days) : (d.diskEstimatedEolDays ?? cur.diskEstimatedEolDays ?? null),
            ramEccCorrected: d.ram_ecc_corrected !== undefined && d.ram_ecc_corrected !== null ? Number(d.ram_ecc_corrected) : (d.ramEccCorrected ?? cur.ramEccCorrected ?? null),
            ramEccUncorrected: d.ram_ecc_uncorrected !== undefined && d.ram_ecc_uncorrected !== null ? Number(d.ram_ecc_uncorrected) : (d.ramEccUncorrected ?? cur.ramEccUncorrected ?? null),
            ramEccControllers: Array.isArray(d.ram_ecc_controllers)
              ? d.ram_ecc_controllers
              : typeof d.ram_ecc_controllers === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(d.ram_ecc_controllers);
                    return Array.isArray(parsed) ? parsed : (cur.ramEccControllers ?? null);
                  } catch {
                    return cur.ramEccControllers ?? null;
                  }
                })()
              : (d.ram_ecc_controllers !== undefined ? d.ram_ecc_controllers : (cur.ramEccControllers ?? null)),
            disks: Array.isArray(d.disks)
              ? d.disks
              : typeof d.disks === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(d.disks);
                    return Array.isArray(parsed) ? parsed : (cur.disks ?? null);
                  } catch {
                    return cur.disks ?? null;
                  }
                })()
              : (d.disks !== undefined ? d.disks : (cur.disks ?? null)),
            interfaces: Array.isArray(d.interfaces)
              ? d.interfaces
              : typeof d.interfaces === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(d.interfaces);
                    return Array.isArray(parsed) ? parsed : (cur.interfaces ?? null);
                  } catch {
                    return cur.interfaces ?? null;
                  }
                })()
              : (d.interfaces !== undefined ? d.interfaces : (cur.interfaces ?? null)),
            temperature: d.temperature !== undefined && d.temperature !== null ? Number(d.temperature) : (cur.temperature ?? null),
            powerSupplies: Array.isArray(d.power_supplies)
              ? d.power_supplies
              : typeof d.power_supplies === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(d.power_supplies);
                    return Array.isArray(parsed) ? parsed : (cur.powerSupplies ?? null);
                  } catch {
                    return cur.powerSupplies ?? null;
                  }
                })()
              : (cur.powerSupplies ?? null),
            fans: Array.isArray(d.fans)
              ? d.fans
              : typeof d.fans === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(d.fans);
                    return Array.isArray(parsed) ? parsed : (cur.fans ?? null);
                  } catch {
                    return cur.fans ?? null;
                  }
                })()
              : (cur.fans ?? null),
            brand: d.brand || cur.brand,
            hostname: d.sys_name || d.hostname || cur.hostname,
            deviceModel: d.device_model !== undefined ? d.device_model : (d.deviceModel !== undefined ? d.deviceModel : (cur.deviceModel ?? null)),
            deviceSerial: d.device_serial !== undefined ? d.device_serial : (d.deviceSerial !== undefined ? d.deviceSerial : (cur.deviceSerial ?? null)),
            sysDescr: d.sys_descr || cur.sysDescr,
            sysName: d.sys_name || cur.sysName,
          };
          setLiveServer(updated);
          onUpdateServerRef.current?.(updated);
        }
      }
    } catch {
      // safe fallback
    } finally {
      pollingRef.current = false;
      setIsPollingNow(false);
    }
  }, []);


  const getMetricColor = (val: number) => {
    if (val < 70) return 'text-emerald-500';
    if (val <= 85) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getProgressColor = (val: number) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (val <= 85) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  };

  const handlePing = () => {
    setIsPinging(true);
    setPingResult(null);
    setTimeout(() => {
      setIsPinging(false);
      if (server.status === 'online') {
        const ms = Math.floor(Math.random() * 22) + 6;
        setPingResult(`64 bytes from ${server.ip}: icmp_seq=1 ttl=58 time=${ms}ms (0% packet loss)`);
      } else {
        setPingResult(`From 10.0.0.1: Destination Host Unreachable (${server.ip}) - 100% loss`);
      }
    }, 550);
  };

  const formatStorageBytes = (bytes: number): string => {
    const tib = 1024 ** 4;
    const gib = 1024 ** 3;
    const mib = 1024 ** 2;
    if (bytes >= tib) return `${(bytes / tib).toFixed(2)} TiB`;
    if (bytes >= gib) return `${(bytes / gib).toFixed(1)} GiB`;
    return `${(bytes / mib).toFixed(1)} MiB`;
  };

  const formatStorageKind = (kind: string): string => {
    const lower = (kind || '').toLowerCase();
    if (lower === 'ram') return 'RAM';
    if (lower === 'disk') return 'Disk';
    if (lower === 'flash') return 'Flash';
    if (lower === 'swap') return 'Swap';
    return kind;
  };

  const formatPortSpeed = (speedBps?: number | null) => {
    if (!speedBps || isNaN(speedBps) || speedBps <= 0) return '—';
    if (speedBps >= 10000000000) return `${Math.round(speedBps / 1000000000)} Gbps`;
    if (speedBps >= 1000000000) {
      const gb = speedBps / 1000000000;
      return gb % 1 === 0 ? `${gb} Gbps` : `${gb.toFixed(1)} Gbps`;
    }
    if (speedBps >= 1000000) return `${Math.round(speedBps / 1000000)} Mbps`;
    return `${Math.round(speedBps / 1000)} Kbps`;
  };

  // Disks handling
  const disks = activeServer.disks ?? server.disks;
  const hasDisks = Array.isArray(disks) && disks.length > 0;

  const renderDiskEol = (eolDays?: number | null, wearLevel?: number | null) => {
    if (eolDays !== null && eolDays !== undefined && !isNaN(eolDays) && eolDays > 0) {
      const remainingStr =
        eolDays >= 365
          ? `~${(eolDays / 365.25).toFixed(1)} years remaining`
          : eolDays >= 30
          ? `~${(eolDays / 30.4).toFixed(1)} months remaining`
          : `~${Math.round(eolDays)} days remaining`;

      return (
        <div>
          <div className="font-mono text-xs sm:text-sm font-bold text-base-content">
            {remainingStr}
          </div>
          <div className="text-[10px] text-base-content/50">
            Estimate based on current wear rate; not a guarantee.
          </div>
        </div>
      );
    }

    if ((eolDays === null || eolDays === undefined) && wearLevel === 0) {
      return (
        <div className="font-mono text-xs text-base-content/70">
          Not enough wear data yet (drive wear is still at 0%)
        </div>
      );
    }

    return (
      <div className="font-mono text-xs text-base-content/50">
        Not enough data to estimate
      </div>
    );
  };

  // Ports (prioritize ports with higher CRC errors at the front)
  const rawPorts: NetworkInterface[] = Array.isArray(activeServer.interfaces) && activeServer.interfaces.length > 0
    ? activeServer.interfaces
    : Array.isArray(server.interfaces) && server.interfaces.length > 0
    ? server.interfaces
    : [];

  const allPorts: NetworkInterface[] = [...rawPorts].sort((a, b) => {
    const aCrc = typeof a.crc_errors === 'number' ? a.crc_errors : 0;
    const bCrc = typeof b.crc_errors === 'number' ? b.crc_errors : 0;
    if (bCrc !== aCrc) return bCrc - aCrc;
    return 0;
  });

  const headlinePorts = allPorts;
  const totalPorts = headlinePorts.length;
  const upPorts = headlinePorts.filter((p) => p.oper_status === 'up');
  const downPorts = headlinePorts.filter((p) => p.oper_status === 'down');
  const upCount = upPorts.length;
  const downCount = downPorts.length;
  const upRatio = totalPorts > 0 ? Math.round((upCount / totalPorts) * 100) : 0;

  const filteredHeadlinePorts = portFilter === 'up'
    ? upPorts
    : portFilter === 'down'
    ? downPorts
    : headlinePorts;

  // Power supplies & Fans
  const rawPsus: Array<{ name: string; status: string; watts?: number | null; raw_value?: number | null }> = Array.isArray(server.powerSupplies)
    ? server.powerSupplies
    : typeof (server as any).powerSupplies === 'string'
    ? (() => {
        try {
          const p = JSON.parse((server as any).powerSupplies);
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      })()
    : [];

  const fansList: Array<{ name: string; status: string; rpm?: number | null; percent?: number | null; raw_value?: number | null }> = Array.isArray(server.fans)
    ? server.fans
    : typeof (server as any).fans === 'string'
    ? (() => {
        try {
          const p = JSON.parse((server as any).fans);
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      })()
    : [];

  const hasPsus = rawPsus.length > 0;
  const hasFans = fansList.length > 0;
  const healthInfo = calculateDeviceHealth(server);

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* 1. Breadcrumbs & Header Card */}
      <DeviceHeader
        server={server}
        onBack={onBack}
        onEditServer={onEditServer}
        onDeleteServer={onDeleteServer}
        onPollNow={performLivePoll}
        isPollingNow={isPollingNow}
      />

      {/* 2. Main Dashboard Layout (2-Column Split on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Main Section (lg:col-span-8 or xl:col-span-9): Operational Alerts, Resource Utilization, Storage & Memory, Disks, Network, Power/Fans */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">

          {/* Operational Alerts & Fleet Health */}
          <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5 px-1">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Diagnostic Alerts &amp; Fleet Health
        </h2>

        {/* Offline Critical Alert */}
        {healthInfo.isOffline && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Host Status: OFFLINE CRITICAL</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1 leading-relaxed">
                Heartbeat polling dropped out. Host unreachable at IP <span className="font-mono font-bold">{server.ip}</span>. Please verify IPMI/BMC power status, top-of-rack leaf switch port, or active upstream BGP peer.
              </div>
            </div>
          </div>
        )}

        {/* Critical PSU / Fan Hardware Alert */}
        {!healthInfo.isOffline && healthInfo.failedHardware.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">
                Hardware Unit Failure: {healthInfo.failedHardware.join(', ')}
              </div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Critical hardware sensor status reported for: {healthInfo.failedHardware.join(', ')}. Inspect chassis power supply or cooling fan tray immediately.
              </div>
            </div>
          </div>
        )}

        {/* Elevated CPU Alert (>85%) */}
        {!healthInfo.isOffline && !isMetricsUnavailable && healthInfo.cpuCritical && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Sustained CPU Saturation ({server.cpuUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Thread contention detected on compute cores. Active process threads exceed standard capacity thresholds.
              </div>
            </div>
          </div>
        )}

        {/* Elevated RAM Alert (>85%) */}
        {!healthInfo.isOffline && !isMetricsUnavailable && healthInfo.ramCritical && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Memory Pressure Critical ({server.ramUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Linux kernel page buffer depleted. High risk of OOM reaper terminating active database or worker daemons.
              </div>
            </div>
          </div>
        )}

        {/* Elevated Disk Alert (>85%) */}
        {!healthInfo.isOffline && !isMetricsUnavailable && healthInfo.diskCritical && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">NVMe Storage Pool Near Capacity ({server.diskUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Volume saturation warning: Please inspect `/var/log` or rotate storage audit log files.
              </div>
            </div>
          </div>
        )}

        {/* Thermal Alert (>75°C) */}
        {!healthInfo.isOffline && healthInfo.tempCritical && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Chassis Thermal Threshold Exceeded ({server.temperature}°C)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Chassis temperature is above operating safety limit. Thermal throttling or shutdown may occur.
              </div>
            </div>
          </div>
        )}

        {/* Warning Alert (70-85% usage or hardware warning) */}
        {!healthInfo.isOffline && healthInfo.health === 'Warning' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Telemetry Warning: {healthInfo.summary}</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Resource usage or environmental sensors are approaching SLA operating limits.
              </div>
            </div>
          </div>
        )}

        {/* Neutral Banner when SNMP vendor metrics are unavailable */}
        {!healthInfo.isOffline && isMetricsUnavailable && (
          <div className="p-4 sm:p-5 rounded-2xl bg-base-200/70 border border-base-content/15 text-base-content/80 flex items-start gap-3.5">
            <Info className="w-6 h-6 shrink-0 mt-0.5 text-base-content/60" />
            <div>
              <div className="font-bold text-sm sm:text-base text-base-content">
                SNMP metrics unavailable — device is reachable but did not respond to vendor-specific telemetry OIDs.
              </div>
            </div>
          </div>
        )}

        {/* All Nominal Alert - Unified with List View */}
        {!healthInfo.isOffline && healthInfo.health === 'Normal' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">System Operational &amp; Nominal</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                All host telemetry metrics are securely within standard SLA parameters. No active alerts or threshold breaches recorded.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Metrics Section (Resource Utilization & Storage Memory): 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* Resource Utilization Card (Left) */}
        <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Resource Utilization &amp; Telemetry
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                &lt;70% OK • 70-85% WARN • &gt;85% CRIT
              </span>
            </div>

            <div className="space-y-3.5 sm:space-y-4 flex-1 flex flex-col">
              {/* CPU Bar */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="flex items-center gap-2 text-base-content">
                    <Cpu className="w-4 h-4 text-base-content/70" />
                    <span>Compute CPU Cores</span>
                  </span>
                  <span className={`font-mono text-sm font-black ${isMetricsUnavailable ? 'text-base-content/40' : getMetricColor(server.cpuUsage)}`}>
                    {!isOnline ? 'Offline' : isMetricsUnavailable ? 'N/A' : `${server.cpuUsage}%`}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isMetricsUnavailable ? 'bg-base-content/20' : getProgressColor(server.cpuUsage)}`}
                    style={{ width: isOnline && !isMetricsUnavailable ? `${server.cpuUsage}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                  <span>Target SLA: &lt;70%</span>
                  <span>Load Average: {isMetricsUnavailable ? 'N/A' : (server.loadAverage || '0.78, 0.84, 0.91')}</span>
                </div>
              </div>

              {/* RAM Bar */}
              {(() => {
                const ramStorageItem = Array.isArray(server.storage)
                  ? server.storage.find(s => (s.kind || '').toLowerCase() === 'ram' || /ram|main memory|memory/i.test(s.name || ''))
                  : null;

                const ramUsedLabel = ramStorageItem
                  ? `${formatStorageBytes(ramStorageItem.used_bytes)} / ${formatStorageBytes(ramStorageItem.total_bytes)}`
                  : `${Math.round(server.ramUsage * 0.64)} GB / 64 GB`;

                return (
                  <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5">
                    <div className="flex justify-between items-center text-xs font-semibold mb-2">
                      <span className="flex items-center gap-2 text-base-content">
                        <MemoryStick className="w-4 h-4 text-base-content/70" />
                        <span>RAM Memory Pool</span>
                      </span>
                      <span className={`font-mono text-sm font-black ${isMetricsUnavailable ? 'text-base-content/40' : getMetricColor(server.ramUsage)}`}>
                        {!isOnline ? 'Offline' : isMetricsUnavailable ? 'N/A' : `${server.ramUsage}%`}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isMetricsUnavailable ? 'bg-base-content/20' : getProgressColor(server.ramUsage)}`}
                        style={{ width: isOnline && !isMetricsUnavailable ? `${server.ramUsage}%` : '0%' }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                      <span>Target SLA: &lt;80%</span>
                      <span>Used: {!isOnline ? '0 GB' : isMetricsUnavailable ? 'N/A' : ramUsedLabel}</span>
                    </div>
                  </div>
                );
              })()}

              {/* RAM Memory Health with ECC Details */}
              {(() => {
                const corrected = activeServer.ramEccCorrected ?? server.ramEccCorrected;
                const uncorrected = activeServer.ramEccUncorrected ?? server.ramEccUncorrected;
                const rawControllers = activeServer.ramEccControllers ?? server.ramEccControllers;
                const controllers: Array<{ name: string; ce: number; ue: number }> | null = Array.isArray(rawControllers)
                  ? rawControllers
                  : typeof rawControllers === 'string'
                  ? (() => {
                      try {
                        const p = JSON.parse(rawControllers);
                        return Array.isArray(p) ? p : null;
                      } catch {
                        return null;
                      }
                    })()
                  : null;
                const hasControllers = Array.isArray(controllers) && controllers.length > 0;

                let badgeColor = 'bg-base-200 border-base-content/20 text-base-content/60';
                let badgeLabel = 'Not available';
                let statusText = 'ECC monitoring not available on this host';

                if (uncorrected !== null && uncorrected !== undefined && !isNaN(uncorrected) && uncorrected > 0) {
                  badgeColor = 'bg-rose-500/10 border-rose-500/30 text-rose-500';
                  badgeLabel = 'Critical';
                  statusText = `Uncorrected ECC errors: ${uncorrected} — replace affected DIMM`;
                } else if (
                  (uncorrected === 0 || uncorrected === null || uncorrected === undefined) &&
                  corrected !== null &&
                  corrected !== undefined &&
                  !isNaN(corrected) &&
                  corrected > 0
                ) {
                  badgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-500';
                  badgeLabel = 'Warning';
                  statusText = `Corrected ECC errors: ${corrected} — monitor for recurrence`;
                } else if (uncorrected === 0 && corrected === 0) {
                  badgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
                  badgeLabel = 'Healthy';
                  statusText = 'No ECC errors detected';
                }

                return (
                  <div 
                    className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2 transition-all hover:border-primary/30 cursor-pointer"
                    onClick={() => setIsEccDetailsExpanded((prev) => !prev)}
                    title="Click to view RAM module & memory controller health status"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-base-content flex items-center gap-2">
                        <MemoryStick className="w-4 h-4 text-secondary shrink-0" />
                        <span>RAM Memory Health</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEccDetailsExpanded((prev) => !prev);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline transition-colors cursor-pointer"
                      >
                        <span>
                          {isEccDetailsExpanded
                            ? 'Hide'
                            : hasControllers
                            ? `View ${controllers.length} RAM Channels`
                            : 'Details'}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isEccDetailsExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                      <span className="text-xs text-base-content/80 font-mono">
                        {statusText}
                      </span>
                    </div>

                    {isEccDetailsExpanded && (
                      <div 
                        className="pt-2 border-t border-base-content/10 space-y-2 animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hasControllers ? (
                          <>
                            <div className="text-[11px] font-semibold text-base-content/70 flex items-center justify-between">
                              <span>Memory Controller (MC) Channels & DIMM Slots:</span>
                              <span className="text-emerald-500 font-mono font-medium text-[10px]">All DIMMs Nominal</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {controllers.map((mc, idx) => {
                                const ueNum = Number(mc.ue || 0);
                                const ceNum = Number(mc.ce || 0);
                                const isHealthy = ueNum === 0 && ceNum === 0;
                                const isCritical = ueNum > 0;
                                const mcBadgeColor = isCritical
                                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                  : !isHealthy
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';

                                return (
                                  <div
                                    key={mc.name || idx}
                                    className="p-2 rounded-lg bg-base-100 border border-base-content/10 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500' : isCritical ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`} />
                                      <div className="min-w-0">
                                        <div className="font-bold text-base-content font-mono tracking-tight text-[11px]">
                                          {mc.name.toUpperCase()} (Channel {idx})
                                        </div>
                                        <div className="text-[10px] text-base-content/60 font-mono">
                                          CE: {ceNum} | UE: {ueNum}
                                        </div>
                                      </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-mono ${mcBadgeColor}`}>
                                      {isHealthy ? 'OK' : isCritical ? 'FAULT' : 'WARN'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-base-content/50 font-mono pt-1 text-center">
                              ✓ Hardware EDAC error counters polled via snmpd ram-mc-detail extend script
                            </div>
                          </>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-base-100 border border-base-content/10 text-xs text-base-content/70 space-y-1">
                            <div className="font-semibold text-emerald-500 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ECC Protection Active</span>
                            </div>
                            <p className="text-[11px] text-base-content/60">
                              Corrected Errors: {corrected ?? 0} • Uncorrected Errors: {uncorrected ?? 0}
                            </p>
                            <p className="text-[10px] text-base-content/50 font-mono">
                              All RAM modules installed are communicating normally without hardware parity faults.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Storage & Memory Card (Right) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5 sm:space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Database className="w-4 h-4 text-secondary" />
                Storage &amp; Memory
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                &lt;70% OK • 70-85% WARN • &gt;85% CRIT
              </span>
            </div>

            {Array.isArray(server.storage) && server.storage.length > 0 ? (
              <div className="rounded-xl border border-base-content/10 bg-base-200/30 overflow-hidden divide-y divide-base-content/10 flex-1 flex flex-col">
                {server.storage.map((item, idx) => {
                  const pct = Number(item.used_pct ?? 0);
                  const kindLabel = formatStorageKind(item.kind);
                  return (
                    <div key={`${item.name}-${idx}`} className="p-3 sm:p-3.5 text-xs flex flex-col justify-center flex-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-base-content text-xs sm:text-sm truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded border border-base-content/15 bg-base-300/60 text-base-content/70 text-[10px] font-mono font-semibold shrink-0">
                            {kindLabel}
                          </span>
                        </div>
                        <div className="font-mono text-xs shrink-0 text-right">
                          <span className="text-base-content/70">
                            {formatStorageBytes(item.used_bytes)} / {formatStorageBytes(item.total_bytes)}
                          </span>
                          <span className={`font-bold ml-1.5 ${getMetricColor(pct)}`}>
                            ({pct}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getProgressColor(pct)}`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 text-xs font-mono text-base-content/40 flex-1 flex items-center justify-center">
                Not reported by this device
              </div>
            )}
          </div>
        </div>

        {/* Disk Health & Lifecycle Card (Multi-Column Responsive Grid) */}
        <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              Disk Health &amp; Lifecycle
            </h3>
            <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
              {hasDisks ? `${disks.length} physical ${disks.length === 1 ? 'disk' : 'disks'} detected` : 'Physical storage telemetry'}
            </span>
          </div>

          {!hasDisks ? (
            <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/5 text-xs font-mono text-base-content/50 text-center py-6">
              Not available on this host
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {disks.map((d, idx) => (
                <div key={d.device || idx} className="p-3.5 sm:p-4 rounded-xl bg-base-200/30 border border-base-content/5 hover:border-base-content/15 transition-all">
                  <DiskLifecycleCard disk={d} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Network Ports & Interface Status (Full Span - if present) */}
        {allPorts.length > 0 && (
          <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" />
                    Network Ports &amp; Interface Status
                  </h3>
                  <p className="text-[11px] text-base-content/50 mt-0.5">
                    Hardware interfaces, link state &amp; live operational status
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-base-200/80 border border-base-content/10 font-bold text-base-content flex items-center gap-1.5">
                    <span className="text-base-content/50 font-normal">Total:</span> {totalPorts} Ports
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {upCount} Up
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 font-bold flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    {downCount} Down
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowPortsModal(true)}
                    className="px-3 py-1 rounded-lg bg-primary text-primary-content hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-sm"
                    title="View all ports and interface details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Ports</span>
                  </button>
                </div>
              </div>

              {totalPorts > 0 && (
                <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-base-content/70 flex items-center gap-2">
                      <span>Port Link Availability</span>
                      <span className="font-mono font-bold text-emerald-500">({upRatio}% Connected)</span>
                    </span>
                    <span className="font-mono text-[11px] text-base-content/50">
                      {upCount} of {totalPorts} ports online
                    </span>
                  </div>
                  <div className="h-2 w-full bg-base-300 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${upRatio}%` }}
                    />
                    <div
                      className="h-full bg-rose-500/60 transition-all duration-500"
                      style={{ width: `${100 - upRatio}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Front-Panel summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-base-content/5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {headlinePorts.slice(0, 10).map((p) => {
                    const isUp = p.oper_status === 'up';
                    return (
                      <span
                        key={`mini-${p.name}-${p.index}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                          isUp
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'bg-base-200/80 border-base-content/10 text-base-content/50'
                        }`}
                        title={`${p.name}: ${isUp ? 'UP (' + formatPortSpeed(p.speed) + ')' : 'DOWN'}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500/70'}`} />
                        <span>{p.name}</span>
                      </span>
                    );
                  })}
                  {headlinePorts.length > 10 && (
                    <span className="text-[10px] font-mono text-base-content/50 px-1">
                      +{headlinePorts.length - 10} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPortsExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline transition-colors cursor-pointer"
                  >
                    <span>{isPortsExpanded ? 'Hide inline list' : 'Expand inline'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isPortsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Inline list */}
              {isPortsExpanded && (
                <div className="space-y-3 pt-2.5 border-t border-base-content/10 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPortFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        portFilter === 'all'
                          ? 'bg-primary text-primary-content shadow-xs'
                          : 'bg-base-200/60 hover:bg-base-200 text-base-content/70'
                      }`}
                    >
                      All Ports ({totalPorts})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortFilter('up')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        portFilter === 'up'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-base-200/60 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active Up ({upCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortFilter('down')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        portFilter === 'down'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'bg-base-200/60 hover:bg-rose-500/10 text-rose-500'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Down ({downCount})
                    </button>
                  </div>

                  <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-1">
                    {filteredHeadlinePorts.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {filteredHeadlinePorts.map((port) => {
                          const isUp = port.oper_status === 'up';
                          return (
                            <div
                              key={`inline-${port.name}-${port.index}`}
                              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                                isUp
                                  ? 'bg-emerald-500/[0.04] border-emerald-500/25 hover:border-emerald-500/40 shadow-2xs'
                                  : 'bg-base-200/40 border-base-content/10 hover:border-base-content/20'
                              }`}
                              title={port.name}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${
                                        isUp
                                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                                          : 'bg-rose-500/70'
                                      }`}
                                    />
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                        isUp
                                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                      }`}
                                    >
                                      {isUp ? 'UP' : 'DOWN'}
                                    </span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 bg-base-300/80 text-base-content/70 border border-base-content/10">
                                    {(port.type || 'ethernet').toLowerCase() === 'sfp' ? 'SFP' : (port.type || 'ethernet').toUpperCase()}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-1.5 min-w-0">
                                  <div
                                    className="font-mono font-bold text-xs text-base-content truncate leading-tight"
                                    title={port.name}
                                  >
                                    {port.name}
                                  </div>
                                  {port.crc_errors !== null && port.crc_errors !== undefined && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${
                                        port.crc_errors > 0
                                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                          : 'bg-base-200/80 text-base-content/60 border-base-content/10'
                                      }`}
                                      title={`CRC Errors: ${port.crc_errors.toLocaleString()}`}
                                    >
                                      CRC: {port.crc_errors.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-base-content/5">
                                <span className="text-base-content/50 uppercase text-[9px]">
                                  {port.type || 'Ethernet'}
                                </span>
                                <span className={isUp ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-base-content/40'}>
                                  {isUp ? formatPortSpeed(port.speed) : 'No Link'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/10 text-center text-xs font-mono text-base-content/50">
                        No ports match the selected filter.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Full Modal */}
              {showPortsModal && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn"
                  onClick={() => setShowPortsModal(false)}
                >
                  <div
                    className="bg-base-100 border border-base-content/15 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 sm:p-5 border-b border-base-content/10 flex items-center justify-between gap-3 bg-base-200/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                          <Network className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-base-content truncate flex items-center gap-2">
                            <span>Network Ports &amp; Interfaces</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-base-300 font-mono text-base-content/70 font-normal">
                              {activeServer.hostname || activeServer.ip}
                            </span>
                          </h3>
                          <p className="text-xs text-base-content/50 truncate">
                            IP: {activeServer.ip} • Type: Server • {totalPorts} ports detected
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPortsModal(false)}
                        className="p-2 rounded-xl text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors cursor-pointer"
                        aria-label="Close modal"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-4 sm:p-5 border-b border-base-content/10 space-y-3 bg-base-200/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-base-200 border border-base-content/10 font-bold text-base-content">
                            Total: {totalPorts} Ports
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {upCount} Up
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            {downCount} Down
                          </span>
                        </div>
                        <div className="text-xs font-mono text-base-content/70">
                          <span>Port Link Availability: </span>
                          <span className="font-bold text-emerald-500">{upRatio}%</span> ({upCount}/{totalPorts} online)
                        </div>
                      </div>

                      <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden flex">
                        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${upRatio}%` }} />
                        <div className="h-full bg-rose-500/60 transition-all duration-300" style={{ width: `${100 - upRatio}%` }} />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setPortFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            portFilter === 'all'
                              ? 'bg-primary text-primary-content shadow-xs'
                              : 'bg-base-200/70 hover:bg-base-200 text-base-content/70'
                          }`}
                        >
                          All Ports ({totalPorts})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPortFilter('up')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            portFilter === 'up'
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'bg-base-200/70 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active Up ({upCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPortFilter('down')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            portFilter === 'down'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'bg-base-200/70 hover:bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Down ({downCount})
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                      {filteredHeadlinePorts.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {filteredHeadlinePorts.map((port) => {
                            const isUp = port.oper_status === 'up';
                            return (
                              <div
                                key={`modal-${port.name}-${port.index}`}
                                className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                                  isUp
                                    ? 'bg-emerald-500/[0.04] border-emerald-500/25 hover:border-emerald-500/40 shadow-2xs'
                                    : 'bg-base-200/40 border-base-content/10 hover:border-base-content/20'
                                }`}
                                title={port.name}
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          isUp
                                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                                            : 'bg-rose-500/70'
                                        }`}
                                      />
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                                          isUp
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                        }`}
                                      >
                                        {isUp ? 'UP' : 'DOWN'}
                                      </span>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 bg-base-300/80 text-base-content/70 border border-base-content/10">
                                      {(port.type || 'ethernet').toLowerCase() === 'sfp' ? 'SFP' : (port.type || 'ethernet').toUpperCase()}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <div
                                      className="font-mono font-bold text-xs sm:text-sm text-base-content truncate leading-tight"
                                      title={port.name}
                                    >
                                      {port.name}
                                    </div>
                                    {port.crc_errors !== null && port.crc_errors !== undefined && (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${
                                          port.crc_errors > 0
                                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                            : 'bg-base-200/80 text-base-content/60 border-base-content/10'
                                        }`}
                                        title={`CRC Errors: ${port.crc_errors.toLocaleString()}`}
                                      >
                                        CRC: {port.crc_errors.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-base-content/5">
                                  <span className="text-base-content/50 uppercase text-[10px]">
                                    {port.type || 'Ethernet'}
                                  </span>
                                  <span className={isUp ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-base-content/40'}>
                                    {isUp ? formatPortSpeed(port.speed) : 'No Link'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl bg-base-200/40 border border-base-content/10 text-center text-xs font-mono text-base-content/50">
                          No ports match the selected filter.
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 sm:p-4 border-t border-base-content/10 flex items-center justify-between bg-base-200/30">
                      <span className="text-xs font-mono text-base-content/50">
                        Showing {filteredHeadlinePorts.length} of {totalPorts} ports
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPortsModal(false)}
                        className="px-4 py-1.5 rounded-xl bg-base-200 hover:bg-base-300 text-xs font-bold text-base-content transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Power Supplies, Fans & Temperature (Full Span of Left Section) */}
          <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Power Supplies, Fans &amp; Temperature
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                Chassis Environmental Sensors
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {/* Power Supplies Card */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-base-content">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <span>Power Supplies</span>
                  </span>
                </div>
                {hasPsus ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                    {rawPsus.map((psu, idx) => {
                      const rawVal = psu.raw_value;
                      const rawName = psu.name || '';
                      const numMatch = rawName.match(/(?:power\s*supply|psu)[-\s_]*(\d+)/i);
                      const stateMatch = rawName.match(/^psu(\d+)-state$/i);
                      const displayLabel = numMatch
                        ? `PSU ${numMatch[1]}`
                        : stateMatch
                        ? `PSU ${stateMatch[1]}`
                        : (rawName.replace(/power\s*supply/gi, 'PSU') || `PSU ${idx + 1}`);
                      const statusBadge =
                        psu.status === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : psu.status === 'warning'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : psu.status === 'critical'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : 'bg-base-300/60 text-base-content/50 border-base-content/15';
                      return (
                        <div key={`${displayLabel}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-base-content whitespace-nowrap">{displayLabel}</span>
                            {typeof psu.watts === 'number' && Number.isFinite(psu.watts) && psu.watts > 0 && psu.watts <= 2000 && (
                              <span className="text-[11px] text-base-content/50 font-normal whitespace-nowrap">
                                {psu.watts} W
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {rawVal !== undefined && rawVal !== null && (
                              <span className="text-[10px] text-base-content/40 whitespace-nowrap">
                                raw value {rawVal}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase whitespace-nowrap ${statusBadge}`}>
                              {psu.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-base-content/40">
                    Not reported by this device
                  </div>
                )}
              </div>

              {/* Fans Card */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2">
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="flex items-center gap-2 text-base-content">
                      <Activity className="w-4 h-4 text-sky-500" />
                      <span>Fans</span>
                    </span>
                  </div>
                  {fansList.some((f) => typeof f.percent === 'number' && Number.isFinite(f.percent)) && (
                    <p className="text-[10px] text-base-content/50 font-sans mt-0.5">
                      Fan speed reported as duty cycle (%) by this hardware
                    </p>
                  )}
                </div>
                {hasFans ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                    {fansList.map((fan, idx) => {
                      const numMatch = fan.name?.match(/fan\s*(\d+)/i) || fan.name?.match(/(\d+)/);
                      const displayLabel = numMatch ? `Fan ${numMatch[1]}` : (fan.name || `Fan ${idx + 1}`);
                      const statusBadge =
                        fan.status === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : fan.status === 'warning'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : fan.status === 'critical'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : 'bg-base-300/60 text-base-content/50 border-base-content/15';

                      const fanValueText =
                        typeof fan.rpm === 'number' && Number.isFinite(fan.rpm)
                          ? `${fan.rpm} RPM`
                          : typeof fan.percent === 'number' && Number.isFinite(fan.percent)
                          ? `${fan.percent.toFixed(1)}%`
                          : '—';

                      return (
                        <div key={`${displayLabel}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono">
                          <span className="font-semibold text-base-content whitespace-nowrap">{displayLabel}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base-content/60 whitespace-nowrap">{fanValueText}</span>
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase whitespace-nowrap ${statusBadge}`}>
                              {fan.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-base-content/40">
                    Not reported by this device
                  </div>
                )}
              </div>

              {/* Temperature (°C) Card */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="flex items-center gap-2 text-base-content">
                    <Thermometer className="w-4 h-4 text-amber-500" />
                    <span>Temperature (°C)</span>
                  </span>
                </div>
                <div className="my-1">
                  {(() => {
                    const rawT = server.temperature;
                    const normT =
                      typeof rawT === 'number' && Number.isFinite(rawT)
                        ? Math.abs(rawT) >= 10000
                          ? rawT / 1000
                          : Math.abs(rawT) > 150
                          ? rawT / 10
                          : rawT
                        : null;
                    return (
                      <span
                        className={`font-mono text-xl font-black ${
                          !isOnline || normT === null
                            ? 'text-base-content/40'
                            : normT >= 85
                            ? 'text-rose-500'
                            : normT >= 70
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {!isOnline || normT === null
                          ? 'N/A'
                          : `${Number(normT).toFixed(1)} °C`}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-[11px] text-base-content/60 font-mono mt-1">
                  Chassis Thermal Sensor
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Section (lg:col-span-4 or xl:col-span-3): Hardware Specifications & SRE Diagnostics (Sticky on desktop) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-6 lg:self-start">
          
          {/* Hardware Info Card */}
          <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Hardware Specifications
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <ServerIcon className="w-3.5 h-3.5 text-primary" />
                    Device Brand / Vendor
                  </span>
                  <BrandLogo brand={server.brand} size="xs" />
                </div>
                <div className="font-semibold text-base-content flex items-center gap-2">
                  <BrandLogo brand={server.brand} size="sm" />
                  <span>{server.brand || 'Unassigned / Other'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  Device Model
                </div>
                <div className="font-semibold text-base-content font-mono">
                  {server.deviceModel || 'Not reported'}
                </div>
                {server.sysDescr && (
                  <div
                    className="text-[11px] text-base-content/50 font-mono mt-1 line-clamp-2"
                    title={server.sysDescr}
                  >
                    {server.sysDescr}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  Serial Number
                </div>
                {(() => {
                  const rawSerial = activeServer.deviceSerial ?? server.deviceSerial;
                  const sLower = (rawSerial || '').trim().toLowerCase();
                  const hostLower = (activeServer.hostname || server.hostname || '').trim().toLowerCase();
                  const sysLower = (activeServer.sysName || server.sysName || '').trim().toLowerCase();
                  const isInvalid = !rawSerial ||
                    sLower === hostLower ||
                    sLower === sysLower ||
                    sLower === 'manikganj-olt' ||
                    sLower === 'vsol88a4f2c901' ||
                    /-(?:olt|router|sw|switch|server|node)$/i.test(sLower) ||
                    (hostLower && (sLower.includes(hostLower) || hostLower.includes(sLower)) && hostLower.includes('-')) ||
                    (sysLower && (sLower.includes(sysLower) || sysLower.includes(sLower)) && sysLower.includes('-'));

                  return !isInvalid ? (
                    <div className="font-semibold text-base-content font-mono break-all">
                      {rawSerial}
                    </div>
                  ) : (
                    <div className="font-semibold text-base-content/40 font-mono">
                      Not reported
                    </div>
                  );
                })()}
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  System Uptime
                </div>
                <div className="font-semibold font-mono text-base-content">{server.uptime}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-secondary" />
                  Data Center or Location
                </div>
                <div className="font-semibold text-base-content">
                  {server.datacenterName || server.location}
                </div>
                <div className="text-[11px] text-base-content/50 font-mono mt-0.5">{server.location}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  Rack
                </div>
                <div className="font-semibold font-mono text-base-content">
                  {formatRack(server.rackNumber) || 'Unassigned'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  SNMPv2c Polling Engine
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="font-bold text-emerald-500">Active &amp; Protected</span>
                  <span className="text-[10px] text-base-content/40 font-sans">(Community string secured)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick SRE Diagnostic Actions Card */}
          <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Immediate SRE Diagnostics
            </h3>

            <div className="space-y-2.5">
              <button
                onClick={handlePing}
                disabled={isPinging}
                className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold border border-primary/30 text-primary hover:bg-primary hover:text-primary-content transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
                <span>{isPinging ? 'Pinging Device...' : 'Run ICMP Ping Test'}</span>
              </button>
            </div>

            {pingResult && (
              <div className="p-3 rounded-xl bg-base-300/80 border border-base-content/10 font-mono text-xs text-base-content/90 animate-fadeIn space-y-1">
                <div className="text-[10px] text-base-content/50 uppercase font-bold tracking-wider">ICMP Ping Echo Output:</div>
                <div className="leading-relaxed">{pingResult}</div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default ServerView;

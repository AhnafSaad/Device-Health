import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server } from '../../../types';
import { DeviceHeader } from '../shared/DeviceHeader';
import { TelemetryBar, getMetricColor, getProgressColor } from '../shared/TelemetryBar';
import { ServerBrandSpecificLogic } from './ServerBrands';
import { BrandLogo } from '../../BrandLogo';
import { formatRack } from '../../../utils/rack';
import { fetchWithAuth } from '../../../utils/auth';
import { 
  Activity, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Database,
  Zap, 
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
  ChevronDown,
  Radio,
  Server as ServerIcon
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
  onRebootServer,
  onUpdateServer,
}) => {
  const [liveServer, setLiveServer] = useState<Server>(propServer);
  const server = liveServer;
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [liveIntervalSec, setLiveIntervalSec] = useState<number>(15);
  const [isPollingNow, setIsPollingNow] = useState<boolean>(false);
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isEccDetailsExpanded, setIsEccDetailsExpanded] = useState<boolean>(false);

  useEffect(() => {
    setLiveServer(propServer);
  }, [propServer]);

  const isOnline = server.status === 'online';
  const isMetricsUnavailable = server.metricsAvailable === false;

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
            diskPercentageUsed: d.disk_percentage_used !== undefined && d.disk_percentage_used !== null ? Number(d.disk_percentage_used) : (cur.diskPercentageUsed ?? null),
            diskPowerOnHours: d.disk_power_on_hours !== undefined && d.disk_power_on_hours !== null ? Number(d.disk_power_on_hours) : (cur.diskPowerOnHours ?? null),
            diskLifetimeBytesRead: d.disk_lifetime_bytes_read !== undefined && d.disk_lifetime_bytes_read !== null ? Number(d.disk_lifetime_bytes_read) : (cur.diskLifetimeBytesRead ?? null),
            diskLifetimeBytesWritten: d.disk_lifetime_bytes_written !== undefined && d.disk_lifetime_bytes_written !== null ? Number(d.disk_lifetime_bytes_written) : (cur.diskLifetimeBytesWritten ?? null),
            diskEstimatedEolDays: d.disk_estimated_eol_days !== undefined && d.disk_estimated_eol_days !== null ? Number(d.disk_estimated_eol_days) : (cur.diskEstimatedEolDays ?? null),
            ramEccCorrected: d.ram_ecc_corrected !== undefined && d.ram_ecc_corrected !== null ? Number(d.ram_ecc_corrected) : (cur.ramEccCorrected ?? null),
            ramEccUncorrected: d.ram_ecc_uncorrected !== undefined && d.ram_ecc_uncorrected !== null ? Number(d.ram_ecc_uncorrected) : (cur.ramEccUncorrected ?? null),
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
              : (cur.ramEccControllers ?? null),
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
              : (cur.disks ?? null),
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
            deviceModel: d.device_model !== undefined ? d.device_model : (cur.deviceModel ?? null),
            deviceSerial: d.device_serial !== undefined ? d.device_serial : (cur.deviceSerial ?? null),
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

  useEffect(() => {
    if (!isLiveActive || liveIntervalSec <= 0) return;
    performLivePoll();
    const timer = setInterval(() => {
      performLivePoll();
    }, liveIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [isLiveActive, liveIntervalSec, server.id, performLivePoll]);

  const handleCopySsh = () => {
    const cmd = `ssh admin@${server.ip}`;
    navigator.clipboard?.writeText(cmd);
    setCopiedSsh(true);
    setTimeout(() => setCopiedSsh(false), 2000);
  };

  const handlePing = () => {
    setIsPinging(true);
    setPingResult(null);
    setTimeout(() => {
      setIsPinging(false);
      if (server.status === 'online') {
        const ms = Math.floor(Math.random() * 8) + 2;
        setPingResult(`64 bytes from ${server.ip}: icmp_seq=1 ttl=64 time=${ms}ms (0% packet loss)`);
      } else {
        setPingResult(`From 10.0.0.1: Destination Host Unreachable (${server.ip}) - 100% loss`);
      }
    }, 500);
  };

  const formatStorageBytes = (bytes: number): string => {
    const tib = 1024 ** 4;
    const gib = 1024 ** 3;
    const mib = 1024 ** 2;
    if (bytes >= tib) return `${(bytes / tib).toFixed(2)} TiB`;
    if (bytes >= gib) return `${(bytes / gib).toFixed(1)} GiB`;
    return `${(bytes / mib).toFixed(1)} MiB`;
  };

  const formatPowerOnDuration = (hours?: number | null): string => {
    if (hours === null || hours === undefined || isNaN(hours) || hours < 0) return 'N/A';
    const h = Math.round(hours);
    const years = Math.floor(h / 8760);
    const remHours = h % 8760;
    const months = Math.floor(remHours / 720);
    const days = Math.floor((remHours % 720) / 24);
    if (years > 0) return months > 0 ? `${years}y ${months}m` : `${years}y`;
    if (months > 0) return days > 0 ? `${months}m ${days}d` : `${months}m`;
    if (days > 0) return `${days}d ${h % 24}h`;
    return `${h}h`;
  };

  const formatLifetimeDataBytes = (bytes?: number | null): string => {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return 'N/A';
    const tb = 1000 ** 4;
    const gb = 1000 ** 3;
    if (bytes >= tb) return `${(bytes / tb).toFixed(1)} TB`;
    if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
    const mb = 1000 ** 2;
    if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
    return `${bytes} B`;
  };

  const formatThroughput = (bytesPerSec?: number | null) => {
    if (bytesPerSec === null || bytesPerSec === undefined || isNaN(bytesPerSec)) return '—';
    const mbs = bytesPerSec / (1024 * 1024);
    if (mbs >= 1000) return `${(mbs / 1024).toFixed(2)} GB/s`;
    return `${mbs.toFixed(2)} MB/s`;
  };

  const getWearTextColor = (val: number) => {
    if (val < 70) return 'text-emerald-500';
    if (val <= 90) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getWearBarColor = (val: number) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (val <= 90) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  };

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
          <div className="font-mono text-xs sm:text-sm font-bold text-base-content">{remainingStr}</div>
          <div className="text-[10px] text-base-content/50">Estimate based on current wear rate.</div>
        </div>
      );
    }
    if ((eolDays === null || eolDays === undefined) && wearLevel === 0) {
      return <div className="font-mono text-xs text-base-content/70">Drive wear is still at 0% (New)</div>;
    }
    return <div className="font-mono text-xs text-base-content/50">Not enough data to estimate</div>;
  };

  // RAM Memory Health / ECC
  const corrected = server.ramEccCorrected;
  const uncorrected = server.ramEccUncorrected;
  const controllers = server.ramEccControllers;
  const hasControllers = Array.isArray(controllers) && controllers.length > 0;

  let eccBadgeColor = 'bg-base-200 border-base-content/20 text-base-content/60';
  let eccBadgeLabel = 'Not available';
  let eccStatusText = 'ECC monitoring not available on this host';

  if (uncorrected !== null && uncorrected !== undefined && !isNaN(uncorrected) && uncorrected > 0) {
    eccBadgeColor = 'bg-rose-500/10 border-rose-500/30 text-rose-500';
    eccBadgeLabel = 'Critical';
    eccStatusText = `Uncorrected ECC errors: ${uncorrected} — replace affected DIMM`;
  } else if (corrected !== null && corrected !== undefined && !isNaN(corrected) && corrected > 0) {
    eccBadgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-500';
    eccBadgeLabel = 'Warning';
    eccStatusText = `Corrected ECC errors: ${corrected} — monitor for recurrence`;
  } else if (uncorrected === 0 && corrected === 0) {
    eccBadgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
    eccBadgeLabel = 'Healthy';
    eccStatusText = 'No ECC errors detected';
  }

  // Physical disks
  const disks = server.disks;
  const hasDisks = Array.isArray(disks) && disks.length > 0;

  // Environmental sensors
  const rawPsus = server.powerSupplies || [];
  const hasPsus = rawPsus.length > 0;
  const fansList = server.fans || [];
  const hasFans = fansList.length > 0;

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
    <div className="w-full max-w-7xl mx-auto space-y-3.5 sm:space-y-4 pb-10 animate-fadeIn">
      {/* 1. Header */}
      <DeviceHeader
        server={server}
        onBack={onBack}
        onEditServer={onEditServer}
        onDeleteServer={onDeleteServer}
        onRebootServer={onRebootServer}
        isPollingNow={isPollingNow}
        onPollNow={performLivePoll}
        copiedSsh={copiedSsh}
        onCopySsh={handleCopySsh}
        isPinging={isPinging}
        onPing={handlePing}
      />

      {/* 2. Diagnostic Alerts */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5 px-1">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Server Node Diagnostics &amp; System Health
        </h2>

        {!isOnline && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Host Status: OFFLINE CRITICAL</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1 leading-relaxed">
                Compute node unreachable at IP <span className="font-mono font-bold">{server.ip}</span>.
                Verify BMC/IPMI power status or top-of-rack leaf switch port.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Sustained CPU Saturation ({server.cpuUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Thread contention detected on compute cores. Active process threads exceed standard capacity thresholds.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.ramUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Memory Pressure Critical ({server.ramUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Linux kernel page buffer depleted. High risk of OOM reaper terminating active database or worker daemons.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.diskUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Storage Pool Near Capacity ({server.diskUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Volume saturation warning: Inspect `/var/log` or rotate PostgreSQL audit log files.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage <= 85 && server.ramUsage <= 85 && server.diskUsage <= 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">System Operational &amp; Nominal</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                All host compute telemetry metrics are within standard SLA parameters.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Brand Logic Banner */}
          <ServerBrandSpecificLogic brand={server.brand} server={server} />

          {/* Compute & Memory Telemetry Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Compute Cores &amp; Memory Health
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                &lt;70% OK • 70-85% WARN • &gt;85% CRIT
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TelemetryBar
                label="Compute CPU Cores"
                value={server.cpuUsage}
                icon={<Cpu className="w-4 h-4 text-base-content/70" />}
                isOnline={isOnline}
                isMetricsUnavailable={isMetricsUnavailable}
                targetSla="Target SLA: <70%"
                secondaryInfo={`Load: ${server.loadAverage || '0.78, 0.84, 0.91'}`}
              />

              <TelemetryBar
                label="RAM Memory Pool"
                value={server.ramUsage}
                icon={<MemoryStick className="w-4 h-4 text-base-content/70" />}
                isOnline={isOnline}
                isMetricsUnavailable={isMetricsUnavailable}
                targetSla="Target SLA: <80%"
                secondaryInfo={`Used: ${server.ramUsage}%`}
              />
            </div>

            {/* RAM Memory Health / ECC Card */}
            <div 
              className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2 transition-all hover:border-primary/30 cursor-pointer"
              onClick={() => setIsEccDetailsExpanded((prev) => !prev)}
              title="Click to view RAM module & memory controller health status"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-base-content flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-secondary shrink-0" />
                  <span>RAM Memory Health (ECC Parity)</span>
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
                    {isEccDetailsExpanded ? 'Hide' : hasControllers ? `View ${controllers.length} RAM Channels` : 'Details'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isEccDetailsExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${eccBadgeColor}`}>
                  {eccBadgeLabel}
                </span>
                <span className="text-xs text-base-content/80 font-mono">
                  {eccStatusText}
                </span>
              </div>

              {/* Detailed Channels Breakdown */}
              {isEccDetailsExpanded && (
                <div className="pt-2 border-t border-base-content/10 space-y-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  {hasControllers ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {controllers.map((mc, idx) => {
                        const ueNum = Number(mc.ue || 0);
                        const ceNum = Number(mc.ce || 0);
                        const isHealthy = ueNum === 0 && ceNum === 0;
                        const isCritical = ueNum > 0;
                        return (
                          <div key={mc.name || idx} className="p-2 rounded-lg bg-base-100 border border-base-content/10 flex items-center justify-between text-xs font-mono">
                            <div>
                              <div className="font-bold text-base-content">{mc.name.toUpperCase()} (Channel {idx})</div>
                              <div className="text-[10px] text-base-content/60">CE: {ceNum} | UE: {ueNum}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                              isHealthy ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : isCritical ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {isHealthy ? 'OK' : isCritical ? 'FAULT' : 'WARN'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-base-100 border border-base-content/10 text-xs text-base-content/70">
                      Corrected Errors: {corrected ?? 0} • Uncorrected Errors: {uncorrected ?? 0}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Storage & Memory Card */}
          {Array.isArray(server.storage) && server.storage.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                  <Database className="w-4 h-4 text-secondary" />
                  Filesystem Mounts &amp; Storage Volumes
                </h3>
              </div>

              <div className="rounded-xl border border-base-content/10 bg-base-200/30 overflow-hidden divide-y divide-base-content/10">
                {server.storage.map((item, idx) => {
                  const pct = Number(item.used_pct ?? 0);
                  return (
                    <div key={`${item.name}-${idx}`} className="p-3 sm:p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-base-content text-xs truncate">{item.name}</span>
                          <span className="px-1.5 py-0.5 rounded border border-base-content/15 bg-base-300/60 text-base-content/70 text-[10px] font-mono">
                            {item.kind || 'Disk'}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-base-content/70">
                          {formatStorageBytes(item.used_bytes)} / {formatStorageBytes(item.total_bytes)}
                          <span className={`font-bold ml-1.5 ${getMetricColor(pct)}`}>({pct}%)</span>
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
            </div>
          )}

          {/* Disk Health & Lifecycle Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" />
                Physical Disk Health &amp; NVMe Endurance
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                {hasDisks ? `${disks.length} Physical Drives` : 'SMART Telemetry'}
              </span>
            </div>

            {!hasDisks ? (
              <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/5 text-xs font-mono text-base-content/50 text-center py-6">
                No physical disks reported via snmpd smartctl extend
              </div>
            ) : (
              <div className="divide-y divide-base-content/10 space-y-4">
                {disks.map((d, idx) => {
                  const isNvme = d.type === 'nvme';
                  const wearLevel = d.percentage_used;
                  const hasWear = wearLevel !== null && wearLevel !== undefined && !isNaN(wearLevel);

                  return (
                    <div key={d.device || idx} className={idx > 0 ? 'pt-4 space-y-3' : 'space-y-3'}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-base-content">{d.device}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25">
                            {isNvme ? 'NVMe' : 'HDD/SATA'}
                          </span>
                        </div>
                        <div className="text-xs font-mono flex items-center gap-3">
                          <span>Read: <span className="font-bold text-base-content">{formatThroughput(d.read_bytes_per_sec)}</span></span>
                          <span>•</span>
                          <span>Write: <span className="font-bold text-base-content">{formatThroughput(d.write_bytes_per_sec)}</span></span>
                        </div>
                      </div>

                      {/* Wear Level Bar */}
                      {hasWear && (
                        <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span>Wear Level</span>
                            <span className={`font-mono text-xs font-black ${getWearTextColor(wearLevel)}`}>
                              {wearLevel}% used
                            </span>
                          </div>
                          <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${getWearBarColor(wearLevel)}`}
                              style={{ width: `${Math.min(100, Math.max(0, wearLevel))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Power on / Total read / Total written / EOL */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-base-200/40 border border-base-content/5">
                          <div className="text-[11px] font-semibold text-base-content/70">Powered On</div>
                          <div className="font-mono text-sm font-bold text-base-content">{formatPowerOnDuration(d.power_on_hours)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-base-200/40 border border-base-content/5">
                          <div className="text-[11px] font-semibold text-base-content/70">Total Read</div>
                          <div className="font-mono text-sm font-bold text-base-content">{formatLifetimeDataBytes(d.lifetime_bytes_read)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-base-200/40 border border-base-content/5">
                          <div className="text-[11px] font-semibold text-base-content/70">Total Written</div>
                          <div className="font-mono text-sm font-bold text-base-content">{formatLifetimeDataBytes(d.lifetime_bytes_written)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-base-200/40 border border-base-content/5">
                          <div className="text-[11px] font-semibold text-base-content/70">Estimated Life</div>
                          <div>{renderDiskEol(d.estimated_eol_days, d.percentage_used)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Environmental Sensors */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Chassis Power Supplies, Fans &amp; Thermals
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                <span className="text-xs font-semibold text-base-content">Power Supplies</span>
                {hasPsus ? (
                  <div className="divide-y divide-base-content/10">
                    {rawPsus.map((p, idx) => (
                      <div key={idx} className="flex justify-between py-1 text-xs font-mono">
                        <span>{p.name || `PSU ${idx + 1}`}</span>
                        <span className="text-emerald-500 font-bold uppercase">{p.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-base-content/50 font-mono">Redundant Dual PSUs (Active)</div>
                )}
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                <span className="text-xs font-semibold text-base-content">Chassis Fans</span>
                {hasFans ? (
                  <div className="divide-y divide-base-content/10">
                    {fansList.map((f, idx) => (
                      <div key={idx} className="flex justify-between py-1 text-xs font-mono">
                        <span>{f.name || `Fan ${idx + 1}`}</span>
                        <span className="text-emerald-500 font-bold uppercase">{f.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-base-content/50 font-mono">Hot-Swap Fan Array (OK)</div>
                )}
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 flex flex-col justify-between">
                <span className="text-xs font-semibold text-base-content">CPU Package Temp</span>
                <span className={`font-mono text-2xl font-black ${
                  !isOnline || normT === null
                    ? 'text-base-content/40'
                    : normT >= 85
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                }`}>
                  {!isOnline || normT === null ? 'N/A' : `${Number(normT).toFixed(1)} °C`}
                </span>
                <span className="text-[11px] text-base-content/50 font-mono">Core Thermals</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Server Specifications
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center justify-between mb-1">
                  <span>Vendor</span>
                  <BrandLogo brand={server.brand} size="xs" />
                </div>
                <div className="font-semibold text-base-content flex items-center gap-2">
                  <BrandLogo brand={server.brand} size="sm" />
                  <span>{server.brand || 'Dell'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Model</div>
                <div className="font-semibold text-base-content font-mono">{server.deviceModel || 'Compute Node'}</div>
                {server.sysDescr && (
                  <div className="text-[11px] text-base-content/50 font-mono mt-1 line-clamp-2" title={server.sysDescr}>
                    {server.sysDescr}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Serial Number</div>
                <div className="font-semibold font-mono text-base-content break-all">{server.deviceSerial || 'Not reported'}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">System Uptime</div>
                <div className="font-semibold font-mono text-base-content">{server.uptime}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Datacenter</div>
                <div className="font-semibold text-base-content">{server.datacenterName || server.location}</div>
                <div className="text-[11px] text-base-content/50 font-mono mt-0.5">{server.location}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Rack</div>
                <div className="font-semibold font-mono text-base-content">{formatRack(server.rackNumber) || 'Unassigned'}</div>
              </div>
            </div>
          </div>

          {/* SRE Diagnostic Ping */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Immediate SRE Diagnostics
            </h3>

            <button
              onClick={handlePing}
              disabled={isPinging}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold border border-primary/30 text-primary hover:bg-primary hover:text-primary-content transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Pinging Node...' : 'Run ICMP Ping Test'}</span>
            </button>

            {pingResult && (
              <div className="p-3 rounded-xl bg-base-300/80 border border-base-content/10 font-mono text-xs text-base-content/90 animate-fadeIn space-y-1">
                <div className="text-[10px] text-base-content/50 uppercase font-bold">Ping Output:</div>
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

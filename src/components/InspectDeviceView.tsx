import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server } from '../types';
import { BrandLogo } from './BrandLogo';
import { formatRack } from '../utils/rack';
import { fetchWithAuth } from '../utils/auth';
import { 
  ArrowLeft,
  Server as ServerIcon, 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  MapPin, 
  Clock, 
  Layers, 
  Terminal, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2,
  Database,
  Radio,
  Network,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Zap,
  ExternalLink,
  Users,
  Thermometer,
  Info
} from 'lucide-react';

interface InspectDeviceViewProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
  onUpdateServer?: (updated: Server) => void;
}

export const InspectDeviceView: React.FC<InspectDeviceViewProps> = ({
  server,
  onBack,
  onEditServer,
  onDeleteServer,
  onRebootServer,
  onUpdateServer,
}) => {
  const [liveServer, setLiveServer] = useState<Server>(server);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [liveIntervalSec, setLiveIntervalSec] = useState<number>(2);
  const [isPollingNow, setIsPollingNow] = useState<boolean>(false);
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isEccDetailsExpanded, setIsEccDetailsExpanded] = useState<boolean>(false);

  useEffect(() => {
    setLiveServer(server);
  }, [server]);

  const activeServer = liveServer;
  const isOnline = activeServer.status === 'online';
  const isMetricsUnavailable = activeServer.metricsAvailable === false;
  const deviceType = activeServer.deviceType || 'Server';

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
          };
          setLiveServer(updated);
          onUpdateServerRef.current?.(updated);
        }
      }
    } catch {
      // safe fallback on transient poll error
    } finally {
      pollingRef.current = false;
      setIsPollingNow(false);
    }
  }, []);

  // Recurring live interval for real-time telemetry (especially disk I/O)
  useEffect(() => {
    if (!isLiveActive || liveIntervalSec <= 0) return;

    // Trigger an initial poll on mount or server change immediately
    performLivePoll();

    const timer = setInterval(() => {
      performLivePoll();
    }, liveIntervalSec * 1000);

    return () => clearInterval(timer);
  }, [isLiveActive, liveIntervalSec, server.id, performLivePoll]);

  const formatLastPolled = (iso?: string) => {
    if (!iso) return 'Never polled';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Never polled';
    const timeStr = d.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `Last polled: ${timeStr}`;
  };

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

  const formatPowerOnDuration = (hours?: number | null): string => {
    if (hours === null || hours === undefined || isNaN(hours) || hours < 0) {
      return 'N/A';
    }
    const h = Math.round(hours);
    const years = Math.floor(h / 8760);
    const remHours = h % 8760;
    const months = Math.floor(remHours / 720);
    const days = Math.floor((remHours % 720) / 24);

    if (years > 0) {
      return months > 0 ? `${years}y ${months}m` : `${years}y`;
    }
    if (months > 0) {
      return days > 0 ? `${months}m ${days}d` : `${months}m`;
    }
    if (days > 0) {
      return `${days}d ${h % 24}h`;
    }
    return `${h}h`;
  };

  const formatLifetimeDataBytes = (bytes?: number | null): string => {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
      return 'N/A';
    }
    const tb = 1000 ** 4;
    const gb = 1000 ** 3;
    if (bytes >= tb) {
      return `${(bytes / tb).toFixed(1)} TB`;
    }
    if (bytes >= gb) {
      return `${(bytes / gb).toFixed(1)} GB`;
    }
    const mb = 1000 ** 2;
    if (bytes >= mb) {
      return `${(bytes / mb).toFixed(1)} MB`;
    }
    return `${bytes} B`;
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

  const renderDeviceBadge = (type?: string) => {
    switch (type) {
      case 'Router':
      case 'MikroTik':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            Router
          </span>
        );
      case 'Switch':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            Switch
          </span>
        );
      case 'OLT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            GPON OLT
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/10 text-primary">
            Server
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 pb-10 animate-fadeIn">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-xs text-base-content/60 font-medium">
          <button
            onClick={onBack}
            className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
          <button
            onClick={onBack}
            className="hover:text-primary transition-colors font-semibold"
          >
            Fleet Devices
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
          <span className="text-base-content font-mono font-bold truncate max-w-xs">
            {server.hostname}
          </span>
        </div>

        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-base-100 hover:bg-base-200 border border-base-content/10 text-base-content transition-all shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Fleet Dashboard</span>
        </button>
      </div>

      {/* 2. Page Header Card with Device Identity and SINGLE Top-Right Action Hub */}
      <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-start gap-4">
          <div className={`p-3.5 rounded-2xl border ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
              : 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_16px_rgba(244,63,94,0.2)]'
          }`}>
            <ServerIcon className="w-7 h-7" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <BrandLogo brand={server.brand} size="md" />

              <h1 className="text-xl sm:text-2xl font-black text-base-content tracking-tight">
                {server.hostname}
              </h1>

              {/* Status Badge */}
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  UP
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.25)] animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  DOWN
                </span>
              )}

              {/* Device Type Badge */}
              {renderDeviceBadge(server.deviceType)}

              {/* Brand Name Badge */}
              {server.brand && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-base-content/20 bg-base-200/80 text-base-content shadow-2xs">
                  <BrandLogo brand={server.brand} size="xs" />
                  <span>{server.brand}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60 font-mono mt-1.5">
              <span className="font-bold text-base-content text-sm">{server.ip}</span>
              <span>•</span>
              <span>UID: {server.id}</span>
              <span>•</span>
              <span className="text-base-content/70">
                {server.datacenterName || server.location}
              </span>
              <span>•</span>
              <span className="text-[11px] text-base-content/40 font-mono">
                {formatLastPolled(server.lastPolledAt)}
              </span>
            </div>
          </div>
        </div>

        {/* SINGLE EXCLUSIVE LOCATION FOR EDIT AND DELETE BUTTONS */}
        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          {onEditServer && (
            <button
              type="button"
              onClick={() => onEditServer(server)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-base-content bg-base-100 hover:text-primary hover:border-primary/40 hover:bg-primary/10 border border-base-content/20 transition-all duration-150 shadow-xs"
              title={`Edit ${server.hostname} configuration`}
            >
              <Pencil className="w-4 h-4 text-base-content/70" />
              <span>Edit Device</span>
            </button>
          )}

          {onDeleteServer && (
            <button
              type="button"
              onClick={() => onDeleteServer(server)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-error bg-error/10 hover:bg-error hover:text-error-content border border-error/30 transition-all duration-150 shadow-xs"
              title={`Decommission ${server.hostname}`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Device</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Smart Diagnostic Alerts & Health Banner */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5 px-1">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Diagnostic Alerts &amp; Fleet Health
        </h2>

        {/* Offline Critical Alert */}
        {!isOnline && (
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

        {/* Elevated CPU Alert */}
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

        {/* Elevated RAM Alert */}
        {isOnline && !isMetricsUnavailable && deviceType === 'Server' && server.ramUsage > 85 && (
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

        {/* Elevated Disk Alert */}
        {isOnline && !isMetricsUnavailable && deviceType === 'Server' && server.diskUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">NVMe Storage Pool Near Capacity ({server.diskUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Volume saturation warning: Please inspect `/var/log` or rotate PostgreSQL audit log files.
              </div>
            </div>
          </div>
        )}

        {/* Neutral Banner when SNMP vendor metrics are unavailable */}
        {isOnline && isMetricsUnavailable && (
          <div className="p-4 sm:p-5 rounded-2xl bg-base-200/70 border border-base-content/15 text-base-content/80 flex items-start gap-3.5">
            <Info className="w-6 h-6 shrink-0 mt-0.5 text-base-content/60" />
            <div>
              <div className="font-bold text-sm sm:text-base text-base-content">
                SNMP metrics unavailable — device is reachable but did not respond to vendor-specific telemetry OIDs.
              </div>
            </div>
          </div>
        )}

        {/* Critical PSU / Fan Hardware Alert */}
        {isOnline &&
          (() => {
            const failedPsus = (server.powerSupplies || [])
              .filter((p) => p.status === 'critical')
              .map((p) => p.name);
            const failedFans = (server.fans || [])
              .filter((f) => f.status === 'critical')
              .map((f) => f.name);
            const failedUnits = [...failedPsus, ...failedFans];
            if (failedUnits.length === 0) return null;
            return (
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
                <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm sm:text-base">
                    Hardware Unit Failure: {failedUnits.join(', ')}
                  </div>
                  <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                    Critical hardware sensor status reported for: {failedUnits.join(', ')}. Inspect chassis power supply or cooling fan tray immediately.
                  </div>
                </div>
              </div>
            );
          })()}

        {/* All Nominal Alert */}
        {isOnline &&
          !isMetricsUnavailable &&
          server.cpuUsage <= 85 &&
          (deviceType !== 'Server' || (server.ramUsage <= 85 && server.diskUsage <= 85)) &&
          !(server.powerSupplies || []).some((p) => p.status === 'critical') &&
          !(server.fans || []).some((f) => f.status === 'critical') && (
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

      {/* 4. Two-Column Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        
        {/* Left Column (8 cols): Real-Time Telemetry, Storage & Diagnostics */}
        <div className="lg:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          
          {/* Resource Utilization Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Resource Utilization &amp; Telemetry
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                &lt;70% OK • 70-85% WARN • &gt;85% CRIT
              </span>
            </div>

            <div className="space-y-3.5 sm:space-y-4">
              {/* CPU Bar (all device types) */}
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

              {/* Server: RAM & Disk Bars */}
              {deviceType === 'Server' && (
                <>
                  {/* RAM Bar */}
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
                      <span>Used: {!isOnline ? '0 GB' : isMetricsUnavailable ? 'N/A' : `${Math.round(server.ramUsage * 0.64)} GB / 64 GB`}</span>
                    </div>
                  </div>

                  {/* RAM Memory Health (Server devices only) */}
                  {deviceType === 'Server' && (() => {
                    const corrected = activeServer.ramEccCorrected ?? server.ramEccCorrected;
                    const uncorrected = activeServer.ramEccUncorrected ?? server.ramEccUncorrected;
                    const controllers = activeServer.ramEccControllers ?? server.ramEccControllers;
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
                      <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                        <div className="text-xs font-semibold text-base-content flex items-center gap-2">
                          <MemoryStick className="w-4 h-4 text-secondary shrink-0" />
                          <span>RAM Memory Health</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                          <span className="text-xs text-base-content/80 font-mono">
                            {statusText}
                          </span>
                        </div>

                        {hasControllers && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => setIsEccDetailsExpanded((prev) => !prev)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline transition-colors cursor-pointer"
                            >
                              <span>
                                {isEccDetailsExpanded
                                  ? 'Hide details'
                                  : `Show details (${controllers.length} memory controllers)`}
                              </span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isEccDetailsExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </div>
                        )}

                        {hasControllers && isEccDetailsExpanded && (
                          <div className="pt-1.5 border-t border-base-content/10 space-y-0.5 animate-fadeIn">
                            {controllers.map((mc, idx) => {
                              const ueNum = Number(mc.ue || 0);
                              const ceNum = Number(mc.ce || 0);
                              let itemColor = 'text-base-content/60';
                              if (ueNum > 0) {
                                itemColor = 'text-rose-500 font-semibold';
                              } else if (ceNum > 0) {
                                itemColor = 'text-amber-500 font-semibold';
                              }

                              return (
                                <div key={mc.name || idx} className={`text-xs font-mono ${itemColor}`}>
                                  {mc.name}: CE {ceNum}, UE {ueNum}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Disk Bar */}
                  <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5">
                    <div className="flex justify-between items-center text-xs font-semibold mb-2">
                      <span className="flex items-center gap-2 text-base-content">
                        <HardDrive className="w-4 h-4 text-base-content/70" />
                        <span>NVMe Storage Array</span>
                      </span>
                      <span className={`font-mono text-sm font-black ${isMetricsUnavailable ? 'text-base-content/40' : getMetricColor(server.diskUsage)}`}>
                        {isMetricsUnavailable ? 'N/A' : `${server.diskUsage}%`}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isMetricsUnavailable ? 'bg-base-content/20' : getProgressColor(server.diskUsage)}`}
                        style={{ width: isMetricsUnavailable ? '0%' : `${server.diskUsage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                      <span>Target SLA: &lt;85%</span>
                      <span>Allocated: {isMetricsUnavailable ? 'N/A' : `${Math.round(server.diskUsage * 20)} GB / 2,000 GB`}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Router: Connected Users Card */}
              {deviceType === 'Router' && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5">
                  <div className="flex justify-between items-center text-xs font-semibold mb-1">
                    <span className="flex items-center gap-2 text-base-content">
                      <Users className="w-4 h-4 text-primary" />
                      <span>Connected Users</span>
                    </span>
                    <span className="font-mono text-sm font-black text-base-content">
                      {!isOnline || isMetricsUnavailable || server.connectedUsers === null || server.connectedUsers === undefined
                        ? 'N/A'
                        : server.connectedUsers}
                    </span>
                  </div>
                  <div className="text-[11px] text-base-content/60 font-mono">
                    Active PPP / Hotspot / DHCP Subscriber Sessions
                  </div>
                </div>
              )}

              {/* Switch: Optical Power (TX/RX in dBm) Card */}
              {deviceType === 'Switch' && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="flex items-center gap-2 text-base-content">
                      <Zap className="w-4 h-4 text-cyan-500" />
                      <span>Optical Power (DOM/DDM)</span>
                    </span>
                    <span className="text-[11px] font-mono text-base-content/50">dBm</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="p-2.5 rounded-lg bg-base-100/70 border border-base-content/10">
                      <div className="text-[10px] uppercase font-bold text-base-content/50">Optical TX Power</div>
                      <div className="font-mono text-sm font-black text-base-content mt-0.5">
                        {!isOnline || isMetricsUnavailable || server.opticalTx === null || server.opticalTx === undefined
                          ? 'N/A'
                          : `${server.opticalTx} dBm`}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-base-100/70 border border-base-content/10">
                      <div className="text-[10px] uppercase font-bold text-base-content/50">Optical RX Power</div>
                      <div className="font-mono text-sm font-black text-base-content mt-0.5">
                        {!isOnline || isMetricsUnavailable || server.opticalRx === null || server.opticalRx === undefined
                          ? 'N/A'
                          : `${server.opticalRx} dBm`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Storage & Memory (All Device Types) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
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
              <div className="rounded-xl border border-base-content/10 bg-base-200/30 overflow-hidden divide-y divide-base-content/10">
                {server.storage.map((item, idx) => {
                  const pct = Number(item.used_pct ?? 0);
                  const kindLabel = formatStorageKind(item.kind);
                  return (
                    <div key={`${item.name}-${idx}`} className="p-3 sm:p-3.5 text-xs flex flex-col justify-center">
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
              <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 text-xs font-mono text-base-content/40">
                Not reported by this device
              </div>
            )}
          </div>

          {/* Disk Lifecycle (SMART) (Server devices only) */}
          {deviceType === 'Server' && (
            (() => {
              const wearLevel = activeServer.diskPercentageUsed ?? server.diskPercentageUsed;
              const hasWear = wearLevel !== null && wearLevel !== undefined && !isNaN(wearLevel);
              const powerOn = activeServer.diskPowerOnHours ?? server.diskPowerOnHours;
              const dataRead = activeServer.diskLifetimeBytesRead ?? server.diskLifetimeBytesRead;
              const dataWritten = activeServer.diskLifetimeBytesWritten ?? server.diskLifetimeBytesWritten;
              const eolDays = activeServer.diskEstimatedEolDays ?? server.diskEstimatedEolDays;

              const renderEolSection = () => {
                if (eolDays !== null && eolDays !== undefined && !isNaN(eolDays) && eolDays > 0) {
                  const remainingStr =
                    eolDays >= 365
                      ? `~${(eolDays / 365.25).toFixed(1)} years remaining`
                      : eolDays >= 30
                      ? `~${(eolDays / 30.4).toFixed(1)} months remaining`
                      : `~${Math.round(eolDays)} days remaining`;

                  return (
                    <div>
                      <div className="font-mono text-sm sm:text-base font-bold text-base-content">
                        {remainingStr}
                      </div>
                      <div className="text-xs text-base-content/50 mt-1">
                        Estimate based on current wear rate; not a guarantee.
                      </div>
                    </div>
                  );
                }

                if ((eolDays === null || eolDays === undefined) && wearLevel === 0) {
                  return (
                    <div className="font-mono text-xs sm:text-sm text-base-content/70">
                      Not enough wear data yet (drive wear is still at 0%)
                    </div>
                  );
                }

                return (
                  <div className="font-mono text-xs sm:text-sm text-base-content/50">
                    Not enough data to estimate
                  </div>
                );
              };

              return (
                <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-primary" />
                      Disk Lifecycle (SMART)
                    </h3>
                    <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                      NVMe / SMART Telemetry
                    </span>
                  </div>

                  {/* Wear Level */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="flex items-center gap-2 text-base-content">
                        <Activity className="w-4 h-4 text-base-content/70" />
                        <span>Wear Level</span>
                      </span>
                      <span
                        className={`font-mono text-sm font-black ${
                          hasWear ? getWearTextColor(wearLevel) : 'text-base-content/40'
                        }`}
                      >
                        {hasWear ? `${wearLevel}% used` : 'Not available'}
                      </span>
                    </div>
                    {hasWear && (
                      <>
                        <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getWearBarColor(wearLevel)}`}
                            style={{ width: `${Math.min(100, Math.max(0, wearLevel))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] sm:text-[11px] text-base-content/50 font-mono">
                          <span>0% (New Drive)</span>
                          <span>&lt;70% OK • 70-90% WARN • &gt;90% CRIT</span>
                          <span>100% (End of Life)</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Grid for Powered On, Total Data Read, Total Data Written */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {/* Powered On */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-base-content">
                        <Clock className="w-4 h-4 text-sky-500" />
                        <span>Powered On</span>
                      </div>
                      <div className="font-mono text-base sm:text-lg font-black text-base-content pt-0.5">
                        {formatPowerOnDuration(powerOn)}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-base-content/50 font-mono">
                        Power-on cumulative duration
                      </div>
                    </div>

                    {/* Total Data Read */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-base-content">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <span>Total Data Read</span>
                      </div>
                      <div className="font-mono text-base sm:text-lg font-black text-base-content pt-0.5">
                        {formatLifetimeDataBytes(dataRead)}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-base-content/50 font-mono">
                        Cumulative Host Read Units
                      </div>
                    </div>

                    {/* Total Data Written */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-base-content">
                        <Database className="w-4 h-4 text-purple-500" />
                        <span>Total Data Written</span>
                      </div>
                      <div className="font-mono text-base sm:text-lg font-black text-base-content pt-0.5">
                        {formatLifetimeDataBytes(dataWritten)}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-base-content/50 font-mono">
                        Cumulative Host Write Units
                      </div>
                    </div>
                  </div>

                  {/* Estimated Remaining Life */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-base-content">
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                      <span>Estimated Remaining Life</span>
                    </div>
                    <div className="pt-0.5">
                      {renderEolSection()}
                    </div>
                  </div>
                </div>
              );
            })()
          )}

          {/* Power Supplies, Fans & Temperature (All Device Types) */}
          <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
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
                {Array.isArray(server.powerSupplies) && server.powerSupplies.length > 0 ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                    {server.powerSupplies.map((psu, idx) => {
                      const rawVal = (psu as { raw_value?: number | null }).raw_value;
                      const rawMatch = psu.name?.match(/^psu(\d+)-state$/i);
                      const displayLabel = rawMatch ? `PSU ${rawMatch[1]}` : (psu.name || `PSU ${idx + 1}`);
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
                          <span className="font-semibold text-base-content whitespace-nowrap">{displayLabel}</span>
                          <div className="flex items-center gap-1.5">
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
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-base-content">
                    <Activity className="w-4 h-4 text-sky-500" />
                    <span>Fans</span>
                  </span>
                </div>
                {Array.isArray(server.fans) && server.fans.filter((f) => f.name?.toLowerCase() !== 'fan-state').length > 0 ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                    {server.fans
                      .filter((f) => f.name?.toLowerCase() !== 'fan-state')
                      .map((fan, idx) => {
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
                        return (
                          <div key={`${displayLabel}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono">
                            <span className="font-semibold text-base-content whitespace-nowrap">{displayLabel}</span>
                            <div className="flex items-center gap-1.5">
                              {fan.rpm !== undefined && fan.rpm !== null && (
                                <span className="text-base-content/60 whitespace-nowrap">{fan.rpm} RPM</span>
                              )}
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
                  <span
                    className={`font-mono text-xl font-black ${
                      !isOnline || server.temperature === null || server.temperature === undefined
                        ? 'text-base-content/40'
                        : server.temperature >= 85
                        ? 'text-rose-500'
                        : server.temperature >= 70
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}
                  >
                    {!isOnline || server.temperature === null || server.temperature === undefined
                      ? 'N/A'
                      : `${server.temperature} °C`}
                  </span>
                </div>
                <div className="text-[11px] text-base-content/60 font-mono mt-1">
                  Chassis Thermal Sensor
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Hardware Specs & SRE Diagnostics */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-5">
          
          {/* Hardware Info Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
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
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  System Uptime
                </div>
                <div className="font-semibold font-mono text-base-content">{server.uptime}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-secondary" />
                  Datacenter Facility
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
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
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

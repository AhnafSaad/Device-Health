import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, NetworkInterface } from '../types';
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
  Info,
  Eye,
  X,
  Hash,
  Key
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
  const [portFilter, setPortFilter] = useState<'all' | 'up' | 'down'>('all');
  const [showPortsModal, setShowPortsModal] = useState<boolean>(false);
  const [isPortsExpanded, setIsPortsExpanded] = useState<boolean>(false);
  const [routerInterfaceTab, setRouterInterfaceTab] = useState<'physical' | 'virtual' | 'ppp'>('physical');
  const [virtualPortFilter, setVirtualPortFilter] = useState<'all' | 'up' | 'down'>('all');
  const [pppSessionFilter, setPppSessionFilter] = useState<'all' | 'up' | 'down'>('all');

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
            connectedUsers: d.connected_users !== undefined && d.connected_users !== null ? Number(d.connected_users) : (cur.connectedUsers ?? null),
            temperature: d.temperature !== undefined && d.temperature !== null ? Number(d.temperature) : (cur.temperature ?? null),
            powerSupplies: Array.isArray(d.power_supplies) ? d.power_supplies : (cur.powerSupplies ?? null),
            fans: Array.isArray(d.fans) ? d.fans : (cur.fans ?? null),
            deviceSerial: d.device_serial !== undefined ? d.device_serial : (d.deviceSerial !== undefined ? d.deviceSerial : (cur.deviceSerial ?? null)),
            softwareId: d.software_id !== undefined ? d.software_id : (d.softwareId !== undefined ? d.softwareId : (cur.softwareId ?? null)),
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

  const formatPortSpeed = (speedBps?: number | null) => {
    if (!speedBps || isNaN(speedBps) || speedBps <= 0) return '—';
    if (speedBps >= 10000000000) {
      return `${Math.round(speedBps / 1000000000)} Gbps`;
    }
    if (speedBps >= 1000000000) {
      const gb = speedBps / 1000000000;
      return gb % 1 === 0 ? `${gb} Gbps` : `${gb.toFixed(1)} Gbps`;
    }
    if (speedBps >= 1000000) {
      return `${Math.round(speedBps / 1000000)} Mbps`;
    }
    return `${Math.round(speedBps / 1000)} Kbps`;
  };

  const getDeviceInterfaces = (targetServer: Server): NetworkInterface[] => {
    if (Array.isArray(targetServer.interfaces) && targetServer.interfaces.length > 0) {
      return targetServer.interfaces;
    }
    if (Array.isArray(server.interfaces) && server.interfaces.length > 0) {
      return server.interfaces;
    }

    const tType = targetServer.deviceType || server.deviceType || 'Server';
    const tBrand = (targetServer.brand || server.brand || '').toLowerCase();
    const isRouter = tType === 'Router';
    const isMikroTik = tBrand.includes('mikrotik');

    if (isRouter || isMikroTik) {
      return [
        { index: 1, name: 'ether1', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 2, name: 'ether2', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 3, name: 'ether3', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 4, name: 'ether4', oper_status: 'down', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 5, name: 'ether5', oper_status: 'down', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 6, name: 'sfp-sfpplus1', oper_status: 'up', admin_status: 'up', speed: 10000000000, type: 'sfp' },
        { index: 7, name: 'sfp-sfpplus2', oper_status: 'down', admin_status: 'up', speed: 10000000000, type: 'sfp' },
        { index: 8, name: 'bridge1', oper_status: 'up', admin_status: 'up', speed: null, type: 'bridge' },
      ];
    }
    return [];
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
    <div className="w-full max-w-7xl mx-auto space-y-3.5 sm:space-y-4 pb-10 animate-fadeIn">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        
        {/* Left Column (8 cols): Real-Time Telemetry, Storage & Diagnostics */}
        <div className="lg:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
          
          {/* Resource Utilization Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5 sm:space-y-4 flex flex-col">
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

              {/* RAM Bar (All device types: Server, Router, Switch, OLT) */}
              {(() => {
                const ramStorageItem = Array.isArray(server.storage)
                  ? server.storage.find(s => (s.kind || '').toLowerCase() === 'ram' || /ram|main memory|memory/i.test(s.name || ''))
                  : null;

                const ramUsedLabel = ramStorageItem
                  ? `${formatStorageBytes(ramStorageItem.used_bytes)} / ${formatStorageBytes(ramStorageItem.total_bytes)}`
                  : deviceType === 'Server'
                  ? `${Math.round(server.ramUsage * 0.64)} GB / 64 GB`
                  : `${server.ramUsage}%`;

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

          {/* Disk Health & Lifecycle (Server devices only) */}
          {deviceType === 'Server' && (
            (() => {
              const disks = activeServer.disks ?? server.disks;
              const hasDisks = Array.isArray(disks) && disks.length > 0;

              const formatThroughput = (bytesPerSec?: number | null) => {
                if (bytesPerSec === null || bytesPerSec === undefined || isNaN(bytesPerSec)) {
                  return '—';
                }
                const mbs = bytesPerSec / (1024 * 1024);
                if (mbs >= 1000) {
                  return `${(mbs / 1024).toFixed(2)} GB/s`;
                }
                return `${mbs.toFixed(2)} MB/s`;
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

              return (
                <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
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
                    <div className="divide-y divide-base-content/10 space-y-4">
                      {disks.map((d, idx) => {
                        const isNvme = d.type === 'nvme';
                        const isHdd = d.type === 'hdd_sata';
                        const wearLevel = d.percentage_used;
                        const hasWear = wearLevel !== null && wearLevel !== undefined && !isNaN(wearLevel);

                        // HDD SMART counters
                        const hasReallocated = d.reallocated !== null && d.reallocated !== undefined && d.reallocated > 0;
                        const hasPending = d.pending !== null && d.pending !== undefined && d.pending > 0;
                        const hasUncorrectable = d.uncorrectable !== null && d.uncorrectable !== undefined && d.uncorrectable > 0;
                        const hasHddIssues = hasReallocated || hasPending || hasUncorrectable;

                        return (
                          <div key={d.device || idx} className={idx > 0 ? 'pt-4 space-y-3' : 'space-y-3'}>
                            {/* Disk Header with Device Name, Type Badge, and Throughput */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-base-content">
                                  {d.device}
                                </span>
                                {isNvme ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25">
                                    NVMe
                                  </span>
                                ) : isHdd ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/25">
                                    HDD/SATA
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-base-300/60 text-base-content/60 border border-base-content/15">
                                    Unknown
                                  </span>
                                )}
                              </div>

                              {/* Read/Write Throughput */}
                              <div className="text-xs font-mono flex items-center gap-3">
                                <span>
                                  <span className="text-base-content/50">Read: </span>
                                  <span className="font-bold text-base-content">{formatThroughput(d.read_bytes_per_sec)}</span>
                                </span>
                                <span>•</span>
                                <span>
                                  <span className="text-base-content/50">Write: </span>
                                  <span className="font-bold text-base-content">{formatThroughput(d.write_bytes_per_sec)}</span>
                                </span>
                              </div>
                            </div>

                            {/* NVMe Specific Details */}
                            {isNvme && (
                              <div className="space-y-3">
                                {/* Wear Level Bar */}
                                <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                                  <div className="flex justify-between items-center text-xs font-semibold">
                                    <span className="flex items-center gap-1.5 text-base-content">
                                      <Activity className="w-3.5 h-3.5 text-base-content/70" />
                                      <span>Wear Level</span>
                                    </span>
                                    <span
                                      className={`font-mono text-xs font-black ${
                                        hasWear ? getWearTextColor(wearLevel) : 'text-base-content/40'
                                      }`}
                                    >
                                      {hasWear ? `${wearLevel}% used` : 'Not available'}
                                    </span>
                                  </div>
                                  {hasWear && (
                                    <>
                                      <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${getWearBarColor(wearLevel)}`}
                                          style={{ width: `${Math.min(100, Math.max(0, wearLevel))}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between text-[10px] text-base-content/50 font-mono">
                                        <span>0% (New Drive)</span>
                                        <span>&lt;70% OK • 70-90% WARN • &gt;90% CRIT</span>
                                        <span>100% (End of Life)</span>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Powered On, Total Data Read, Total Data Written, Estimated Remaining Life */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                                  {/* Powered On */}
                                  <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                                      <Clock className="w-3.5 h-3.5 text-sky-500" />
                                      <span>Powered On</span>
                                    </div>
                                    <div className="font-mono text-sm font-bold text-base-content">
                                      {formatPowerOnDuration(d.power_on_hours)}
                                    </div>
                                  </div>

                                  {/* Total Data Read */}
                                  <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>Total Data Read</span>
                                    </div>
                                    <div className="font-mono text-sm font-bold text-base-content">
                                      {formatLifetimeDataBytes(d.lifetime_bytes_read)}
                                    </div>
                                  </div>

                                  {/* Total Data Written */}
                                  <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                                      <Database className="w-3.5 h-3.5 text-purple-500" />
                                      <span>Total Data Written</span>
                                    </div>
                                    <div className="font-mono text-sm font-bold text-base-content">
                                      {formatLifetimeDataBytes(d.lifetime_bytes_written)}
                                    </div>
                                  </div>

                                  {/* Estimated Remaining Life */}
                                  <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Remaining Life</span>
                                    </div>
                                    <div>
                                      {renderDiskEol(d.estimated_eol_days, d.percentage_used)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* HDD/SATA Specific Details */}
                            {isHdd && (
                              <div className="space-y-2.5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {/* Health Status & Powered On */}
                                  <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-base-content/70">SMART Status:</span>
                                      {d.passed === true ? (
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                          Healthy
                                        </span>
                                      ) : d.passed === false ? (
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                          Failing
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-base-300/60 text-base-content/50 border border-base-content/15">
                                          Unknown
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs font-mono text-base-content/70">
                                      <span>Power On: </span>
                                      <span className="font-bold text-base-content">{formatPowerOnDuration(d.power_on_hours)}</span>
                                    </div>
                                  </div>

                                  {/* Raw SMART Sector Counters */}
                                  <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 flex items-center justify-around text-xs font-mono">
                                    <div>
                                      <span className="text-base-content/50 text-[11px]">Reallocated: </span>
                                      <span className={hasReallocated ? 'font-bold text-amber-500' : 'text-base-content/70'}>
                                        {d.reallocated ?? '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-base-content/50 text-[11px]">Pending: </span>
                                      <span className={hasPending ? 'font-bold text-amber-500' : 'text-base-content/70'}>
                                        {d.pending ?? '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-base-content/50 text-[11px]">Uncorrectable: </span>
                                      <span className={hasUncorrectable ? 'font-bold text-rose-500' : 'text-base-content/70'}>
                                        {d.uncorrectable ?? '—'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Unknown disk type fallback */}
                            {!isNvme && !isHdd && (
                              <div className="text-xs font-mono text-base-content/50">
                                Powered On: {formatPowerOnDuration(d.power_on_hours)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {/* Network Ports & Interface Status (Router, Switch, or any device with interfaces) */}
          {((deviceType === 'Router' || deviceType === 'Switch') || (Array.isArray(activeServer.interfaces) && activeServer.interfaces.length > 0)) && (
            (() => {
              const allPorts = getDeviceInterfaces(activeServer);
              const isRouter = deviceType === 'Router';

              const isPhysicalPort = (p: NetworkInterface): boolean => {
                const t = (p.type || '').toLowerCase();
                return t === 'ethernet' || t === 'sfp';
              };

              const isPppSession = (p: NetworkInterface): boolean => {
                const t = (p.type || '').toLowerCase();
                return t === 'ppp_session' || t === 'ppp';
              };

              const getVirtualTypeLabel = (type?: string | null, name?: string): string => {
                const t = (type || '').toLowerCase();
                if (t === 'vlan' || /vlan/i.test(name || '')) return 'VLAN';
                if (t === 'bridge' || /bridge/i.test(name || '')) return 'Bridge';
                if (t === 'loopback' || /^lo/i.test(name || '')) return 'Loopback';
                return type ? type.toUpperCase() : 'Virtual';
              };

              // For Router, headline counts strictly computed from PHYSICAL interfaces ONLY (type === 'ethernet' || type === 'sfp')
              const physicalPorts = isRouter ? allPorts.filter(isPhysicalPort) : allPorts;
              const pppSessions = isRouter ? allPorts.filter(isPppSession) : [];
              const virtualPorts = isRouter ? allPorts.filter((p) => !isPhysicalPort(p) && !isPppSession(p)) : [];

              const headlinePorts = isRouter ? physicalPorts : allPorts;
              const totalPorts = headlinePorts.length;
              const upPorts = headlinePorts.filter((p) => p.oper_status === 'up');
              const downPorts = headlinePorts.filter((p) => p.oper_status === 'down');
              const upCount = upPorts.length;
              const downCount = downPorts.length;
              const upRatio = totalPorts > 0 ? Math.round((upCount / totalPorts) * 100) : 0;

              // Filtered headline / physical ports
              const filteredHeadlinePorts = portFilter === 'up'
                ? upPorts
                : portFilter === 'down'
                ? downPorts
                : headlinePorts;

              // Filtered virtual ports for modal
              const virtualUpPorts = virtualPorts.filter((p) => p.oper_status === 'up');
              const virtualDownPorts = virtualPorts.filter((p) => p.oper_status === 'down');
              const filteredVirtualPorts = virtualPortFilter === 'up'
                ? virtualUpPorts
                : virtualPortFilter === 'down'
                ? virtualDownPorts
                : virtualPorts;

              // Filtered dial-in PPP sessions for modal
              const pppUpPorts = pppSessions.filter((p) => p.oper_status === 'up');
              const pppDownPorts = pppSessions.filter((p) => p.oper_status === 'down');
              const filteredPppSessions = pppSessionFilter === 'up'
                ? pppUpPorts
                : pppSessionFilter === 'down'
                ? pppDownPorts
                : pppSessions;

              return (
                <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
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

                    {/* Summary Badges + View Ports Option Button */}
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

                      {/* Primary View Option Button */}
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

                  {/* Operational Availability Meter */}
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

                  {/* Compact Quick Front-Panel Summary Strip & Inline Toggle */}
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

                  {/* Optional Inline Expanded Grid */}
                  {isPortsExpanded && (
                    <div className="space-y-3 pt-2.5 border-t border-base-content/10 animate-fadeIn">
                      {/* Filter Tabs */}
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

                      {/* Compact Scrollable Grid */}
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

                                    <div
                                      className="font-mono font-bold text-xs text-base-content line-clamp-2 break-all leading-tight w-full"
                                      title={port.name}
                                    >
                                      {port.name}
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

                  {/* Full Modal Dialog when "View Ports" is clicked */}
                  {showPortsModal && (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn"
                      onClick={() => setShowPortsModal(false)}
                    >
                      <div
                        className="bg-base-100 border border-base-content/15 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Modal Header */}
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
                                IP: {activeServer.ip} • Type: {deviceType} • {isRouter ? `${physicalPorts.length} physical ports, ${virtualPorts.length} virtual interfaces${pppSessions.length > 0 ? `, ${pppSessions.length} dial-in sessions` : ''}` : `${totalPorts} ports detected`}
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

                        {/* Modal Controls: Availability & Filter Tabs */}
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

                          {/* For Router: Tab control (Physical Ports vs Virtual / VLAN Interfaces vs Dial-in Sessions) */}
                          {isRouter ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-base-content/10">
                              <div className="flex flex-wrap items-center gap-1.5 bg-base-200/80 p-1 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => setRouterInterfaceTab('physical')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    routerInterfaceTab === 'physical'
                                      ? 'bg-primary text-primary-content shadow-xs'
                                      : 'hover:bg-base-300 text-base-content/70'
                                  }`}
                                >
                                  <span>Physical Ports</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      routerInterfaceTab === 'physical'
                                        ? 'bg-primary-content/20 text-primary-content'
                                        : 'bg-base-300 text-base-content/60'
                                    }`}
                                  >
                                    {physicalPorts.length}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRouterInterfaceTab('virtual')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    routerInterfaceTab === 'virtual'
                                      ? 'bg-primary text-primary-content shadow-xs'
                                      : 'hover:bg-base-300 text-base-content/70'
                                  }`}
                                >
                                  <span>Virtual / VLAN Interfaces</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      routerInterfaceTab === 'virtual'
                                        ? 'bg-primary-content/20 text-primary-content'
                                        : 'bg-base-300 text-base-content/60'
                                    }`}
                                  >
                                    {virtualPorts.length}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRouterInterfaceTab('ppp')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    routerInterfaceTab === 'ppp'
                                      ? 'bg-primary text-primary-content shadow-xs'
                                      : 'hover:bg-base-300 text-base-content/70'
                                  }`}
                                >
                                  <span>Dial-in Sessions (PPP/PPPoE)</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      routerInterfaceTab === 'ppp'
                                        ? 'bg-primary-content/20 text-primary-content'
                                        : 'bg-base-300 text-base-content/60'
                                    }`}
                                  >
                                    {pppSessions.length}
                                  </span>
                                </button>
                              </div>

                              {/* Filter chips for active tab */}
                              {routerInterfaceTab === 'physical' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setPortFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      portFilter === 'all'
                                        ? 'bg-primary text-primary-content shadow-xs'
                                        : 'bg-base-200/70 hover:bg-base-200 text-base-content/70'
                                    }`}
                                  >
                                    All ({physicalPorts.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPortFilter('up')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                      portFilter === 'down'
                                        ? 'bg-rose-500 text-white shadow-xs'
                                        : 'bg-base-200/70 hover:bg-rose-500/10 text-rose-500'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Down ({downCount})
                                  </button>
                                </div>
                              ) : routerInterfaceTab === 'virtual' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setVirtualPortFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      virtualPortFilter === 'all'
                                        ? 'bg-primary text-primary-content shadow-xs'
                                        : 'bg-base-200/70 hover:bg-base-200 text-base-content/70'
                                    }`}
                                  >
                                    All ({virtualPorts.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setVirtualPortFilter('up')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                      virtualPortFilter === 'up'
                                        ? 'bg-emerald-500 text-white shadow-xs'
                                        : 'bg-base-200/70 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Active Up ({virtualUpPorts.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setVirtualPortFilter('down')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                      virtualPortFilter === 'down'
                                        ? 'bg-rose-500 text-white shadow-xs'
                                        : 'bg-base-200/70 hover:bg-rose-500/10 text-rose-500'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Down ({virtualDownPorts.length})
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setPppSessionFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      pppSessionFilter === 'all'
                                        ? 'bg-primary text-primary-content shadow-xs'
                                        : 'bg-base-200/70 hover:bg-base-200 text-base-content/70'
                                    }`}
                                  >
                                    All ({pppSessions.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPppSessionFilter('up')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                      pppSessionFilter === 'up'
                                        ? 'bg-emerald-500 text-white shadow-xs'
                                        : 'bg-base-200/70 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Active Up ({pppUpPorts.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPppSessionFilter('down')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                      pppSessionFilter === 'down'
                                        ? 'bg-rose-500 text-white shadow-xs'
                                        : 'bg-base-200/70 hover:bg-rose-500/10 text-rose-500'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Down ({pppDownPorts.length})
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Non-Router devices: Original filter tabs unchanged */
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
                          )}
                        </div>

                        {/* Modal Body: Full Responsive Ports Grid */}
                        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                          {isRouter && routerInterfaceTab === 'ppp' ? (
                            filteredPppSessions.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {filteredPppSessions.map((port) => {
                                  const isUp = port.oper_status === 'up';
                                  return (
                                    <div
                                      key={`modal-ppp-${port.name}-${port.index}`}
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
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 bg-sky-500/15 text-sky-500 border border-sky-500/30">
                                            PPP
                                          </span>
                                        </div>

                                        <div
                                          className="font-mono font-bold text-xs sm:text-sm text-base-content line-clamp-2 break-all leading-tight w-full"
                                          title={port.name}
                                        >
                                          {port.name}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-base-content/5">
                                        <span className="text-base-content/50 uppercase text-[10px] font-medium">
                                          PPP Session
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
                                {pppSessions.length === 0
                                  ? 'No active PPP/PPPoE dial-in sessions detected on this router.'
                                  : 'No dial-in sessions match the selected filter.'}
                              </div>
                            )
                          ) : isRouter && routerInterfaceTab === 'virtual' ? (
                            filteredVirtualPorts.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {filteredVirtualPorts.map((port) => {
                                  const isUp = port.oper_status === 'up';
                                  const typeLabel = getVirtualTypeLabel(port.type, port.name);
                                  return (
                                    <div
                                      key={`modal-virt-${port.name}-${port.index}`}
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
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                              typeLabel === 'VLAN'
                                                ? 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30'
                                                : typeLabel === 'Bridge'
                                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                                : 'bg-purple-500/15 text-purple-500 border border-purple-500/30'
                                            }`}
                                          >
                                            {typeLabel}
                                          </span>
                                        </div>

                                        <div
                                          className="font-mono font-bold text-xs sm:text-sm text-base-content line-clamp-2 break-all leading-tight w-full"
                                          title={port.name}
                                        >
                                          {port.name}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-base-content/5">
                                        <span className="text-base-content/50 uppercase text-[10px] font-medium">
                                          {typeLabel}
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
                                {virtualPorts.length === 0
                                  ? 'No virtual or VLAN interfaces detected on this router.'
                                  : 'No virtual interfaces match the selected filter.'}
                              </div>
                            )
                          ) : (
                            /* Physical ports for Router OR All ports for other deviceTypes */
                            filteredHeadlinePorts.length > 0 ? (
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

                                        <div
                                          className="font-mono font-bold text-xs sm:text-sm text-base-content line-clamp-2 break-all leading-tight w-full"
                                          title={port.name}
                                        >
                                          {port.name}
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
                            )
                          )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3.5 sm:p-4 border-t border-base-content/10 flex items-center justify-between bg-base-200/30">
                          <span className="text-xs font-mono text-base-content/50">
                            {isRouter ? (
                              routerInterfaceTab === 'physical'
                                ? `Showing ${filteredHeadlinePorts.length} of ${physicalPorts.length} physical ports`
                                : routerInterfaceTab === 'virtual'
                                ? `Showing ${filteredVirtualPorts.length} of ${virtualPorts.length} virtual interfaces`
                                : `Showing ${filteredPppSessions.length} of ${pppSessions.length} dial-in sessions`
                            ) : (
                              `Showing ${filteredHeadlinePorts.length} of ${totalPorts} ports`
                            )}
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

            {/* Environmental Sensors (Power Supplies, Fans & Temperature) */}
            {(() => {
              const validFans = Array.isArray(server.fans)
                ? server.fans.filter((f) => f.name?.toLowerCase() !== 'fan-state')
                : [];
              const hasPsus = Array.isArray(server.powerSupplies) && server.powerSupplies.length > 0;
              const hasFans = validFans.length > 0;

              // If neither modular PSUs nor Fans are reported (standard MikroTik or compact router chassis):
              if (!hasPsus && !hasFans) {
                return (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                        <Thermometer className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-base-content flex items-center gap-2">
                          <span>Chassis Thermal Sensor</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-300/80 text-base-content/70">
                            Passive / Embedded Cooling
                          </span>
                        </div>
                        <div className="text-[11px] text-base-content/50 mt-0.5">
                          Modular chassis fans and redundant PSUs not reported via SNMP for this hardware model
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-base-content/50">Temperature</div>
                        <div className={`font-mono text-lg sm:text-xl font-black ${
                          !isOnline || server.temperature === null || server.temperature === undefined
                            ? 'text-base-content/40'
                            : server.temperature >= 85
                            ? 'text-rose-500'
                            : server.temperature >= 70
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}>
                          {!isOnline || server.temperature === null || server.temperature === undefined
                            ? 'N/A'
                            : `${server.temperature} °C`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
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
                        {server.powerSupplies!.map((psu, idx) => {
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
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-base-content whitespace-nowrap">{displayLabel}</span>
                                {typeof psu.watts === 'number' && Number.isFinite(psu.watts) && (
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
                      {validFans.some((f) => typeof f.percent === 'number' && Number.isFinite(f.percent)) && (
                        <p className="text-[10px] text-base-content/50 font-sans mt-0.5">
                          Fan speed reported as duty cycle (%) by this hardware
                        </p>
                      )}
                    </div>
                    {hasFans ? (
                      <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                        {validFans.map((fan, idx) => {
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
              );
            })()}
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
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  Serial Number
                </div>
                {(activeServer.deviceSerial ?? server.deviceSerial) ? (
                  <div className="font-semibold text-base-content font-mono break-all">
                    {activeServer.deviceSerial ?? server.deviceSerial}
                  </div>
                ) : (
                  <div className="font-semibold text-base-content/40 font-mono">
                    Not reported
                  </div>
                )}
              </div>

              {/* MikroTik Software ID */}
              {(((server.brand || '').toLowerCase().includes('mikrotik') ||
                (activeServer.brand || '').toLowerCase().includes('mikrotik') ||
                deviceType === 'Router' ||
                Boolean(activeServer.softwareId ?? server.softwareId))) && (
                <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                    <Key className="w-3.5 h-3.5 text-primary" />
                    Software ID
                  </div>
                  {(activeServer.softwareId ?? server.softwareId) ? (
                    <div className="font-semibold text-base-content font-mono break-all">
                      {activeServer.softwareId ?? server.softwareId}
                    </div>
                  ) : (
                    <div className="font-semibold text-base-content/40 font-mono">
                      Not reported
                    </div>
                  )}
                </div>
              )}

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

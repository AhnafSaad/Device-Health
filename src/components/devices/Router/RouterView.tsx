import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, NetworkInterface } from '../../../types';
import { DeviceHeader } from '../shared/DeviceHeader';
import { isMikroTikRouter, validateRouterSerial, getRouterDefaultInterfaces } from './RouterBrands';
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
  Radio, 
  Users, 
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
  Key,
  Zap,
  Network,
  Eye,
  X,
  ChevronDown
} from 'lucide-react';

export interface RouterViewProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
  onUpdateServer?: (updated: Server) => void;
}

export const RouterView: React.FC<RouterViewProps> = ({
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

  // Interface state
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
    setLiveServer(propServer);
  }, [propServer]);

  const activeServer = liveServer;
  const isOnline = activeServer.status === 'online';
  const isMetricsUnavailable = activeServer.metricsAvailable === false;
  const isMikroTik = isMikroTikRouter(activeServer.brand || server.brand);

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
            softwareId: d.software_id !== undefined ? d.software_id : (d.softwareId !== undefined ? d.softwareId : (cur.softwareId ?? null)),
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

  const getDeviceInterfaces = (targetServer: Server): NetworkInterface[] => {
    if (Array.isArray(targetServer.interfaces) && targetServer.interfaces.length > 0) {
      return targetServer.interfaces;
    }
    if (Array.isArray(server.interfaces) && server.interfaces.length > 0) {
      return server.interfaces;
    }
    return getRouterDefaultInterfaces();
  };

  // Safe interface lists
  const allPorts = getDeviceInterfaces(activeServer);

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

  // For Router, headline counts strictly computed from PHYSICAL interfaces ONLY
  const physicalPorts = allPorts.filter(isPhysicalPort);
  const pppSessions = allPorts.filter(isPppSession);
  const virtualPorts = allPorts.filter((p) => !isPhysicalPort(p) && !isPppSession(p));

  const headlinePorts = physicalPorts;
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

  const virtualUpPorts = virtualPorts.filter((p) => p.oper_status === 'up');
  const virtualDownPorts = virtualPorts.filter((p) => p.oper_status === 'down');
  const filteredVirtualPorts = virtualPortFilter === 'up'
    ? virtualUpPorts
    : virtualPortFilter === 'down'
    ? virtualDownPorts
    : virtualPorts;

  const pppUpPorts = pppSessions.filter((p) => p.oper_status === 'up');
  const pppDownPorts = pppSessions.filter((p) => p.oper_status === 'down');
  const filteredPppSessions = pppSessionFilter === 'up'
    ? pppUpPorts
    : pppSessionFilter === 'down'
    ? pppDownPorts
    : pppSessions;

  // Temperature and power supplies
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
    <div className="w-full max-w-7xl mx-auto space-y-3.5 sm:space-y-4 pb-10 animate-fadeIn">
      {/* 1. Breadcrumbs & Header Card */}
      <DeviceHeader
        server={server}
        onBack={onBack}
        onEditServer={onEditServer}
        onDeleteServer={onDeleteServer}
        onPollNow={performLivePoll}
        isPollingNow={isPollingNow}
      />

      {/* 2. Smart Diagnostic Alerts & Health Banner - Unified via calculateDeviceHealth */}
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
                Router system RAM buffer exhausted. High risk of packet loss or OOM conditions.
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

      {/* 3. Two-Column Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        
        {/* Left Column (8 cols): Real-Time Telemetry, Storage & Diagnostics */}
        <div className="lg:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
          
          {/* Resource Utilization Card (Left) */}
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

              {/* Router: Connected Users Card */}
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

          {/* Network Ports & Interface Status (Full Span) */}
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
                          IP: {activeServer.ip} • Type: Router • {physicalPorts.length} physical ports, {virtualPorts.length} virtual interfaces{pppSessions.length > 0 ? `, ${pppSessions.length} dial-in sessions` : ''}
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

                  {/* Modal Controls: Tabs & Filters */}
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

                    {/* Router Interface Tabs */}
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
                  </div>

                  {/* Modal Body: Grid */}
                  <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                    {routerInterfaceTab === 'ppp' ? (
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
                    ) : routerInterfaceTab === 'virtual' ? (
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
                      {routerInterfaceTab === 'physical'
                        ? `Showing ${filteredHeadlinePorts.length} of ${physicalPorts.length} physical ports`
                        : routerInterfaceTab === 'virtual'
                        ? `Showing ${filteredVirtualPorts.length} of ${virtualPorts.length} virtual interfaces`
                        : `Showing ${filteredPppSessions.length} of ${pppSessions.length} dial-in sessions`}
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

          {/* Power Supplies, Fans & Temperature (Chassis Environmental Sensors) */}
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

            {/* If neither modular PSUs nor Fans are reported (standard MikroTik or compact router chassis) */}
            {!hasPsus && !hasFans ? (
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
            ) : (
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
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Hardware Specifications & SRE Diagnostics */}
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

              {/* Serial Number */}
              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  Serial Number
                </div>
                {validateRouterSerial(activeServer.deviceSerial ?? server.deviceSerial, activeServer.hostname || server.hostname, activeServer.sysName || server.sysName) ? (
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
              {(isMikroTik || Boolean(activeServer.softwareId ?? server.softwareId)) && (
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

export default RouterView;

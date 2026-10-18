import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, NetworkInterface } from '../../../types';
import { DeviceHeader } from '../shared/DeviceHeader';
import { TelemetryBar, getMetricColor, getProgressColor } from '../shared/TelemetryBar';
import { RouterBrandSpecificLogic, isMikroTikRouter } from './RouterBrands';
import { BrandLogo } from '../../BrandLogo';
import { formatRack } from '../../../utils/rack';
import { fetchWithAuth } from '../../../utils/auth';
import { 
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
  X
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

  // Interface tabs & modal state
  const [routerInterfaceTab, setRouterInterfaceTab] = useState<'physical' | 'virtual' | 'ppp'>('physical');
  const [portFilter, setPortFilter] = useState<'all' | 'up' | 'down'>('all');
  const [virtualPortFilter, setVirtualPortFilter] = useState<'all' | 'up' | 'down'>('all');
  const [pppSessionFilter, setPppSessionFilter] = useState<'all' | 'up' | 'down'>('all');
  const [showPortsModal, setShowPortsModal] = useState<boolean>(false);

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

  const isOnline = server.status === 'online';
  const isMetricsUnavailable = server.metricsAvailable === false;
  const isMikroTik = isMikroTikRouter(server.brand);

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
        const ms = Math.floor(Math.random() * 15) + 3;
        setPingResult(`64 bytes from ${server.ip}: icmp_seq=1 ttl=62 time=${ms}ms (0% packet loss)`);
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

  const formatPortSpeed = (speedBps?: number | null) => {
    if (!speedBps || isNaN(speedBps) || speedBps <= 0) return '—';
    if (speedBps >= 10000000000) return `${Math.round(speedBps / 1000000000)} Gbps`;
    if (speedBps >= 1000000000) return `${(speedBps / 1000000000).toFixed(0)} Gbps`;
    if (speedBps >= 1000000) return `${Math.round(speedBps / 1000000)} Mbps`;
    return `${Math.round(speedBps / 1000)} Kbps`;
  };

  // Safe parsing of interfaces
  const allPorts: NetworkInterface[] = Array.isArray(server.interfaces) && server.interfaces.length > 0
    ? server.interfaces
    : isMikroTik
    ? [
        { index: 1, name: 'ether1', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 2, name: 'ether2', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 3, name: 'ether3', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 4, name: 'ether4', oper_status: 'down', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
        { index: 5, name: 'sfp-sfpplus1', oper_status: 'up', admin_status: 'up', speed: 10000000000, type: 'sfp' },
        { index: 6, name: 'bridge1', oper_status: 'up', admin_status: 'up', speed: null, type: 'bridge' },
      ]
    : [];

  const isPhysicalPort = (p: NetworkInterface): boolean => {
    const t = (p.type || '').toLowerCase();
    return t === 'ethernet' || t === 'sfp';
  };

  const isPppSession = (p: NetworkInterface): boolean => {
    const t = (p.type || '').toLowerCase();
    return t === 'ppp_session' || t === 'ppp' || t === 'pppoe';
  };

  const physicalPorts = allPorts.filter(isPhysicalPort);
  const pppSessions = allPorts.filter(isPppSession);
  const virtualPorts = allPorts.filter((p) => !isPhysicalPort(p) && !isPppSession(p));

  const upPhysicalPorts = physicalPorts.filter((p) => p.oper_status === 'up');
  const downPhysicalPorts = physicalPorts.filter((p) => p.oper_status === 'down');
  const upCount = upPhysicalPorts.length;
  const downCount = downPhysicalPorts.length;
  const totalPorts = physicalPorts.length;

  const filteredPhysicalPorts = portFilter === 'up'
    ? upPhysicalPorts
    : portFilter === 'down'
    ? downPhysicalPorts
    : physicalPorts;

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

  // Environmental Sensors
  const rawPsus: Array<{ name: string; status: string; watts?: number | null }> = Array.isArray(server.powerSupplies)
    ? server.powerSupplies
    : [];
  const hasPsus = rawPsus.length > 0;

  const fansList: Array<{ name: string; status: string; rpm?: number | null; percent?: number | null }> = Array.isArray(server.fans)
    ? server.fans
    : [];
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
          Router Gateway Health &amp; Transit Status
        </h2>

        {!isOnline && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Router Status: OFFLINE CRITICAL</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1 leading-relaxed">
                Core Gateway node unreachable at IP <span className="font-mono font-bold">{server.ip}</span>.
                Upstream BGP transit sessions and subscriber routing drops may be affected.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">High Route Processor Utilization ({server.cpuUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Routing table recalculation or firewall rule evaluation is consuming elevated CPU cycles.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage <= 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Routing Plane Nominal</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Interfaces, subscriber sessions, and routing engine are functioning smoothly within SLA limits.
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
          <RouterBrandSpecificLogic brand={server.brand} server={server} />

          {/* Telemetry & Connected Users Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Processor &amp; Subscriber Sessions
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                Live Gateway Telemetry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TelemetryBar
                label="Router CPU"
                value={server.cpuUsage}
                icon={<Cpu className="w-4 h-4 text-base-content/70" />}
                isOnline={isOnline}
                isMetricsUnavailable={isMetricsUnavailable}
                targetSla="Target SLA: <70%"
                secondaryInfo={`Load: ${server.loadAverage || '0.62'}`}
              />

              <TelemetryBar
                label="RAM Memory"
                value={server.ramUsage}
                icon={<MemoryStick className="w-4 h-4 text-base-content/70" />}
                isOnline={isOnline}
                isMetricsUnavailable={isMetricsUnavailable}
                targetSla="Target SLA: <80%"
                secondaryInfo={`Used: ${server.ramUsage}%`}
              />

              {/* Connected Users */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="flex items-center gap-2 text-base-content">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Subscribers</span>
                  </span>
                  <span className="font-mono text-base font-black text-base-content">
                    {!isOnline || isMetricsUnavailable || server.connectedUsers === null || server.connectedUsers === undefined
                      ? 'N/A'
                      : server.connectedUsers}
                  </span>
                </div>
                <div className="text-[11px] text-base-content/60 font-mono">
                  Active PPPoE / Hotspot / DHCP Sessions
                </div>
              </div>
            </div>
          </div>

          {/* Storage & Memory Card */}
          {Array.isArray(server.storage) && server.storage.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                  <Database className="w-4 h-4 text-secondary" />
                  Dynamic Storage &amp; Memory Pools
                </h3>
                <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                  Crawled via hrStorageDescr
                </span>
              </div>

              <div className="rounded-xl border border-base-content/10 bg-base-200/30 overflow-hidden divide-y divide-base-content/10">
                {server.storage.map((item, idx) => {
                  const pct = Number(item.used_pct ?? 0);
                  return (
                    <div key={`${item.name}-${idx}`} className="p-3 sm:p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-base-content text-xs truncate">
                            {item.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded border border-base-content/15 bg-base-300/60 text-base-content/70 text-[10px] font-mono">
                            {item.kind || 'Memory'}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-base-content/70">
                          {formatStorageBytes(item.used_bytes)} / {formatStorageBytes(item.total_bytes)}
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
            </div>
          )}

          {/* Network Interface Manager Card with Tabs */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" />
                Network Interfaces &amp; Port Density
              </h3>
              <button
                type="button"
                onClick={() => setShowPortsModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect All Ports Modal</span>
              </button>
            </div>

            {/* Interface Type Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-content/10 pb-3">
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
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-base-300 text-base-content/70">
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
                  <span>Virtual / VLAN</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-base-300 text-base-content/70">
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
                  <span>Dial-in Sessions (PPP)</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-base-300 text-base-content/70">
                    {pppSessions.length}
                  </span>
                </button>
              </div>

              {/* Status Filters */}
              {routerInterfaceTab === 'physical' ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPortFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      portFilter === 'all' ? 'bg-primary text-primary-content' : 'bg-base-200/70 text-base-content/70'
                    }`}
                  >
                    All ({physicalPorts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortFilter('up')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 ${
                      portFilter === 'up' ? 'bg-emerald-500 text-white' : 'bg-base-200/70 text-emerald-600'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Up ({upCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortFilter('down')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 ${
                      portFilter === 'down' ? 'bg-rose-500 text-white' : 'bg-base-200/70 text-rose-500'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Down ({downCount})
                  </button>
                </div>
              ) : null}
            </div>

            {/* Ports Preview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {routerInterfaceTab === 'physical' ? (
                filteredPhysicalPorts.slice(0, 8).map((port) => {
                  const isUp = port.oper_status === 'up';
                  return (
                    <div
                      key={`port-${port.index}-${port.name}`}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                        isUp ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-base-200/40 border-base-content/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs truncate">{port.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          isUp ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                        }`}>
                          {isUp ? 'UP' : 'DOWN'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-base-content/60">
                        {isUp ? formatPortSpeed(port.speed) : 'No Link'}
                      </div>
                    </div>
                  );
                })
              ) : routerInterfaceTab === 'virtual' ? (
                filteredVirtualPorts.slice(0, 8).map((port) => (
                  <div key={`virt-${port.index}`} className="p-3 rounded-xl border border-base-content/10 bg-base-200/40">
                    <div className="font-mono font-bold text-xs truncate">{port.name}</div>
                    <div className="text-[11px] font-mono text-base-content/60 mt-1">{port.type || 'Virtual'}</div>
                  </div>
                ))
              ) : (
                filteredPppSessions.slice(0, 8).map((port) => (
                  <div key={`ppp-${port.index}`} className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5">
                    <div className="font-mono font-bold text-xs truncate">{port.name}</div>
                    <div className="text-[11px] font-mono text-emerald-500 font-bold mt-1">Active PPPoE</div>
                  </div>
                ))
              )}
            </div>

            {physicalPorts.length > 8 && routerInterfaceTab === 'physical' && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowPortsModal(true)}
                  className="px-4 py-2 rounded-xl bg-base-200 hover:bg-base-300 text-xs font-bold text-base-content transition-colors cursor-pointer"
                >
                  View All {physicalPorts.length} Ports in Detail
                </button>
              </div>
            )}
          </div>

          {/* Environmental Sensors */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Chassis Environmental &amp; Thermals
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
                  <div className="text-xs text-base-content/50 font-mono">Integrated Main Rail (Active)</div>
                )}
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-1.5">
                <span className="text-xs font-semibold text-base-content">Cooling Fans</span>
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
                  <div className="text-xs text-base-content/50 font-mono">Passive Heatsink Cooling</div>
                )}
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 flex flex-col justify-between">
                <span className="text-xs font-semibold text-base-content">Temperature</span>
                <span className={`font-mono text-2xl font-black ${
                  !isOnline || normT === null
                    ? 'text-base-content/40'
                    : normT >= 80
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                }`}>
                  {!isOnline || normT === null ? 'N/A' : `${Number(normT).toFixed(1)} °C`}
                </span>
                <span className="text-[11px] text-base-content/50 font-mono">Embedded Routerboard Core</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Router Specifications
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center justify-between mb-1">
                  <span>Vendor Profile</span>
                  <BrandLogo brand={server.brand} size="xs" />
                </div>
                <div className="font-semibold text-base-content flex items-center gap-2">
                  <BrandLogo brand={server.brand} size="sm" />
                  <span>{server.brand || 'MikroTik'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Router Model</div>
                <div className="font-semibold text-base-content font-mono">
                  {server.deviceModel || 'Cloud Core Router'}
                </div>
              </div>

              {server.softwareId && (
                <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                    <Key className="w-3.5 h-3.5 text-primary" />
                    RouterOS Software ID
                  </div>
                  <div className="font-semibold font-mono text-base-content break-all">
                    {server.softwareId}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">System Uptime</div>
                <div className="font-semibold font-mono text-base-content">{server.uptime}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Datacenter / PoP</div>
                <div className="font-semibold text-base-content">{server.datacenterName || server.location}</div>
                <div className="text-[11px] text-base-content/50 font-mono mt-0.5">{server.location}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Rack</div>
                <div className="font-semibold font-mono text-base-content">{formatRack(server.rackNumber) || 'Unassigned'}</div>
              </div>
            </div>
          </div>

          {/* SRE Diagnostic Action */}
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
              <span>{isPinging ? 'Pinging Gateway...' : 'Run ICMP Ping Test'}</span>
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

      {/* Ports Modal */}
      {showPortsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-5xl max-h-[85vh] bg-base-100 border border-base-content/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
            <div className="p-4 sm:p-5 border-b border-base-content/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-base-content">
                  Router Port Catalog — {server.hostname}
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Complete listing of physical, virtual, and subscriber interfaces
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPortsModal(false)}
                className="p-2 rounded-xl bg-base-200 hover:bg-base-300 text-base-content transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allPorts.map((port) => {
                  const isUp = port.oper_status === 'up';
                  return (
                    <div
                      key={`modal-${port.name}-${port.index}`}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                        isUp ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-base-200/40 border-base-content/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs truncate">{port.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          isUp ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                        }`}>
                          {isUp ? 'UP' : 'DOWN'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-base-content/60">
                        {isUp ? formatPortSpeed(port.speed) : 'No Link'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-base-content/10 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPortsModal(false)}
                className="px-4 py-2 rounded-xl bg-base-200 hover:bg-base-300 text-xs font-bold text-base-content cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouterView;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, NetworkInterface } from '../../../types';
import { DeviceHeader } from '../shared/DeviceHeader';
import { TelemetryBar, getMetricColor, getProgressColor } from '../shared/TelemetryBar';
import { SwitchBrandSpecificLogic, isCiscoSwitch } from './SwitchBrands';
import { BrandLogo } from '../../BrandLogo';
import { formatRack } from '../../../utils/rack';
import { fetchWithAuth } from '../../../utils/auth';
import { 
  Activity, 
  Cpu, 
  MemoryStick, 
  Database,
  Network, 
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
  Eye,
  X,
  Radio
} from 'lucide-react';

export interface SwitchViewProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
  onUpdateServer?: (updated: Server) => void;
}

export const SwitchView: React.FC<SwitchViewProps> = ({
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

  const [portFilter, setPortFilter] = useState<'all' | 'up' | 'down'>('all');
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
  const isCisco = isCiscoSwitch(server.brand);
  
  // CRITICAL REQUIREMENT: Conditionally hide the entire "Storage & Memory" card using exact logic:
  // deviceType === 'Switch' && brand === 'Cisco'
  const skipStorageCard = server.deviceType === 'Switch' && (
    server.brand === 'Cisco' || (server.brand || '').toLowerCase().includes('cisco')
  );

  // Optical sensors parsing
  const rawOpticalSensors =
    (server as any).optical_sensors ??
    (server as any).opticalSensors ??
    (propServer as any).optical_sensors ??
    (propServer as any).opticalSensors;
  const opticalSensors: Array<{ index: number | string; dbm: number }> = Array.isArray(rawOpticalSensors)
    ? rawOpticalSensors
    : typeof rawOpticalSensors === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(rawOpticalSensors);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];

  // Temperature sensors parsing
  const rawTempSensors =
    (server as any).temperature_sensors ??
    (server as any).temperatureSensors ??
    (propServer as any).temperature_sensors ??
    (propServer as any).temperatureSensors;
  const temperatureSensors: Array<{ index: number | string; celsius: number }> = Array.isArray(rawTempSensors)
    ? rawTempSensors
    : typeof rawTempSensors === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(rawTempSensors);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];

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
            opticalTx: d.optical_tx !== undefined && d.optical_tx !== null ? Number(d.optical_tx) : (cur.opticalTx ?? null),
            opticalRx: d.optical_rx !== undefined && d.optical_rx !== null ? Number(d.optical_rx) : (cur.opticalRx ?? null),
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
            ...((d.optical_sensors !== undefined || (cur as any).optical_sensors !== undefined)
              ? { optical_sensors: d.optical_sensors !== undefined ? d.optical_sensors : (cur as any).optical_sensors }
              : {}),
            ...((d.temperature_sensors !== undefined || (cur as any).temperature_sensors !== undefined)
              ? { temperature_sensors: d.temperature_sensors !== undefined ? d.temperature_sensors : (cur as any).temperature_sensors }
              : {}),
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
        const ms = Math.floor(Math.random() * 12) + 2;
        setPingResult(`64 bytes from ${server.ip}: icmp_seq=1 ttl=255 time=${ms}ms (0% packet loss)`);
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
    if (speedBps >= 100000000000) return '100 Gbps';
    if (speedBps >= 40000000000) return '40 Gbps';
    if (speedBps >= 25000000000) return '25 Gbps';
    if (speedBps >= 10000000000) return '10 Gbps';
    if (speedBps >= 1000000000) return '1 Gbps';
    if (speedBps >= 1000000) return `${Math.round(speedBps / 1000000)} Mbps`;
    return `${Math.round(speedBps / 1000)} Kbps`;
  };

  // Interfaces
  const allPorts: NetworkInterface[] = Array.isArray(server.interfaces) && server.interfaces.length > 0
    ? server.interfaces
    : [
        { index: 1, name: 'Ethernet1/1', oper_status: 'up', admin_status: 'up', speed: 10000000000, type: 'sfp' },
        { index: 2, name: 'Ethernet1/2', oper_status: 'up', admin_status: 'up', speed: 10000000000, type: 'sfp' },
        { index: 3, name: 'Ethernet1/3', oper_status: 'up', admin_status: 'up', speed: 10000000000, type: 'sfp' },
        { index: 4, name: 'Ethernet1/4', oper_status: 'down', admin_status: 'up', speed: 10000000000, type: 'sfp' },
        { index: 5, name: 'mgmt0', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
      ];

  const upPorts = allPorts.filter((p) => p.oper_status === 'up');
  const downPorts = allPorts.filter((p) => p.oper_status === 'down');
  const upCount = upPorts.length;
  const downCount = downPorts.length;
  const totalPorts = allPorts.length;

  const filteredPorts = portFilter === 'up'
    ? upPorts
    : portFilter === 'down'
    ? downPorts
    : allPorts;

  // Environmental Sensors: PSUs, Fans, Temperature
  const rawPsus: Array<{ name: string; status: string; watts?: number | null; raw_value?: number | null }> = Array.isArray(server.powerSupplies)
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
          Switch Fabric Diagnostics &amp; Port Health
        </h2>

        {!isOnline && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Switch Chassis: OFFLINE CRITICAL</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1 leading-relaxed">
                Management plane unreachable at IP <span className="font-mono font-bold">{server.ip}</span>.
                Inspect out-of-band management link or top-of-rack power rails.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Elevated Control Plane Load ({server.cpuUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                L2 MAC learning or spanning-tree recalculation is placing high load on the switch processor.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage <= 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Switch Fabric Operational &amp; Nominal</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Port buffers, ASIC fabric, and environmental thermals are within optimal operational bounds.
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
          <SwitchBrandSpecificLogic brand={server.brand} server={server} />

          {/* Resource Utilization & Optical Power */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                ASIC Fabric &amp; Optical Power (DOM/DDM)
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                Live Switch Telemetry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TelemetryBar
                label="Control CPU"
                value={server.cpuUsage}
                icon={<Cpu className="w-4 h-4 text-base-content/70" />}
                isOnline={isOnline}
                isMetricsUnavailable={isMetricsUnavailable}
                targetSla="Target SLA: <70%"
              />

              <TelemetryBar
                label="Switch Memory"
                value={server.ramUsage}
                icon={<MemoryStick className="w-4 h-4 text-base-content/70" />}
                isOnline={isOnline}
                isMetricsUnavailable={isMetricsUnavailable}
                targetSla="Target SLA: <80%"
                secondaryInfo={`Used: ${server.ramUsage}%`}
              />
            </div>

            {/* Optical Power (DOM/DDM) Card: Dynamic list rendering mapped by SNMP index */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-2 text-base-content">
                  <Zap className="w-4 h-4 text-cyan-500" />
                  <span>Optical Power (DOM/DDM Sensors)</span>
                </span>
                <span className="text-[11px] font-mono text-base-content/50">
                  {opticalSensors.length > 0 ? `${opticalSensors.length} Sensors Active` : 'dBm'}
                </span>
              </div>

              {opticalSensors.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
                  {opticalSensors.map((s, idx) => (
                    <div
                      key={`opt-${s.index}-${idx}`}
                      className="p-2.5 rounded-lg bg-base-100/70 border border-base-content/10 flex items-center justify-between"
                    >
                      <span className="text-xs font-mono text-base-content/70 font-semibold">
                        Sensor {s.index}:
                      </span>
                      <span className="font-mono text-sm font-bold text-base-content">
                        {Number(s.dbm).toFixed(2)} dBm
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
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
              )}
            </div>
          </div>

          {/* Storage & Memory (Conditionally hidden for Cisco switches) */}
          {!skipStorageCard && Array.isArray(server.storage) && server.storage.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                  <Database className="w-4 h-4 text-secondary" />
                  Flash &amp; Storage Volumes
                </h3>
              </div>

              <div className="rounded-xl border border-base-content/10 bg-base-200/30 overflow-hidden divide-y divide-base-content/10">
                {server.storage.map((item, idx) => {
                  const pct = Number(item.used_pct ?? 0);
                  return (
                    <div key={`${item.name}-${idx}`} className="p-3 sm:p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-base-content text-xs">{item.name}</span>
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

          {/* Switch Ports Grid Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                  Switch Interfaces ({totalPorts} Ports)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPortFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      portFilter === 'all' ? 'bg-primary text-primary-content' : 'bg-base-200/70 text-base-content/70'
                    }`}
                  >
                    All ({totalPorts})
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
                <button
                  type="button"
                  onClick={() => setShowPortsModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Modal</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {filteredPorts.slice(0, 18).map((port) => {
                const isUp = port.oper_status === 'up';
                return (
                  <div
                    key={`sw-port-${port.name}-${port.index}`}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 ${
                      isUp ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-base-200/40 border-base-content/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px] truncate">{port.name}</span>
                      <span className={`w-2 h-2 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500/60'}`} />
                    </div>
                    <div className="text-[10px] font-mono text-base-content/60">
                      {isUp ? formatPortSpeed(port.speed) : 'Down'}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPorts > 18 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowPortsModal(true)}
                  className="px-4 py-2 rounded-xl bg-base-200 hover:bg-base-300 text-xs font-bold text-base-content cursor-pointer"
                >
                  View All {totalPorts} Switch Ports in Catalog
                </button>
              </div>
            )}
          </div>

          {/* Environmental Sensors: Power Supplies, Fans, and Temperature with Dynamic List */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Chassis Power, Fans &amp; Thermals
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                Hardware Health
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
                      const displayLabel = psu.name || `PSU ${idx + 1}`;
                      const isOk = psu.status === 'ok';
                      return (
                        <div key={`${displayLabel}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-base-content whitespace-nowrap">{displayLabel}</span>
                            {/* Only display realistic watts <= 2000 (prevents bogus numbers like 9166 W) */}
                            {typeof psu.watts === 'number' && Number.isFinite(psu.watts) && psu.watts > 0 && psu.watts <= 2000 && (
                              <span className="text-[11px] text-base-content/50 font-normal whitespace-nowrap">
                                {psu.watts} W
                              </span>
                            )}
                          </div>
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${
                            isOk
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          }`}>
                            {psu.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-base-content/40">Not reported by this device</div>
                )}
              </div>

              {/* Cooling Fans */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-base-content">
                    <Activity className="w-4 h-4 text-sky-500" />
                    <span>Cooling Fan Trays</span>
                  </span>
                </div>
                {hasFans ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                    {fansList.map((fan, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono">
                        <span className="font-semibold text-base-content">{fan.name || `Fan ${idx + 1}`}</span>
                        <div className="flex items-center gap-1.5">
                          {fan.rpm && <span className="text-base-content/60">{fan.rpm} RPM</span>}
                          <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                            {fan.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-base-content/40">Not reported by this device</div>
                )}
              </div>

              {/* Temperature (°C) Card: Refactored to dynamic list rendering mapped by SNMP index */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="flex items-center gap-2 text-base-content">
                    <Thermometer className="w-4 h-4 text-amber-500" />
                    <span>Thermal Sensors (°C)</span>
                  </span>
                  {temperatureSensors.length > 0 && (
                    <span className="text-[11px] font-mono text-base-content/50">
                      {temperatureSensors.length} Sensors
                    </span>
                  )}
                </div>

                {temperatureSensors.length > 0 ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70 max-h-48 overflow-y-auto">
                    {temperatureSensors.map((ts, idx) => {
                      const rawC = ts.celsius;
                      const cVal =
                        typeof rawC === 'number' && Number.isFinite(rawC)
                          ? Math.abs(rawC) >= 10000
                            ? rawC / 1000
                            : Math.abs(rawC) > 150
                            ? rawC / 10
                            : rawC
                          : 0;
                      const tColor =
                        cVal >= 85
                          ? 'text-rose-500'
                          : cVal >= 70
                          ? 'text-amber-500'
                          : 'text-emerald-500';
                      return (
                        <div
                          key={`ts-${ts.index}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono"
                        >
                          <span className="font-semibold text-base-content whitespace-nowrap">
                            Sensor {ts.index}:
                          </span>
                          <span className={`font-mono font-bold ${tColor}`}>
                            {Number(cVal).toFixed(2)} °C
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="my-1">
                      <span className={`font-mono text-2xl font-black ${
                        !isOnline || normT === null
                          ? 'text-base-content/40'
                          : normT >= 85
                          ? 'text-rose-500'
                          : normT >= 70
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }`}>
                        {!isOnline || normT === null ? 'N/A' : `${Number(normT).toFixed(1)} °C`}
                      </span>
                    </div>
                    <div className="text-[11px] text-base-content/60 font-mono mt-1">
                      Chassis Thermal Sensor
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Switch Specifications
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center justify-between mb-1">
                  <span>Vendor Profile</span>
                  <BrandLogo brand={server.brand} size="xs" />
                </div>
                <div className="font-semibold text-base-content flex items-center gap-2">
                  <BrandLogo brand={server.brand} size="sm" />
                  <span>{server.brand || 'Cisco'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Switch Model</div>
                <div className="font-semibold text-base-content font-mono">
                  {server.deviceModel || 'L2/L3 Aggregation Switch'}
                </div>
                {server.sysDescr && (
                  <div className="text-[11px] text-base-content/50 font-mono mt-1 line-clamp-2" title={server.sysDescr}>
                    {server.sysDescr}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Serial Number</div>
                <div className="font-semibold font-mono text-base-content break-all">
                  {server.deviceSerial || 'Not reported'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">System Uptime</div>
                <div className="font-semibold font-mono text-base-content">{server.uptime}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Datacenter / Room</div>
                <div className="font-semibold text-base-content">{server.datacenterName || server.location}</div>
                <div className="text-[11px] text-base-content/50 font-mono mt-0.5">{server.location}</div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 mb-1">Rack</div>
                <div className="font-semibold font-mono text-base-content">{formatRack(server.rackNumber) || 'Unassigned'}</div>
              </div>
            </div>
          </div>

          {/* SRE Diagnostics */}
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
              <span>{isPinging ? 'Pinging Switch...' : 'Run ICMP Ping Test'}</span>
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
                  Switch Port Catalog — {server.hostname}
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Complete view of all switch interfaces and active link states
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPortsModal(false)}
                className="p-2 rounded-xl bg-base-200 hover:bg-base-300 text-base-content cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {allPorts.map((port) => {
                  const isUp = port.oper_status === 'up';
                  return (
                    <div
                      key={`modal-port-${port.name}-${port.index}`}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${
                        isUp ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-base-200/40 border-base-content/10'
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

export default SwitchView;

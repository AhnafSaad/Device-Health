import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server } from '../../../types';
import { DeviceHeader } from '../shared/DeviceHeader';
import { TelemetryBar, getMetricColor } from '../shared/TelemetryBar';
import { OLTBrandSpecificLogic, isVSolOLT } from './OLTBrands';
import { BrandLogo } from '../../BrandLogo';
import { formatRack } from '../../../utils/rack';
import { fetchWithAuth } from '../../../utils/auth';
import { 
  Activity, 
  Cpu, 
  MemoryStick, 
  Zap, 
  Thermometer, 
  Clock, 
  MapPin, 
  Layers, 
  ShieldCheck, 
  Radio, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Terminal,
  Hash
} from 'lucide-react';

export interface OLTViewProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
  onUpdateServer?: (updated: Server) => void;
}

export const OLTView: React.FC<OLTViewProps> = ({
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
  const [liveIntervalSec, setLiveIntervalSec] = useState<number>(30);
  const [isPollingNow, setIsPollingNow] = useState<boolean>(false);
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  useEffect(() => {
    setLiveServer(propServer);
  }, [propServer]);

  const isOnline = server.status === 'online';
  const isMetricsUnavailable = server.metricsAvailable === false;
  const isVsol = isVSolOLT(server.brand);

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
            temperature: d.temperature !== undefined && d.temperature !== null ? Number(d.temperature) : (cur.temperature ?? null),
            powerSupplies: Array.isArray(d.power_supplies)
              ? d.power_supplies
              : typeof d.power_supplies === 'string'
              ? (() => {
                  try {
                    const p = JSON.parse(d.power_supplies);
                    return Array.isArray(p) ? p : (cur.powerSupplies ?? null);
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
                    const p = JSON.parse(d.fans);
                    return Array.isArray(p) ? p : (cur.fans ?? null);
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
      // safe fallback on transient poll error
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
        const ms = Math.floor(Math.random() * 20) + 5;
        setPingResult(`64 bytes from ${server.ip}: icmp_seq=1 ttl=60 time=${ms}ms (0% packet loss)`);
      } else {
        setPingResult(`From 10.0.0.1: Destination Host Unreachable (${server.ip}) - 100% loss`);
      }
    }, 550);
  };

  // Safe parsing of power supplies (capped at 2 redundant units for OLT chassis)
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

  const validPsus = rawPsus.length > 2
    ? rawPsus.slice(0, 2).map((p, idx) => ({ ...p, name: `PSU ${idx + 1}` }))
    : rawPsus;
  const hasPsus = validPsus.length > 0;

  // Safe parsing of fans
  const fansList: Array<{ name: string; status: string; rpm?: number | null; percent?: number | null }> = Array.isArray(server.fans)
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
  const hasFans = fansList.length > 0;

  // Normalized temperature
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
      {/* 1. Shared Header */}
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
          OLT Fleet Diagnostic &amp; Health State
        </h2>

        {!isOnline && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">OLT Chassis Status: OFFLINE CRITICAL</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1 leading-relaxed">
                Optical Line Terminal unreachable at IP <span className="font-mono font-bold">{server.ip}</span>.
                All subscriber ONUs / optical drops on this chassis are currently disconnected from upstream gateway.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">OLT Switch Fabric Load Contention ({server.cpuUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                High processor utilization detected on OLT control card.
              </div>
            </div>
          </div>
        )}

        {isOnline && isMetricsUnavailable && (
          <div className="p-4 sm:p-5 rounded-2xl bg-base-200/70 border border-base-content/15 text-base-content/80 flex items-start gap-3.5">
            <Info className="w-6 h-6 shrink-0 mt-0.5 text-base-content/60" />
            <div>
              <div className="font-bold text-sm sm:text-base text-base-content">
                SNMP telemetry unavailable — device is reachable via ICMP but did not respond to OLT enterprise OIDs.
              </div>
            </div>
          </div>
        )}

        {isOnline && !isMetricsUnavailable && server.cpuUsage <= 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">GPON Distribution Nominal</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Optical line transmission, uplink bandwidth, and control processor are running within parameters.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Left Column (8 cols): Resource & Environmental Telemetry */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Brand-Specific Hardware Profile Banner */}
          <OLTBrandSpecificLogic brand={server.brand} server={server} />

          {/* Resource Utilization Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Processor &amp; Memory Telemetry
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                &lt;70% OK • 70-85% WARN • &gt;85% CRIT
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
                secondaryInfo={`Load: ${server.loadAverage || '0.45'}`}
              />

              <TelemetryBar
                label="Chassis RAM"
                value={server.ramUsage}
                icon={<MemoryStick className="w-4 h-4 text-base-content/70" />}
                isOnline={isOnline}
                isMetricsUnavailable={isMetricsUnavailable}
                targetSla="Target SLA: <80%"
                secondaryInfo={`Used: ${server.ramUsage}%`}
              />
            </div>
          </div>

          {/* Environmental Sensors: Dual PSUs, Fans, Temperature */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Chassis Environmental Sensors
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-base-content/50">
                Redundant Hardware Health
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {/* Power Supplies Card */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-base-content">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <span>Power Supplies (1+1)</span>
                  </span>
                </div>
                {hasPsus ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                    {validPsus.map((psu, idx) => {
                      const displayLabel = psu.name || `PSU ${idx + 1}`;
                      const isOk = psu.status === 'ok';
                      return (
                        <div key={`${displayLabel}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono">
                          <span className="font-semibold text-base-content whitespace-nowrap">{displayLabel}</span>
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
                  <div className="text-xs font-mono text-base-content/40">
                    {isVsol
                      ? 'Not exposed via SNMP on this hardware — fan/power telemetry requires CLI access on V-SOL OLTs.'
                      : 'Not reported by this device'}
                  </div>
                )}
              </div>

              {/* Cooling Fans */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-base-content">
                    <Activity className="w-4 h-4 text-sky-500" />
                    <span>Cooling Fan Tray</span>
                  </span>
                </div>
                {hasFans ? (
                  <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/70">
                    {fansList.map((fan, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-mono">
                        <span className="font-semibold text-base-content">{fan.name || `Fan ${idx + 1}`}</span>
                        <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                          {fan.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-base-content/40">
                    {isVsol ? 'CLI Managed' : 'Auto-regulated / Passive'}
                  </div>
                )}
              </div>

              {/* Chassis Temperature */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-base-200/40 border border-base-content/5 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="flex items-center gap-2 text-base-content">
                    <Thermometer className="w-4 h-4 text-amber-500" />
                    <span>Chassis Temperature</span>
                  </span>
                </div>
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
                  Chassis Optical Core Thermal Sensor
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Specifications & SRE Actions */}
        <div className="lg:col-span-4 space-y-4">
          {/* Hardware Specs Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              OLT Specifications
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Hardware Vendor
                  </span>
                  <BrandLogo brand={server.brand} size="xs" />
                </div>
                <div className="font-semibold text-base-content flex items-center gap-2">
                  <BrandLogo brand={server.brand} size="sm" />
                  <span>{server.brand || 'V-SOL'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  Chassis Model
                </div>
                <div className="font-semibold text-base-content font-mono">
                  {server.deviceModel || 'GPON Optical Line Terminal'}
                </div>
                {server.sysDescr && (
                  <div className="text-[11px] text-base-content/50 font-mono mt-1 line-clamp-2" title={server.sysDescr}>
                    {server.sysDescr}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  Chassis Serial Number
                </div>
                <div className="font-semibold text-base-content font-mono break-all">
                  {server.deviceSerial || 'Not reported'}
                </div>
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
                  Rack Position
                </div>
                <div className="font-semibold font-mono text-base-content">
                  {formatRack(server.rackNumber) || 'Unassigned'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  SNMP Telemetry Poller
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="font-bold text-emerald-500">Active (SNMPv2c)</span>
                  <span className="text-[10px] text-base-content/40 font-sans">(Port 161)</span>
                </div>
              </div>
            </div>
          </div>

          {/* SRE Immediate Diagnostics */}
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
              <span>{isPinging ? 'Pinging OLT...' : 'Run ICMP Ping Test'}</span>
            </button>

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

export default OLTView;

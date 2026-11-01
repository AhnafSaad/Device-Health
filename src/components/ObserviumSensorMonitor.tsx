import React, { useState, useMemo } from 'react';
import { Server, Datacenter } from '../types';
import { SparklineGraph } from './SparklineGraph';
import { getTelemetryHistory } from '../utils/telemetryHistory';
import { BrandLogo } from './BrandLogo';
import { 
  Zap, 
  MemoryStick, 
  Activity, 
  Cpu, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  Search, 
  RotateCcw,
  SlidersHorizontal,
  ExternalLink,
  ChevronRight,
  Clock,
  Network
} from 'lucide-react';

export type ErrorCategory = 'all' | 'optical' | 'ecc' | 'ram' | 'cpu' | 'hardware' | 'interfaces';
export type SeverityFilter = 'all' | 'alert' | 'warning' | 'normal';

export interface ObserviumItem {
  id: string;
  category: ErrorCategory;
  device: Server;
  description: string;
  subDescription?: string;
  thresholds: string;
  event: 'alert' | 'warning' | 'ok';
  value: number;
  valueDisplay: string;
  unit: string;
  lastChanged: string;
  historyKey: string;
  thresholdMin?: number;
  thresholdMax?: number;
}

interface ObserviumSensorMonitorProps {
  servers: Server[];
  onInspectServer: (server: Server) => void;
  selectedCategory: ErrorCategory;
  onSelectCategory: (category: ErrorCategory) => void;
}

export const ObserviumSensorMonitor: React.FC<ObserviumSensorMonitorProps> = ({
  servers,
  onInspectServer,
  selectedCategory,
  onSelectCategory,
}) => {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Extract all telemetry sensors across all devices
  const allItems = useMemo<ObserviumItem[]>(() => {
    const list: ObserviumItem[] = [];

    servers.forEach((srv) => {
      const isOnline = srv.status === 'online';

      // 1. Optical Sensors (Tx / Rx DOM)
      const rawOptical =
        (srv as any).optical_sensors ??
        (srv as any).opticalSensors ??
        (srv as any).optical_power;
      
      let optArray: any[] = [];
      if (Array.isArray(rawOptical)) {
        optArray = rawOptical;
      } else if (typeof rawOptical === 'string') {
        try {
          const parsed = JSON.parse(rawOptical);
          if (Array.isArray(parsed)) optArray = parsed;
        } catch {}
      }

      // Individual optical transceivers
      if (optArray.length > 0) {
        optArray.forEach((s, idx) => {
          const dbm = typeof s.dbm === 'number' ? s.dbm : parseFloat(s.dbm);
          if (!isNaN(dbm)) {
            const portName = s.port || `Port ${s.index ?? idx + 1}`;
            const isRx = /rx/i.test(s.label || '') || /rx/i.test(portName) || s.type === 'rx';
            const isAlert = dbm <= -35 || dbm === -40 || dbm >= 3;
            const isWarn = !isAlert && (dbm < -18 || dbm > 1);
            const event: 'alert' | 'warning' | 'ok' = isAlert ? 'alert' : isWarn ? 'warning' : 'ok';

            list.push({
              id: `${srv.id}-opt-${s.index ?? idx}`,
              category: 'optical',
              device: srv,
              description: `${portName} ${isRx ? 'Rx Power' : 'Tx Power'}`,
              subDescription: s.label || `${srv.brand || 'Switch'} Transceiver`,
              thresholds: isRx ? '-19dBm (-16dBm) - (-0.5dBm) 2dBm' : '-9dBm (-8dBm) - (1dBm) 2.5dBm',
              event,
              value: dbm,
              valueDisplay: `${dbm.toFixed(2)} dBm`,
              unit: 'dBm',
              lastChanged: isAlert ? 'Alert active' : 'Stable',
              historyKey: `${srv.id}_opt_${s.index ?? idx}`,
              thresholdMin: -19,
              thresholdMax: 2,
            });
          }
        });
      } else if (typeof srv.opticalRx === 'number') {
        const isAlert = srv.opticalRx <= -35 || srv.opticalRx === -40;
        const isWarn = !isAlert && srv.opticalRx < -18;
        list.push({
          id: `${srv.id}-opt-rx-main`,
          category: 'optical',
          device: srv,
          description: `Transceiver Receive Power (Rx)`,
          subDescription: `${srv.hostname} Optical Link`,
          thresholds: '-19dBm (-16dBm) - (-0.5dBm) 2dBm',
          event: isAlert ? 'alert' : isWarn ? 'warning' : 'ok',
          value: srv.opticalRx,
          valueDisplay: `${srv.opticalRx.toFixed(2)} dBm`,
          unit: 'dBm',
          lastChanged: isAlert ? 'Alert active' : 'Stable',
          historyKey: `${srv.id}_opt_rx_main`,
          thresholdMin: -19,
          thresholdMax: 2,
        });
      }

      // 2. ECC Memory Errors (ERC)
      const eccControllers = srv.ramEccControllers;
      if (Array.isArray(eccControllers) && eccControllers.length > 0) {
        eccControllers.forEach((mc, idx) => {
          const ue = Number(mc.ue || 0);
          const ce = Number(mc.ce || 0);
          const isAlert = ue > 0;
          const isWarn = !isAlert && ce > 0;
          list.push({
            id: `${srv.id}-ecc-${mc.name || idx}`,
            category: 'ecc',
            device: srv,
            description: `${mc.name.toUpperCase()} (Memory Channel ${idx})`,
            subDescription: `DIMM Hardware ECC Controller Parity`,
            thresholds: '0 UE (Uncorrected) • 0 CE (Corrected)',
            event: isAlert ? 'alert' : isWarn ? 'warning' : 'ok',
            value: ue * 10 + ce,
            valueDisplay: ue > 0 ? `${ue} UE Critical` : ce > 0 ? `${ce} CE Warn` : '0 Errors',
            unit: 'errors',
            lastChanged: isAlert ? 'Memory Fault' : 'Healthy',
            historyKey: `${srv.id}_ecc_${mc.name || idx}`,
            thresholdMin: 0,
            thresholdMax: 5,
          });
        });
      } else if (srv.ramEccUncorrected !== undefined && srv.ramEccUncorrected !== null) {
        const ue = Number(srv.ramEccUncorrected || 0);
        const ce = Number(srv.ramEccCorrected || 0);
        const isAlert = ue > 0;
        const isWarn = !isAlert && ce > 0;
        list.push({
          id: `${srv.id}-ecc-summary`,
          category: 'ecc',
          device: srv,
          description: `ECC Memory Controller Parity Pool`,
          subDescription: `${srv.hostname} Host RAM Protection`,
          thresholds: '0 UE (Uncorrected) • 0 CE (Corrected)',
          event: isAlert ? 'alert' : isWarn ? 'warning' : 'ok',
          value: ue * 10 + ce,
          valueDisplay: ue > 0 ? `${ue} UE Critical` : ce > 0 ? `${ce} CE Warn` : '0 Errors',
          unit: 'errors',
          lastChanged: isAlert ? 'Hardware Fault' : 'Healthy',
          historyKey: `${srv.id}_ecc_summary`,
          thresholdMin: 0,
          thresholdMax: 5,
        });
      }

      // 3. RAM Usage Saturation
      const ramVal = typeof srv.ramUsage === 'number' ? srv.ramUsage : Number((srv as any).ram_usage ?? 0);
      if (!isNaN(ramVal) && isOnline) {
        const isAlert = ramVal > 85;
        const isWarn = !isAlert && ramVal >= 70;
        list.push({
          id: `${srv.id}-ram-usage`,
          category: 'ram',
          device: srv,
          description: `Host System RAM Pool`,
          subDescription: `${srv.hostname} Memory Allocation`,
          thresholds: '< 70% OK • 70-85% Warn • > 85% Crit',
          event: isAlert ? 'alert' : isWarn ? 'warning' : 'ok',
          value: ramVal,
          valueDisplay: `${ramVal}%`,
          unit: '%',
          lastChanged: isAlert ? 'Exceeded SLA' : 'Nominal',
          historyKey: `${srv.id}_ram_usage`,
          thresholdMin: 0,
          thresholdMax: 85,
        });
      }

      // 4. Compute CPU Saturation
      const cpuVal = typeof srv.cpuUsage === 'number' ? srv.cpuUsage : Number((srv as any).cpu_usage ?? 0);
      if (!isNaN(cpuVal) && isOnline) {
        const isAlert = cpuVal > 85;
        const isWarn = !isAlert && cpuVal >= 70;
        list.push({
          id: `${srv.id}-cpu-usage`,
          category: 'cpu',
          device: srv,
          description: `Compute Processor Cores`,
          subDescription: `${srv.hostname} CPU Thread Load`,
          thresholds: '< 70% Target SLA • 70-85% Warn • > 85% Crit',
          event: isAlert ? 'alert' : isWarn ? 'warning' : 'ok',
          value: cpuVal,
          valueDisplay: `${cpuVal}%`,
          unit: '%',
          lastChanged: isAlert ? 'Saturated' : 'Nominal',
          historyKey: `${srv.id}_cpu_usage`,
          thresholdMin: 0,
          thresholdMax: 85,
        });
      }

      // 5. Hardware Fans & PSUs
      const fans = Array.isArray(srv.fans) ? srv.fans : [];
      fans.forEach((f, idx) => {
        const s = String(f.status || '').toLowerCase();
        const isOk = s === 'ok' || s === 'normal' || s === 'running';
        const isWarn = s === 'warning' || s === 'warn';
        list.push({
          id: `${srv.id}-fan-${idx}`,
          category: 'hardware',
          device: srv,
          description: f.name || `Cooling Fan ${idx + 1}`,
          subDescription: `Chassis Thermal Fan Speed`,
          thresholds: 'Operational RPM / Status OK',
          event: !isOk && !isWarn ? 'alert' : isWarn ? 'warning' : 'ok',
          value: f.percent ?? (isOk ? 100 : 0),
          valueDisplay: f.percent ? `${f.percent}% (${f.status})` : f.status,
          unit: '%',
          lastChanged: isOk ? 'Nominal' : 'Hardware Fault',
          historyKey: `${srv.id}_fan_${idx}`,
        });
      });

      const psus = Array.isArray(srv.powerSupplies) ? srv.powerSupplies : [];
      psus.forEach((p, idx) => {
        const s = String(p.status || '').toLowerCase();
        const isOk = s === 'ok' || s === 'normal' || s === 'active';
        list.push({
          id: `${srv.id}-psu-${idx}`,
          category: 'hardware',
          device: srv,
          description: p.name || `Power Supply ${idx + 1}`,
          subDescription: `Chassis Power Feed`,
          thresholds: 'Feed Voltage & State OK',
          event: isOk ? 'ok' : 'alert',
          value: p.watts ?? (isOk ? 1 : 0),
          valueDisplay: p.watts ? `${p.watts}W (${p.status})` : p.status,
          unit: 'W',
          lastChanged: isOk ? 'Nominal' : 'PSU Fault',
          historyKey: `${srv.id}_psu_${idx}`,
        });
      });

      // 6. Interfaces CRC Errors or Down Links
      const rawIfaces = srv.interfaces ?? (srv as any).network_interfaces;
      let ifacesList: any[] = [];
      if (Array.isArray(rawIfaces)) ifacesList = rawIfaces;
      else if (typeof rawIfaces === 'string') {
        try {
          const parsed = JSON.parse(rawIfaces);
          if (Array.isArray(parsed)) ifacesList = parsed;
        } catch {}
      }

      ifacesList.forEach((iface, idx) => {
        const crc = Number(iface.crc_errors || 0);
        const operDown = String(iface.oper_status || '').toLowerCase() === 'down';
        const adminUp = String(iface.admin_status || '').toLowerCase() === 'up';
        const isCrcCrit = crc >= 50;
        const isCrcWarn = crc > 0 && crc < 50;
        const isUnexpectedDown = adminUp && operDown;

        if (crc > 0 || isUnexpectedDown) {
          const portName = String(iface.name || iface.descr || `Interface ${idx + 1}`);
          const event: 'alert' | 'warning' | 'ok' = isCrcCrit || isUnexpectedDown ? 'alert' : 'warning';
          list.push({
            id: `${srv.id}-iface-${idx}`,
            category: 'interfaces',
            device: srv,
            description: `${portName} (${iface.alias || 'Physical Port'})`,
            subDescription: isUnexpectedDown ? 'Admin UP / Operational DOWN' : `CRC Checksum Invalids: ${crc}`,
            thresholds: '0 CRC Errors • Oper State UP',
            event,
            value: crc > 0 ? crc : 0,
            valueDisplay: isUnexpectedDown ? 'Down (Link Lost)' : `${crc} CRC errors`,
            unit: 'errors',
            lastChanged: isUnexpectedDown ? 'Link Down' : 'CRC Flapping',
            historyKey: `${srv.id}_iface_${idx}`,
          });
        }
      });
    });

    return list;
  }, [servers]);

  // Counts for Category Pills
  const categoryCounts = useMemo(() => {
    return {
      all: allItems.length,
      optical: allItems.filter((i) => i.category === 'optical').length,
      ecc: allItems.filter((i) => i.category === 'ecc').length,
      ram: allItems.filter((i) => i.category === 'ram').length,
      cpu: allItems.filter((i) => i.category === 'cpu').length,
      hardware: allItems.filter((i) => i.category === 'hardware').length,
      interfaces: allItems.filter((i) => i.category === 'interfaces').length,
    };
  }, [allItems]);

  // Alert/Warning/Normal counts for current category
  const severityCounts = useMemo(() => {
    const subset = selectedCategory === 'all' ? allItems : allItems.filter((i) => i.category === selectedCategory);
    return {
      all: subset.length,
      alert: subset.filter((i) => i.event === 'alert').length,
      warning: subset.filter((i) => i.event === 'warning').length,
      normal: subset.filter((i) => i.event === 'ok').length,
    };
  }, [allItems, selectedCategory]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Severity event filter
      if (severityFilter === 'alert' && item.event !== 'alert') return false;
      if (severityFilter === 'warning' && item.event !== 'warning') return false;
      if (severityFilter === 'normal' && item.event !== 'ok') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesIp = item.device.ip.toLowerCase().includes(q);
        const matchesHost = (item.device.hostname || '').toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesSub = (item.subDescription || '').toLowerCase().includes(q);
        const matchesBrand = (item.device.brand || '').toLowerCase().includes(q);
        if (!matchesIp && !matchesHost && !matchesDesc && !matchesSub && !matchesBrand) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Prioritize alert first (0), warning (1), ok (2)
      const rank = (ev: string) => (ev === 'alert' ? 0 : ev === 'warning' ? 1 : 2);
      const diff = rank(a.event) - rank(b.event);
      if (diff !== 0) return diff;
      return a.device.ip.localeCompare(b.device.ip);
    });
  }, [allItems, selectedCategory, severityFilter, searchQuery]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-0 bg-base-100 rounded-2xl border border-base-content/10 shadow-lg p-4 sm:p-5">
      
      {/* 1. Header & Observium Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-base-content/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-base-content">
                Telemetry &amp; Optical DOM Sensor Monitor
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-base-200 border border-base-content/15 text-base-content/80">
                Observium Stream
              </span>
            </div>
            <p className="text-xs text-base-content/60">
              Live real-time telemetry sparklines, transceiver dBm power trends, ECC memory parity, and threshold breaches.
            </p>
          </div>
        </div>

        {/* Global summary counter badge */}
        <div className="flex items-center gap-2 self-start md:self-auto font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Alerts: {severityCounts.alert}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Warn: {severityCounts.warning}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            OK: {severityCounts.normal}
          </span>
        </div>
      </div>

      {/* 2. Error Category Filter Bar */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/50 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>Error Category Filter</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onSelectCategory('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-content shadow-sm'
                : 'bg-base-200/80 hover:bg-base-200 text-base-content/70 hover:text-base-content border border-base-content/10'
            }`}
          >
            <span>All Errors</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">
              {categoryCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectCategory('optical');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'optical'
                ? 'bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-500/30'
                : 'bg-base-200/80 hover:bg-base-200 text-base-content/70 hover:text-base-content border border-base-content/10'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Optical Tx/Rx</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">
              {categoryCounts.optical}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectCategory('ecc');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'ecc'
                ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/30'
                : 'bg-base-200/80 hover:bg-base-200 text-base-content/70 hover:text-base-content border border-base-content/10'
            }`}
          >
            <MemoryStick className="w-3.5 h-3.5 text-purple-400" />
            <span>ECC Memory (ERC)</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">
              {categoryCounts.ecc}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectCategory('ram');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'ram'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30'
                : 'bg-base-200/80 hover:bg-base-200 text-base-content/70 hover:text-base-content border border-base-content/10'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>RAM Usage</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">
              {categoryCounts.ram}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectCategory('cpu');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'cpu'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
                : 'bg-base-200/80 hover:bg-base-200 text-base-content/70 hover:text-base-content border border-base-content/10'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-rose-400" />
            <span>Compute CPU</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">
              {categoryCounts.cpu}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectCategory('hardware');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'hardware'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-base-200/80 hover:bg-base-200 text-base-content/70 hover:text-base-content border border-base-content/10'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hardware PSU / Fans</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">
              {categoryCounts.hardware}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectCategory('interfaces');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'interfaces'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30'
                : 'bg-base-200/80 hover:bg-base-200 text-base-content/70 hover:text-base-content border border-base-content/10'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-blue-400" />
            <span>Interfaces Down / CRC</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">
              {categoryCounts.interfaces}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Observium Secondary Controls: Severity Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 bg-base-200/60 p-1 rounded-xl border border-base-content/10 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setSeverityFilter('all');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              severityFilter === 'all'
                ? 'bg-base-100 text-base-content shadow-xs border border-base-content/10'
                : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            All: {severityCounts.all}
          </button>

          <button
            type="button"
            onClick={() => {
              setSeverityFilter('alert');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              severityFilter === 'alert'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-rose-500 hover:bg-rose-500/10'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Alert: {severityCounts.alert}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSeverityFilter('warning');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              severityFilter === 'warning'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-500 hover:bg-amber-500/10'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Warn: {severityCounts.warning}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSeverityFilter('normal');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              severityFilter === 'normal'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-emerald-500 hover:bg-emerald-500/10'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>OK: {severityCounts.normal}</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px] sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            placeholder="Search port, SFP, IP..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="input input-sm w-full pl-8 pr-3 rounded-xl bg-base-200/50 border-base-content/15 text-xs font-mono focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Observium Telemetry Table matching the user's screenshot */}
      <div className="flex-1 overflow-x-auto rounded-xl border border-base-content/10 bg-base-100 shadow-inner mt-2">
        <table className="table table-xs w-full font-mono text-left">
          <thead className="bg-base-200/70 border-b border-base-content/10 text-base-content/70 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3">Device</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3">Thresholds</th>
              <th className="py-2.5 px-3">History</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Event</th>
              <th className="py-2.5 px-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-content/5 text-xs">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-base-content/40 font-sans">
                  No sensors match current category &amp; filter parameters.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const historyData = getTelemetryHistory(item.historyKey, item.value);

                const rowBg =
                  item.event === 'alert'
                    ? 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08]'
                    : item.event === 'warning'
                    ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                    : 'hover:bg-base-200/40';

                const sparkColor: 'rose' | 'amber' | 'emerald' | 'cyan' =
                  item.event === 'alert'
                    ? 'rose'
                    : item.event === 'warning'
                    ? 'amber'
                    : item.category === 'optical'
                    ? 'cyan'
                    : 'emerald';

                return (
                  <tr key={item.id} className={`transition-colors border-l-4 ${
                    item.event === 'alert' ? 'border-l-rose-500' : item.event === 'warning' ? 'border-l-amber-500' : 'border-l-emerald-500'
                  } ${rowBg}`}>
                    
                    {/* Device Column (Clickable to Inspect) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectServer(item.device)}
                        className="text-left group cursor-pointer inline-flex flex-col"
                      >
                        <div className="flex items-center gap-1.5 font-bold text-primary group-hover:underline">
                          <span>{item.device.ip}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[10px] text-base-content/50 font-sans flex items-center gap-1">
                          <span>{item.device.hostname || 'Host'}</span>
                          {item.device.brand && (
                            <span className="opacity-70">• {item.device.brand}</span>
                          )}
                        </div>
                      </button>
                    </td>

                    {/* Description Column */}
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="font-semibold text-base-content truncate" title={item.description}>
                        {item.description}
                      </div>
                      {item.subDescription && (
                        <div className="text-[10px] text-base-content/50 truncate font-sans" title={item.subDescription}>
                          {item.subDescription}
                        </div>
                      )}
                    </td>

                    {/* Thresholds Column */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-base-200/90 border border-base-content/10 text-[10px] text-base-content/70">
                        {item.thresholds}
                      </span>
                    </td>

                    {/* History Trend Sparkline Column */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <SparklineGraph
                        data={historyData}
                        color={sparkColor}
                        unit={item.unit}
                        thresholdMin={item.thresholdMin}
                        thresholdMax={item.thresholdMax}
                        width={120}
                        height={26}
                      />
                    </td>

                    {/* Last Changed / Polled Column */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-base-content/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 opacity-50" />
                        <span>{item.lastChanged}</span>
                      </span>
                    </td>

                    {/* Event Badge Column */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          item.event === 'alert'
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse'
                            : item.event === 'warning'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                        }`}
                      >
                        {item.event}
                      </span>
                    </td>

                    {/* Value Column */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      <span
                        className={`font-black text-xs ${
                          item.event === 'alert'
                            ? 'text-rose-600 dark:text-rose-400'
                            : item.event === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {item.valueDisplay}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs font-mono">
          <span className="text-base-content/60">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} sensors
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="btn btn-xs btn-outline rounded-lg"
            >
              Prev
            </button>
            <span className="px-2 py-1 font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="btn btn-xs btn-outline rounded-lg"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

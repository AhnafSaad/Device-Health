import React, { useState, useMemo } from 'react';
import { Server, Datacenter, StatusFilter } from '../types';
import { ServerTable } from './ServerTable';
import { Pagination } from './Pagination';
import { calculateDeviceHealth } from '../utils/deviceHealth';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight, 
  RotateCcw,
  SlidersHorizontal,
  Server as ServerIcon,
  Layers,
  Activity,
  Building2,
  Filter,
  Radio,
  Zap,
  Cpu,
  Network
} from 'lucide-react';
import { DatacenterDropdown } from './DatacenterDropdown';

export type ErrorCategory = 'all' | 'optical' | 'ecc' | 'ram' | 'cpu' | 'hardware' | 'interfaces';

export function deviceMatchesErrorCategory(server: Server, category: ErrorCategory): boolean {
  if (category === 'all') return true;

  const health = calculateDeviceHealth(server);

  if (category === 'optical') {
    const rx = typeof server.opticalRx === 'number' ? server.opticalRx : null;
    const tx = typeof server.opticalTx === 'number' ? server.opticalTx : null;
    const hasOpticalValue = (rx !== null && (rx <= -25 || rx === 0)) ||
                            (tx !== null && (tx <= -20 || tx === 0));
    const sensors = (server.opticalSensors || server.optical_sensors || []);
    const hasSensorIssue = sensors.some(s => typeof s.dbm === 'number' && (s.dbm <= -25 || s.dbm === 0));
    const summaryMatch = /optical|rx power|tx power|transceiver|dbm/i.test(health.summary || '');
    return Boolean(hasOpticalValue || hasSensorIssue || summaryMatch);
  }

  if (category === 'ecc') {
    const ue = typeof server.ramEccUncorrected === 'number' ? server.ramEccUncorrected : 0;
    const ce = typeof server.ramEccCorrected === 'number' ? server.ramEccCorrected : 0;
    const hasControllers = (server.ramEccControllers || []).some(c => (c.ue || 0) > 0 || (c.ce || 0) > 50);
    const summaryMatch = /ecc|parity|erc/i.test(health.summary || '');
    return ue > 0 || ce > 50 || hasControllers || summaryMatch;
  }

  if (category === 'ram') {
    const ram = typeof server.ramUsage === 'number' ? server.ramUsage : 0;
    return health.ramCritical || health.ramWarning || ram >= 70;
  }

  if (category === 'cpu') {
    const cpu = typeof server.cpuUsage === 'number' ? server.cpuUsage : 0;
    return health.cpuCritical || health.cpuWarning || cpu >= 70;
  }

  if (category === 'hardware') {
    const failedHw = health.failedHardware.length > 0;
    const warnHw = health.warningHardware.length > 0;
    const psuBad = (server.powerSupplies || []).some(p => p.status && !['ok', 'normal', 'up'].includes(p.status.toLowerCase()));
    const fanBad = (server.fans || []).some(f => f.status && !['ok', 'normal', 'up'].includes(f.status.toLowerCase()));
    return failedHw || warnHw || psuBad || fanBad;
  }

  if (category === 'interfaces') {
    const hasCrc = (health.crcIssues && health.crcIssues.length > 0) || health.crcCritical || health.crcWarning;
    const ifaces = (server.interfaces || []);
    const ifaceCrc = ifaces.some(i => (typeof i.crc_errors === 'number' && i.crc_errors > 0) || i.oper_status === 'down');
    const summaryMatch = /crc|interface|link down/i.test(health.summary || '');
    return hasCrc || ifaceCrc || summaryMatch;
  }

  return false;
}

interface IncidentsViewProps {
  servers: Server[];
  datacenters: Datacenter[];
  selectedServer: Server | null;
  onSelectServer: (server: Server) => void;
  onInspectServer: (server: Server) => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onPollDevice?: (server: Server) => void;
  pollingDeviceIds?: Set<string>;
  onNavigateToDashboard: () => void;
  onOpenDcModal?: () => void;
  currentUserRole?: 'admin' | 'editor' | 'viewer';
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  servers,
  datacenters,
  selectedServer,
  onSelectServer,
  onInspectServer,
  onEditServer,
  onDeleteServer,
  onPollDevice,
  pollingDeviceIds,
  onNavigateToDashboard,
  onOpenDcModal,
  currentUserRole = 'viewer',
}) => {
  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [datacenterFilter, setDatacenterFilter] = useState<string>('all');
  const [errorCategory, setErrorCategory] = useState<ErrorCategory>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 1. Evaluate and extract all devices with incidents (Critical or Warning)
  const allIncidents = useMemo(() => {
    return servers.filter((srv) => {
      const health = calculateDeviceHealth(srv);
      return health.health === 'Critical' || health.health === 'Warning' || health.isOffline || srv.status === 'offline';
    });
  }, [servers]);

  const criticalCount = useMemo(() => {
    return allIncidents.filter((srv) => {
      const health = calculateDeviceHealth(srv);
      return health.health === 'Critical' || health.isOffline || srv.status === 'offline';
    }).length;
  }, [allIncidents]);

  const warningCount = useMemo(() => {
    return allIncidents.filter((srv) => {
      const health = calculateDeviceHealth(srv);
      return health.health === 'Warning' && !health.isOffline && srv.status !== 'offline';
    }).length;
  }, [allIncidents]);

  // Operational status breakdown among incidents (UP vs DOWN)
  const isDeviceDown = (srv: Server) => {
    const health = calculateDeviceHealth(srv);
    const s = String(srv.status || '').toLowerCase().trim();
    return health.isOffline || s === 'offline' || s === 'down';
  };

  const upIncidentCount = useMemo(() => {
    return allIncidents.filter((srv) => !isDeviceDown(srv)).length;
  }, [allIncidents]);

  const downIncidentCount = useMemo(() => {
    return allIncidents.filter((srv) => isDeviceDown(srv)).length;
  }, [allIncidents]);

  const healthyCount = Math.max(0, servers.length - allIncidents.length);
  const fleetSlaPercent = servers.length > 0 ? Math.round((healthyCount / servers.length) * 100) : 100;

  // Breakdown by Error Category
  const categoryCounts = useMemo(() => {
    return {
      all: allIncidents.length,
      optical: allIncidents.filter((s) => deviceMatchesErrorCategory(s, 'optical')).length,
      ecc: allIncidents.filter((s) => deviceMatchesErrorCategory(s, 'ecc')).length,
      ram: allIncidents.filter((s) => deviceMatchesErrorCategory(s, 'ram')).length,
      cpu: allIncidents.filter((s) => deviceMatchesErrorCategory(s, 'cpu')).length,
      hardware: allIncidents.filter((s) => deviceMatchesErrorCategory(s, 'hardware')).length,
      interfaces: allIncidents.filter((s) => deviceMatchesErrorCategory(s, 'interfaces')).length,
    };
  }, [allIncidents]);

  // 2. Filter incidents according to user's selected filters
  const filteredIncidents = useMemo(() => {
    return allIncidents.filter((srv) => {
      const health = calculateDeviceHealth(srv);
      const isDown = isDeviceDown(srv);
      const isCrit = health.health === 'Critical' || isDown;

      // Severity filter
      if (severityFilter === 'critical' && !isCrit) return false;
      if (severityFilter === 'warning' && isCrit) return false;

      // Operational Status (UP / DOWN) filter
      if (statusFilter === 'online' && isDown) return false;
      if (statusFilter === 'offline' && !isDown) return false;

      // Error Category filter (Optical, ECC, RAM, CPU, Hardware, Interfaces)
      if (errorCategory !== 'all' && !deviceMatchesErrorCategory(srv, errorCategory)) {
        return false;
      }

      // Device Type filter
      if (deviceFilter !== 'all') {
        const rawType = (srv.deviceType || 'Server').toLowerCase();
        if (deviceFilter.toLowerCase() !== rawType) return false;
      }

      // Data Center filter
      if (datacenterFilter !== 'all') {
        const dcId = srv.datacenterId || '';
        const dcName = (srv.datacenterName || srv.location || '').toLowerCase();
        if (dcId !== datacenterFilter && !dcName.includes(datacenterFilter.toLowerCase())) {
          return false;
        }
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesIp = srv.ip.toLowerCase().includes(q);
        const matchesHost = (srv.hostname || '').toLowerCase().includes(q);
        const matchesBrand = (srv.brand || '').toLowerCase().includes(q);
        const matchesSerial = (srv.deviceSerial || '').toLowerCase().includes(q);
        const matchesSwId = (srv.softwareId || '').toLowerCase().includes(q);
        const matchesSummary = (health.summary || '').toLowerCase().includes(q);
        const matchesRack = (srv.rackNumber || '').toLowerCase().includes(q);

        if (!matchesIp && !matchesHost && !matchesBrand && !matchesSerial && !matchesSwId && !matchesSummary && !matchesRack) {
          return false;
        }
      }

      return true;
    });
  }, [allIncidents, severityFilter, statusFilter, errorCategory, deviceFilter, datacenterFilter, searchQuery]);

  // 3. MANDATORY REQUIREMENT: Strictly sort Critical devices at the TOP!
  const sortedIncidents = useMemo(() => {
    return [...filteredIncidents].sort((a, b) => {
      const healthA = calculateDeviceHealth(a);
      const healthB = calculateDeviceHealth(b);
      const isCritA = healthA.health === 'Critical' || healthA.isOffline || a.status === 'offline';
      const isCritB = healthB.health === 'Critical' || healthB.isOffline || b.status === 'offline';

      // 1. Critical first (0 for Critical, 1 for Warning)
      const rankA = isCritA ? 0 : 1;
      const rankB = isCritB ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;

      // 2. Offline hosts highest priority among Critical
      const offA = healthA.isOffline || a.status === 'offline' ? 0 : 1;
      const offB = healthB.isOffline || b.status === 'offline' ? 0 : 1;
      if (offA !== offB) return offA - offB;

      // 3. Higher resource saturation (RAM or CPU)
      const maxMetricA = Math.max(a.ramUsage || 0, a.cpuUsage || 0);
      const maxMetricB = Math.max(b.ramUsage || 0, b.cpuUsage || 0);
      if (maxMetricA !== maxMetricB) return maxMetricB - maxMetricA;

      return (a.hostname || '').localeCompare(b.hostname || '');
    });
  }, [filteredIncidents]);

  // 4. Pagination
  const totalPages = Math.ceil(sortedIncidents.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedServers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedIncidents.slice(start, start + pageSize);
  }, [sortedIncidents, safeCurrentPage, pageSize]);

  const hasActiveFilters = severityFilter !== 'all' || statusFilter !== 'all' || deviceFilter !== 'all' || datacenterFilter !== 'all' || errorCategory !== 'all' || !!searchQuery;

  const handleResetFilters = () => {
    setSeverityFilter('all');
    setStatusFilter('all');
    setDeviceFilter('all');
    setDatacenterFilter('all');
    setErrorCategory('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      
      {/* Top Incident Summary Banner */}
      <div className="p-4 rounded-2xl bg-base-100/90 border border-base-content/10 shadow-lg backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-base-100 animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-base-content">
                Active Fleet Incidents &amp; Alarms
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                {allIncidents.length} Alerting
              </span>
            </div>
            <p className="text-xs text-base-content/60 font-medium">
              Real-time triage of all Critical and Warning anomalies. Critical outages are strictly prioritized at the top.
            </p>
          </div>
        </div>

        {/* Quick Triage Badges & Status Filter & Switch to Fleet Dashboard */}
        <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
          {/* Quick Operational Status (UP / DOWN) Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-base-200/90 border border-base-content/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-base-100 text-base-content shadow-xs border border-base-content/10'
                  : 'text-base-content/60 hover:text-base-content'
              }`}
              title="Show all incidents"
            >
              All: {allIncidents.length}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'online' ? 'all' : 'online');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'online'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title="Filter by UP status incidents (Online devices with telemetry alerts)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>UP: {upIncidentCount}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'offline' ? 'all' : 'offline');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'offline'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-rose-500 hover:bg-rose-500/10'
              }`}
              title="Filter by DOWN status outages (Offline/unreachable devices)"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>DOWN: {downIncidentCount}</span>
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-base-200/80 border border-base-content/10 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-rose-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Critical: {criticalCount}
            </span>
            <span className="text-base-content/30">•</span>
            <span className="flex items-center gap-1.5 text-amber-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Warning: {warningCount}
            </span>
          </div>

          {/* Jump to Full Fleet Dashboard button */}
          <button
            onClick={onNavigateToDashboard}
            className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 hover:scale-[1.02] transition-transform"
          >
            <span>View All Fleet Devices ({servers.length})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Incident Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch lg:h-[calc(100vh-13.5rem)] min-w-0">
        
        {/* Left Sidebar: Incident Metric Cards & Filters */}
        <aside 
          aria-label="Incident filters and severity breakdown"
          className="w-full lg:w-64 xl:w-72 shrink-0 lg:h-full lg:overflow-y-auto pr-1 pt-1 pb-1 space-y-2.5"
        >
          {/* 1. All Active Incidents Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setSeverityFilter('all');
              setCurrentPage(1);
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSeverityFilter('all')}
            className={`group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
              severityFilter === 'all'
                ? 'bg-gradient-to-b from-rose-500/[0.08] to-base-100 border-rose-500/60 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/40 -translate-y-0.5'
                : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-rose-500/40 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${
                  severityFilter === 'all'
                    ? 'bg-rose-500 text-white shadow-xs shadow-rose-500/30'
                    : 'bg-base-200 text-base-content/70 group-hover:text-rose-500 group-hover:bg-rose-500/10'
                }`}>
                  <AlertOctagon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 truncate">
                    Incident Queue
                  </div>
                  <div className="text-xs font-bold text-base-content truncate">
                    Total Incidents
                  </div>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border shrink-0 ${
                severityFilter === 'all'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  : 'bg-base-200 border-base-content/10 text-base-content/60'
              }`}>
                {allIncidents.length}
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono tracking-tight text-base-content">
                {allIncidents.length}
              </div>
              <span className="text-[10px] font-bold text-rose-500">
                {allIncidents.length > 0 ? 'Active Triage' : 'Queue Empty'}
              </span>
            </div>
          </div>

          {/* 2. Critical Outages Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setSeverityFilter('critical');
              setCurrentPage(1);
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSeverityFilter('critical')}
            className={`group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
              severityFilter === 'critical'
                ? 'bg-gradient-to-b from-rose-500/[0.12] to-base-100 border-rose-500 shadow-md shadow-rose-500/20 ring-1 ring-rose-500/50 -translate-y-0.5'
                : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-rose-500/40 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${
                  severityFilter === 'critical'
                    ? 'bg-rose-500 text-white shadow-xs shadow-rose-500/30'
                    : 'bg-rose-500/10 text-rose-500'
                }`}>
                  <ShieldAlert className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 truncate">
                    High Priority
                  </div>
                  <div className="text-xs font-bold text-base-content truncate">
                    Critical Outages
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 shrink-0">
                {criticalCount}
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono tracking-tight text-rose-500">
                {criticalCount}
              </div>
              <span className="text-[10px] font-semibold text-base-content/50">
                Top Priority
              </span>
            </div>
          </div>

          {/* 3. Warning Degradations Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setSeverityFilter('warning');
              setCurrentPage(1);
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSeverityFilter('warning')}
            className={`group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
              severityFilter === 'warning'
                ? 'bg-gradient-to-b from-amber-500/[0.12] to-base-100 border-amber-500 shadow-md shadow-amber-500/20 ring-1 ring-amber-500/50 -translate-y-0.5'
                : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-amber-500/40 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${
                  severityFilter === 'warning'
                    ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/30'
                    : 'bg-amber-500/10 text-amber-500'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 truncate">
                    Degraded SLA
                  </div>
                  <div className="text-xs font-bold text-base-content truncate">
                    Warning Alerts
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                {warningCount}
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono tracking-tight text-amber-500">
                {warningCount}
              </div>
              <span className="text-[10px] font-semibold text-base-content/50">
                Action Required
              </span>
            </div>
          </div>

          {/* Quick Filter Controls */}
          <div className="p-3.5 rounded-xl bg-base-100/90 border border-base-content/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                <span>Incident Filters</span>
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Device Operational Status (UP / DOWN) Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 block mb-1">
                Device Status
              </label>
              <div className="grid grid-cols-3 gap-1 bg-base-200/60 p-1 rounded-xl border border-base-content/10 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-1.5 font-semibold rounded-lg transition-all text-center cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-base-100 text-primary shadow-xs font-bold border border-base-content/10'
                      : 'text-base-content/60 hover:text-base-content'
                  }`}
                >
                  All ({allIncidents.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('online');
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    statusFilter === 'online'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold ring-1 ring-emerald-500/30'
                      : 'text-base-content/60 hover:text-emerald-500'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>UP ({upIncidentCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('offline');
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    statusFilter === 'offline'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-xs font-bold ring-1 ring-rose-500/30'
                      : 'text-base-content/60 hover:text-rose-500'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>DOWN ({downIncidentCount})</span>
                </button>
              </div>
            </div>

            {/* Device Type Quick Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 block mb-1">
                Device Type
              </label>
              <div className="grid grid-cols-2 gap-1 text-[11px] font-medium">
                {['all', 'Server', 'Router', 'Switch', 'OLT'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setDeviceFilter(t);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-1.5 rounded-lg text-left transition-colors font-mono ${
                      deviceFilter.toLowerCase() === t.toLowerCase()
                        ? 'bg-primary text-primary-content font-bold'
                        : 'bg-base-200/80 hover:bg-base-200 text-base-content/70'
                    }`}
                  >
                    {t === 'all' ? 'All Types' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Center Filter */}
            {datacenters.length > 0 && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 block mb-1">
                  Data Center
                </label>
                <DatacenterDropdown
                  datacenters={datacenters}
                  selectedId={datacenterFilter}
                  onSelect={(id) => {
                    setDatacenterFilter(id);
                    setCurrentPage(1);
                  }}
                  allowAll={true}
                  totalCount={datacenters.length}
                  size="sm"
                />
              </div>
            )}
          </div>

          {/* Fleet SLA Health Card */}
          <div className="p-3.5 rounded-xl bg-base-100/90 border border-base-content/10 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-base-content/70 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                Fleet SLA Health
              </span>
              <span className="font-mono font-bold text-emerald-500">{fleetSlaPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${fleetSlaPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-base-content/50 leading-relaxed">
              {healthyCount} of {servers.length} devices operating in 100% nominal conditions.
            </p>
          </div>
        </aside>

        {/* Right Section: Incident Table with Active Issues Column & Internal Scroll */}
        <section 
          aria-label="Incident telemetry and alarms" 
          className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden"
        >
          {/* Error Category Quick Filter Pills Bar */}
          <div className="mb-2.5 p-2 rounded-xl bg-base-100/90 border border-base-content/10 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <span>Error Filter:</span>
              </span>

              {/* All Anomalies */}
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  errorCategory === 'all'
                    ? 'bg-primary text-primary-content border-primary font-bold shadow-xs'
                    : 'bg-base-200/70 hover:bg-base-200 text-base-content/80 border-base-content/10'
                }`}
              >
                <span>All Anomalies</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  errorCategory === 'all' ? 'bg-primary-content/20 text-primary-content' : 'bg-base-300 text-base-content/70'
                }`}>
                  {categoryCounts.all}
                </span>
              </button>

              {/* Optical Tx/Rx */}
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('optical');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  errorCategory === 'optical'
                    ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-xs'
                    : 'bg-base-200/70 hover:bg-base-200 text-base-content/80 border-base-content/10'
                }`}
              >
                <Radio className="w-3 h-3 text-sky-400" />
                <span>Optical Tx/Rx</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  errorCategory === 'optical' ? 'bg-white/20 text-white' : 'bg-base-300 text-base-content/70'
                }`}>
                  {categoryCounts.optical}
                </span>
              </button>

              {/* ECC Memory (ERC) */}
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('ecc');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  errorCategory === 'ecc'
                    ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                    : 'bg-base-200/70 hover:bg-base-200 text-base-content/80 border-base-content/10'
                }`}
              >
                <ShieldAlert className="w-3 h-3 text-purple-400" />
                <span>ECC Memory (ERC)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  errorCategory === 'ecc' ? 'bg-white/20 text-white' : 'bg-base-300 text-base-content/70'
                }`}>
                  {categoryCounts.ecc}
                </span>
              </button>

              {/* RAM Usage */}
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('ram');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  errorCategory === 'ram'
                    ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                    : 'bg-base-200/70 hover:bg-base-200 text-base-content/80 border-base-content/10'
                }`}
              >
                <Layers className="w-3 h-3 text-amber-400" />
                <span>RAM Usage</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  errorCategory === 'ram' ? 'bg-white/20 text-white' : 'bg-base-300 text-base-content/70'
                }`}>
                  {categoryCounts.ram}
                </span>
              </button>

              {/* Compute CPU */}
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('cpu');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  errorCategory === 'cpu'
                    ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs'
                    : 'bg-base-200/70 hover:bg-base-200 text-base-content/80 border-base-content/10'
                }`}
              >
                <Cpu className="w-3 h-3 text-rose-400" />
                <span>Compute CPU</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  errorCategory === 'cpu' ? 'bg-white/20 text-white' : 'bg-base-300 text-base-content/70'
                }`}>
                  {categoryCounts.cpu}
                </span>
              </button>

              {/* Hardware PSU / Fans */}
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('hardware');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  errorCategory === 'hardware'
                    ? 'bg-orange-600 text-white border-orange-600 font-bold shadow-xs'
                    : 'bg-base-200/70 hover:bg-base-200 text-base-content/80 border-base-content/10'
                }`}
              >
                <Zap className="w-3 h-3 text-orange-400" />
                <span>Hardware PSU / Fans</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  errorCategory === 'hardware' ? 'bg-white/20 text-white' : 'bg-base-300 text-base-content/70'
                }`}>
                  {categoryCounts.hardware}
                </span>
              </button>

              {/* Interfaces Down / CRC */}
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('interfaces');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  errorCategory === 'interfaces'
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                    : 'bg-base-200/70 hover:bg-base-200 text-base-content/80 border-base-content/10'
                }`}
              >
                <Network className="w-3 h-3 text-emerald-400" />
                <span>Interfaces / CRC</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  errorCategory === 'interfaces' ? 'bg-white/20 text-white' : 'bg-base-300 text-base-content/70'
                }`}>
                  {categoryCounts.interfaces}
                </span>
              </button>
            </div>

            {errorCategory !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setErrorCategory('all');
                  setCurrentPage(1);
                }}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Error Filter</span>
              </button>
            )}
          </div>

          <ServerTable
            servers={paginatedServers}
            selectedServer={selectedServer}
            onSelectServer={onSelectServer}
            onInspectServer={onInspectServer}
            onEditServer={currentUserRole !== 'viewer' ? onEditServer : undefined}
            onDeleteServer={currentUserRole === 'admin' ? onDeleteServer : undefined}
            onPollDevice={onPollDevice}
            pollingDeviceIds={pollingDeviceIds}
            searchQuery={searchQuery}
            setSearchQuery={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            totalFilteredCount={sortedIncidents.length}
            statusFilter={statusFilter}
            deviceFilter={deviceFilter}
            healthFilter={severityFilter}
            datacenters={datacenters}
            datacenterFilter={datacenterFilter}
            onSelectDatacenterFilter={(id) => {
              setDatacenterFilter(id);
              setCurrentPage(1);
            }}
            onClearSearch={() => setSearchQuery('')}
            onClearAllFilters={handleResetFilters}
            isIncidentsMode={true}
            errorCategory={errorCategory}
          >
            {/* Pagination Controls at Bottom of Table Card */}
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              totalItems={sortedIncidents.length}
              virtualTotalEstimate={allIncidents.length}
            />
          </ServerTable>
        </section>
      </div>
    </div>
  );
};

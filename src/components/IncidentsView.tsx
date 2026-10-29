import React, { useState, useMemo } from 'react';
import { Server, Datacenter } from '../types';
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
  Filter
} from 'lucide-react';
import { DatacenterDropdown } from './DatacenterDropdown';

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
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [datacenterFilter, setDatacenterFilter] = useState<string>('all');
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

  const healthyCount = Math.max(0, servers.length - allIncidents.length);
  const fleetSlaPercent = servers.length > 0 ? Math.round((healthyCount / servers.length) * 100) : 100;

  // 2. Filter incidents according to user's selected filters
  const filteredIncidents = useMemo(() => {
    return allIncidents.filter((srv) => {
      const health = calculateDeviceHealth(srv);
      const isCrit = health.health === 'Critical' || health.isOffline || srv.status === 'offline';

      // Severity filter
      if (severityFilter === 'critical' && !isCrit) return false;
      if (severityFilter === 'warning' && isCrit) return false;

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
  }, [allIncidents, severityFilter, deviceFilter, datacenterFilter, searchQuery]);

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

  const hasActiveFilters = severityFilter !== 'all' || deviceFilter !== 'all' || datacenterFilter !== 'all' || !!searchQuery;

  const handleResetFilters = () => {
    setSeverityFilter('all');
    setDeviceFilter('all');
    setDatacenterFilter('all');
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

        {/* Quick Triage Badges & Switch to Fleet Dashboard */}
        <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-base-200/80 border border-base-content/10 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-rose-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Critical: {criticalCount}
            </span>
            <span className="text-base-content/30">•</span>
            <span className="flex items-center gap-1.5 text-amber-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Warning: {warningCount}
            </span>
            <span className="text-base-content/30">•</span>
            <span className="flex items-center gap-1.5 text-emerald-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Nominal: {healthyCount}
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
            statusFilter="all"
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

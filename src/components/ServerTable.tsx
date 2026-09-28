import React from 'react';
import { Server, StatusFilter, Datacenter } from '../types';
import { DatacenterDropdown } from './DatacenterDropdown';
import { BrandLogo } from './BrandLogo';
import { formatRack } from '../utils/rack';
import { 
  Search, 
  ChevronRight, 
  MapPin, 
  AlertTriangle,
  X,
  RotateCcw,
  SlidersHorizontal,
  Command,
  Server as ServerIcon,
  Building2,
  Pencil,
  Trash2,
  MoreVertical
} from 'lucide-react';

interface ServerTableProps {
  servers: Server[];
  selectedServer: Server | null;
  onSelectServer: (server: Server) => void;
  onInspectServer?: (server: Server) => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  totalFilteredCount: number;
  statusFilter?: StatusFilter;
  deviceFilter?: string;
  healthFilter?: string;
  datacenters?: Datacenter[];
  datacenterFilter?: string;
  onSelectDatacenterFilter?: (dcId: string) => void;
  onClearSearch?: () => void;
  onClearAllFilters?: () => void;
  children?: React.ReactNode;
}

export const ServerTable: React.FC<ServerTableProps> = ({
  servers,
  selectedServer,
  onSelectServer,
  onInspectServer,
  onEditServer,
  onDeleteServer,
  searchQuery,
  setSearchQuery,
  totalFilteredCount,
  statusFilter = 'all',
  deviceFilter = 'all',
  healthFilter = 'all',
  datacenters = [],
  datacenterFilter = 'all',
  onSelectDatacenterFilter,
  onClearSearch,
  onClearAllFilters,
  children,
}) => {
  const handleInspect = (server: Server) => {
    if (onInspectServer) {
      onInspectServer(server);
    } else {
      onSelectServer(server);
    }
  };

  // Helper for resource indicator color
  const getResourceColor = (val: number) => {
    if (val < 70) return 'text-emerald-500';
    if (val <= 85) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getResourceBarColor = (val: number) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
    if (val <= 85) return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]';
  };

  // Small, sleek Device Type Badge (Server, Router, Switch, OLT)
  const renderDeviceBadge = (type?: string) => {
    const raw = (type || 'Server').toLowerCase();
    if (raw === 'router' || raw === 'mikrotik') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0">
          Router
        </span>
      );
    }
    if (raw === 'switch') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shrink-0">
          Switch
        </span>
      );
    }
    if (raw === 'olt') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
          OLT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shrink-0">
        Server
      </span>
    );
  };

  const hasAnyFilterActive = statusFilter !== 'all' || deviceFilter !== 'all' || healthFilter !== 'all' || !!searchQuery;

  return (
    <div className="rounded-2xl border border-base-content/10 bg-base-100/95 shadow-xl overflow-hidden backdrop-blur-md flex flex-col h-full min-h-[460px] lg:max-h-[calc(100vh-6rem)]">
      
      {/* Prominent Search Bar & Telemetry Controls Header (Pinned at Top) */}
      <div className="shrink-0 p-3.5 sm:p-4 border-b border-base-content/10 bg-base-100/80 space-y-2.5">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Prominent Search Input Box */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <input
              type="text"
              id="server-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices by IP address, hostname, device type (Server, Router, Switch, OLT), rack..."
              className="w-full pl-10 pr-24 py-2 text-xs sm:text-sm rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/25 text-base-content placeholder:text-base-content/40 transition-all outline-none shadow-inner"
            />
            
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  onClick={() => (onClearSearch ? onClearSearch() : setSearchQuery(''))}
                  className="p-1 rounded-md text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
                  aria-label="Clear search"
                  title="Clear search (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-base-content/40 bg-base-200 border border-base-content/10 rounded">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </div>
          </div>

          {/* Live Node Telemetry Counter Pill */}
          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
            {/* Fast Data Center Filter Dropdown in Table Header */}
            {onSelectDatacenterFilter && (
              <div className="w-44 sm:w-56">
                <DatacenterDropdown
                  datacenters={datacenters}
                  selectedId={datacenterFilter || 'all'}
                  onSelect={onSelectDatacenterFilter}
                  allowAll={true}
                  totalCount={datacenters.length}
                  size="sm"
                />
              </div>
            )}

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-base-200/80 border border-base-content/10 text-base-content/70">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span>Telemetry:</span>
              <span className="font-bold text-base-content">{servers.length}</span>
              <span className="text-base-content/40">/</span>
              <span className="font-bold text-primary">{totalFilteredCount}</span>
              <span className="text-base-content/50">devices</span>
            </span>
          </div>
        </div>

        {/* Active Filter Chips & Quick Suggestions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs min-w-0">
            <span className="text-base-content/50 text-[11px] font-medium mr-1 flex items-center gap-1 shrink-0">
              <SlidersHorizontal className="w-3 h-3" />
              Active Scopes:
            </span>

            {/* Datacenter Chip */}
            {datacenterFilter && datacenterFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-primary/15 border-primary/30 text-primary">
                <Building2 className="w-3 h-3" />
                <span>DC: {datacenters.find((d) => String(d.id) === String(datacenterFilter))?.name || datacenterFilter}</span>
              </span>
            )}

            {/* Status Chip */}
            {statusFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                statusFilter === 'online'
                  ? 'bg-success/15 border-success/30 text-success'
                  : 'bg-error/15 border-error/30 text-error'
              }`}>
                <span>Status: {statusFilter.toUpperCase()}</span>
              </span>
            )}

            {/* Device Chip */}
            {deviceFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-primary/15 border-primary/30 text-primary">
                <span>Type: {deviceFilter}</span>
              </span>
            )}

            {/* Health Chip */}
            {healthFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400">
                <span>Health: {healthFilter === 'critical' ? 'Critical' : healthFilter === 'warning' ? 'Warning' : 'Nominal'}</span>
              </span>
            )}

            {/* Query Chip */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-base-200 border-base-content/15 text-base-content max-w-xs truncate">
                <span>Query: &ldquo;{searchQuery}&rdquo;</span>
                <button
                  onClick={() => (onClearSearch ? onClearSearch() : setSearchQuery(''))}
                  className="hover:text-error ml-0.5 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {!hasAnyFilterActive && (
              <span className="text-[11px] text-base-content/40 italic">
                Showing all fleet devices unfiltered
              </span>
            )}
          </div>

          {/* Quick Clear Button */}
          {hasAnyFilterActive && onClearAllFilters && (
            <button
              onClick={onClearAllFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Modern High-Density Table with Internal Scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          {/* Sticky Table Header with exactly the 6 requested columns */}
          <thead className="sticky top-0 z-10 bg-base-200/95 backdrop-blur-md shadow-xs">
            <tr className="border-b border-base-content/10 text-[11px] font-bold uppercase tracking-wider text-base-content/60 select-none">
              <th className="py-2.5 px-3.5">Device &amp; Identity</th>
              <th className="py-2.5 px-3.5 text-center">Status</th>
              <th className="py-2.5 px-3.5">Health Telemetry</th>
              <th className="py-2.5 px-3.5 hidden md:table-cell">Core Resources</th>
              <th className="py-2.5 px-3.5 hidden lg:table-cell">Location &amp; Rack</th>
              <th className="py-2.5 px-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-content/5">
            {servers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 px-4">
                  <div className="max-w-xs mx-auto flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning shadow-md shadow-warning/5">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-base-content text-sm">No devices match criteria</p>
                    <p className="text-xs text-base-content/60 text-center">
                      Try adjusting or clearing your search query or device filter to inspect other devices in the fleet.
                    </p>
                    {hasAnyFilterActive && onClearAllFilters && (
                      <button
                        onClick={onClearAllFilters}
                        className="btn btn-sm btn-primary rounded-xl mt-1 text-xs"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              servers.map((server, index) => {
                const isSelected = selectedServer?.id === server.id;
                const isOnline = server.status === 'online';

                return (
                  <tr
                    key={server.id}
                    id={`server-row-${server.id}`}
                    onClick={() => handleInspect(server)}
                    className={`group cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-primary/10 hover:bg-primary/15'
                        : 'hover:bg-base-200/60'
                    }`}
                  >
                    {/* 1. Node & Identity: IP Address, Hostname, Brand Logo & Name, Device Type Badge */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Live Ping Beacon */}
                        <span className="relative flex h-2 w-2 shrink-0">
                          {isOnline ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                            </>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                          )}
                        </span>

                        {/* Brand Logo next to Node IP */}
                        <BrandLogo brand={server.brand} size="sm" />

                        {/* Node IP Address */}
                        <span className="font-mono text-xs font-bold text-base-content group-hover:text-primary transition-colors tracking-tight">
                          {server.ip}
                        </span>

                        {/* Device Type Badge (Server, Router, Switch, OLT) */}
                        {renderDeviceBadge(server.deviceType)}
                      </div>

                      {/* Hostname, Brand Name & Node ID */}
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-base-content/70">
                        <span className="font-semibold truncate max-w-[190px] group-hover:text-primary transition-colors">
                          {server.hostname}
                        </span>
                        {server.brand && (
                          <span className="text-[10px] font-mono font-medium text-base-content/60">
                            • {server.brand}
                          </span>
                        )}
                        <span className="text-[10px] text-base-content/40 font-mono">
                          • {server.id}
                        </span>
                      </div>
                    </td>

                    {/* 2. Status: Glowing UP/DOWN badge */}
                    <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border transition-all ${
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.2)] animate-pulse'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span>{isOnline ? 'UP' : 'DOWN'}</span>
                      </span>
                    </td>

                    {/* 3. Health Telemetry: Normal / Warning / Critical */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div>
                        {server.health === 'Normal' && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            Normal
                          </span>
                        )}
                        {(server.health === 'Warning' || server.health === 'High CPU') && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            Warning
                          </span>
                        )}
                        {server.health === 'Critical' && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                            Critical
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-base-content/40 font-mono mt-0.5">
                        {isOnline ? `Up: ${server.uptime}` : 'Host Unreachable'}
                      </div>
                      <div className="text-[10px] text-base-content/40 font-mono">
                        {server.lastPolledAt && !isNaN(new Date(server.lastPolledAt).getTime())
                          ? `Last polled: ${new Date(server.lastPolledAt).toLocaleTimeString([], {
                              hour12: false,
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}`
                          : 'Never polled'}
                      </div>
                    </td>

                    {/* 4. Core Resources: CPU Usage (%) for all device types, RAM Usage (%) only for Server, plus PSU chips */}
                    <td className="py-2.5 px-3.5 hidden md:table-cell">
                      {isOnline ? (
                        <div className="space-y-1.5 w-44 sm:w-52">
                          {server.metricsAvailable === false ? (
                            <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                              <span className="text-base-content/50">CPU</span>
                              <span className="text-base-content/40 font-semibold">N/A</span>
                            </div>
                          ) : (
                            <>
                              {/* CPU Meter */}
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono leading-none mb-0.5">
                                  <span className="text-base-content/50">CPU</span>
                                  <span className={`font-bold ${getResourceColor(server.cpuUsage)}`}>
                                    {server.cpuUsage}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-300 ${getResourceBarColor(server.cpuUsage)}`}
                                    style={{ width: `${server.cpuUsage}%` }}
                                  />
                                </div>
                              </div>

                              {/* RAM Meter (Server only) */}
                              {server.deviceType === 'Server' && (
                                <div>
                                  <div className="flex items-center justify-between text-[10px] font-mono leading-none mb-0.5">
                                    <span className="text-base-content/50">RAM</span>
                                    <span className={`font-bold ${getResourceColor(server.ramUsage)}`}>
                                      {server.ramUsage}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${getResourceBarColor(server.ramUsage)}`}
                                      style={{ width: `${server.ramUsage}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* PSU compact row */}
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono leading-tight">
                            <span className="text-base-content/50 shrink-0">PSU</span>
                            {Array.isArray(server.powerSupplies) && server.powerSupplies.length > 0 ? (
                              <div className="flex flex-wrap justify-end gap-1">
                                {server.powerSupplies.map((psu, idx) => {
                                  const rawVal = (psu as { raw_value?: number | null }).raw_value;
                                  const rawMatch = psu.name?.match(/^psu(\d+)-state$/i);
                                  const displayLabel = rawMatch ? `PSU ${rawMatch[1]}` : (psu.name || `PSU ${idx + 1}`);
                                  const chipColor =
                                    psu.status === 'ok'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                      : psu.status === 'warning'
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                      : psu.status === 'critical'
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                      : 'bg-base-300/60 text-base-content/50 border-base-content/15';
                                  const tooltip = `${displayLabel}: ${psu.status}${
                                    rawVal !== undefined && rawVal !== null ? `, raw value ${rawVal}` : ''
                                  }`;
                                  return (
                                    <span
                                      key={`${displayLabel}-${idx}`}
                                      title={tooltip}
                                      className={`px-1.5 py-0.5 rounded border text-[9px] leading-none font-semibold whitespace-nowrap ${chipColor}`}
                                    >
                                      {displayLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-base-content/40">N/A</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-rose-500 font-mono">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Telemetry Unreachable</span>
                        </div>
                      )}
                    </td>

                    {/* 5. Location & Rack */}
                    <td className="py-2.5 px-3.5 hidden lg:table-cell text-xs text-base-content/70 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[140px] font-semibold text-base-content">
                          {server.datacenterName || server.location.split(' ')[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-base-content/50 ml-5">
                        <span className="truncate max-w-[110px]">{server.location}</span>
                        <span>•</span>
                        <span>{formatRack(server.rackNumber) || 'Unassigned'}</span>
                      </div>
                    </td>

                    {/* 6. Action: Inspect button + 3-dot dropdown menu */}
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleInspect(server)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-primary-content transition-all duration-200 shadow-xs group/btn"
                          aria-label={`Inspect ${server.hostname}`}
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                        </button>

                        {(onEditServer || onDeleteServer) && (
                          <div className={`dropdown dropdown-end ${index >= servers.length - 2 && servers.length > 2 ? 'dropdown-top' : 'dropdown-bottom'}`}>
                            <div
                              tabIndex={0}
                              role="button"
                              className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
                              title={`More actions for ${server.hostname}`}
                              aria-label={`More actions for ${server.hostname}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </div>
                            <ul
                              tabIndex={0}
                              className="dropdown-content menu z-50 p-1.5 shadow-2xl bg-base-100 border border-base-content/10 rounded-xl w-36 text-xs text-base-content font-medium opacity-100"
                            >
                              {onEditServer && (
                                <li>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      (document.activeElement as HTMLElement)?.blur();
                                      onEditServer(server);
                                    }}
                                    className="flex items-center gap-2 py-2 px-2.5 rounded-lg text-base-content hover:text-primary hover:bg-primary/10 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-base-content/70" />
                                    <span>Edit</span>
                                  </button>
                                </li>
                              )}
                              {onDeleteServer && (
                                <li>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      (document.activeElement as HTMLElement)?.blur();
                                      onDeleteServer(server);
                                    }}
                                    className="flex items-center gap-2 py-2 px-2.5 rounded-lg text-error hover:bg-error/10 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-error" />
                                    <span>Delete</span>
                                  </button>
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Slot */}
      {children && (
        <div className="shrink-0 border-t border-base-content/10 bg-base-100/95">
          {children}
        </div>
      )}
    </div>
  );
};

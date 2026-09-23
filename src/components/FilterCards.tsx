import React from 'react';
import { StatusFilter, Datacenter } from '../types';
import { DatacenterDropdown } from './DatacenterDropdown';
import { 
  CheckCircle2, 
  XCircle, 
  Layers, 
  ArrowUpRight,
  SlidersHorizontal,
  RotateCcw,
  ShieldCheck,
  Building2,
  Plus
} from 'lucide-react';

interface FilterCardsProps {
  currentFilter: StatusFilter;
  onSelectFilter: (filter: StatusFilter) => void;
  totalCount: number;
  onlineCount: number;
  offlineCount: number;
  mockEstimatedTotal?: string;
  deviceFilter?: string;
  onSelectDeviceFilter?: (device: string) => void;
  healthFilter?: 'all' | 'normal' | 'critical';
  onSelectHealthFilter?: (health: 'all' | 'normal' | 'critical') => void;
  datacenters?: Datacenter[];
  datacenterFilter?: string;
  onSelectDatacenterFilter?: (dcId: string) => void;
  onOpenDcModal?: () => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
}

export const FilterCards: React.FC<FilterCardsProps> = ({
  currentFilter,
  onSelectFilter,
  totalCount,
  onlineCount,
  offlineCount,
  mockEstimatedTotal = '10,482',
  deviceFilter = 'all',
  onSelectDeviceFilter,
  healthFilter = 'all',
  onSelectHealthFilter,
  datacenters = [],
  datacenterFilter = 'all',
  onSelectDatacenterFilter,
  onOpenDcModal,
  onResetFilters,
  hasActiveFilters = false,
}) => {
  const onlinePercent = Math.round((onlineCount / (totalCount || 1)) * 100);
  const offlinePercent = Math.round((offlineCount / (totalCount || 1)) * 100);

  return (
    <div className="flex flex-col gap-2.5">
      {/* 3 Summary / Stats Cards Stacked Vertically - Compact & Slim Design */}
      <div className="flex flex-col gap-2">
        
        {/* 1. Total (10k+) Fleet Capacity Card */}
        <div
          role="button"
          tabIndex={0}
          id="stat-card-total"
          onClick={() => onSelectFilter('all')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectFilter('all')}
          className={`group relative overflow-hidden rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
            currentFilter === 'all'
              ? 'bg-gradient-to-b from-primary/[0.08] to-base-100 border-primary shadow-md shadow-primary/10 ring-1 ring-primary/40 -translate-y-0.5'
              : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-primary/40 hover:shadow-xs hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentFilter === 'all'
                  ? 'bg-primary text-primary-content shadow-xs shadow-primary/30'
                  : 'bg-base-200 text-base-content/70 group-hover:text-primary group-hover:bg-primary/10'
              }`}>
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 truncate">
                  Fleet Capacity
                </div>
                <div className="text-xs font-bold text-base-content truncate">
                  Total (10k+)
                </div>
              </div>
            </div>

            <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full border shrink-0 transition-colors ${
              currentFilter === 'all'
                ? 'bg-primary/15 border-primary/30 text-primary font-bold'
                : 'bg-base-200/80 border-base-content/10 text-base-content/60'
            }`}>
              {currentFilter === 'all' ? 'Active' : 'All'}
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <div className="text-xl font-black tracking-tight font-mono text-base-content">
                {mockEstimatedTotal}
              </div>
              <p className="text-[10px] text-base-content/50 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
                <span className="truncate">{totalCount} telemetry nodes</span>
              </p>
            </div>
            
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-primary flex items-center justify-end gap-0.5 group-hover:translate-x-0.5 transition-transform">
                <span>View</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          <div className="mt-2 h-1 w-full bg-base-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full w-full opacity-80" />
          </div>
        </div>

        {/* 2. Online SLA Card */}
        <div
          role="button"
          tabIndex={0}
          id="stat-card-online"
          onClick={() => onSelectFilter('online')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectFilter('online')}
          className={`group relative overflow-hidden rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
            currentFilter === 'online'
              ? 'bg-gradient-to-b from-success/[0.08] to-base-100 border-success shadow-md shadow-success/15 ring-1 ring-success/40 -translate-y-0.5'
              : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-success/40 hover:shadow-xs hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentFilter === 'online'
                  ? 'bg-success text-success-content shadow-xs shadow-success/30'
                  : 'bg-base-200 text-base-content/70 group-hover:text-success group-hover:bg-success/10'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 truncate">
                  Operational SLA
                </div>
                <div className="text-xs font-bold text-success flex items-center gap-1 truncate">
                  <span>Online Devices</span>
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                  </span>
                </div>
              </div>
            </div>

            <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full border shrink-0 transition-colors ${
              currentFilter === 'online'
                ? 'bg-success/15 border-success/30 text-success font-bold'
                : 'bg-base-200/80 border-base-content/10 text-base-content/60'
            }`}>
              {onlinePercent}% Nominal
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <div className="text-xl font-black tracking-tight font-mono text-success">
                {onlineCount}
              </div>
              <p className="text-[10px] text-base-content/50 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0"></span>
                <span className="truncate">Active heartbeats</span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-success flex items-center justify-end gap-0.5 group-hover:translate-x-0.5 transition-transform">
                <span>Filter</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          <div className="mt-2 h-1 w-full bg-base-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-success rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
              style={{ width: `${onlinePercent}%` }}
            />
          </div>
        </div>

        {/* 3. Offline Incidents Card */}
        <div
          role="button"
          tabIndex={0}
          id="stat-card-offline"
          onClick={() => onSelectFilter('offline')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectFilter('offline')}
          className={`group relative overflow-hidden rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
            currentFilter === 'offline'
              ? 'bg-gradient-to-b from-error/[0.08] to-base-100 border-error shadow-md shadow-error/15 ring-1 ring-error/40 -translate-y-0.5'
              : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-error/40 hover:shadow-xs hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentFilter === 'offline'
                  ? 'bg-error text-error-content shadow-xs shadow-error/30'
                  : 'bg-base-200 text-base-content/70 group-hover:text-error group-hover:bg-error/10'
              }`}>
                <XCircle className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 truncate">
                  Incident Response
                </div>
                <div className="text-xs font-bold text-error flex items-center gap-1 truncate">
                  <span>Offline Outages</span>
                  {offlineCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse shrink-0" />
                  )}
                </div>
              </div>
            </div>

            <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full border shrink-0 transition-colors ${
              currentFilter === 'offline'
                ? 'bg-error/15 border-error/30 text-error font-bold'
                : 'bg-base-200/80 border-base-content/10 text-base-content/60'
            }`}>
              {offlineCount} Out
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <div className="text-xl font-black tracking-tight font-mono text-error">
                {offlineCount}
              </div>
              <p className="text-[10px] text-base-content/50 mt-0.5 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${offlineCount > 0 ? 'bg-error' : 'bg-base-content/30'}`}></span>
                <span className="truncate">SRE triage needed</span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-error flex items-center justify-end gap-0.5 group-hover:translate-x-0.5 transition-transform">
                <span>Filter</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          <div className="mt-2 h-1 w-full bg-base-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-error rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
              style={{ width: `${Math.max(offlineCount > 0 ? 15 : 0, offlinePercent)}%` }}
            />
          </div>
        </div>

      </div>

      {/* Quick Filters Panel - Compact Sizing */}
      <div 
        id="quick-filters-panel"
        className="rounded-xl border border-base-content/10 bg-base-100/90 shadow-xs p-3 space-y-2.5 backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-base-content/10 pb-2">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/80">
              Quick Filters
            </span>
          </div>

          {hasActiveFilters && onResetFilters && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Filter 0: Data Center Scope */}
        {onSelectDatacenterFilter && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-base-content/60 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-primary" />
                <span>Data Center Facility</span>
              </label>
              {onOpenDcModal && (
                <button
                  type="button"
                  onClick={onOpenDcModal}
                  className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Manage</span>
                </button>
              )}
            </div>

            <DatacenterDropdown
              datacenters={datacenters}
              selectedId={datacenterFilter || 'all'}
              onSelect={onSelectDatacenterFilter}
              onOpenDcModal={onOpenDcModal}
              allowAll={true}
              totalCount={totalCount}
              size="sm"
            />
          </div>
        )}

        {/* Filter 1: Status Scope */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-base-content/60">
            Node Status
          </label>
          <div className="grid grid-cols-3 gap-1 bg-base-200/60 p-0.5 rounded-lg border border-base-content/10">
            <button
              type="button"
              onClick={() => onSelectFilter('all')}
              className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                currentFilter === 'all'
                  ? 'bg-base-100 text-primary shadow-xs font-bold'
                  : 'text-base-content/60 hover:text-base-content'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onSelectFilter('online')}
              className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${
                currentFilter === 'online'
                  ? 'bg-success/15 text-success shadow-xs font-bold'
                  : 'text-base-content/60 hover:text-success'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span>UP</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectFilter('offline')}
              className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${
                currentFilter === 'offline'
                  ? 'bg-error/15 text-error shadow-xs font-bold'
                  : 'text-base-content/60 hover:text-error'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
              <span>DOWN</span>
            </button>
          </div>
        </div>

        {/* Filter 2: Device Type */}
        {onSelectDeviceFilter && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-base-content/60">
              Device Type
            </label>
            <div className="flex flex-wrap gap-1 bg-base-200/60 p-1 rounded-lg border border-base-content/10">
              {['all', 'Server', 'MikroTik', 'Switch', 'OLT'].map((dtype) => {
                const isSelected = (deviceFilter || 'all').toLowerCase() === dtype.toLowerCase();
                return (
                  <button
                    key={dtype}
                    type="button"
                    onClick={() => onSelectDeviceFilter(dtype)}
                    className={`flex-1 min-w-[42px] px-1.5 py-1 text-[10px] font-semibold rounded-md text-center transition-all ${
                      isSelected
                        ? 'bg-base-100 text-primary shadow-xs font-bold'
                        : 'text-base-content/60 hover:text-base-content hover:bg-base-100/50'
                    }`}
                  >
                    {dtype === 'all' ? 'All' : dtype}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter 3: Health Threshold */}
        {onSelectHealthFilter && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-base-content/60">
              Health Telemetry
            </label>
            <div className="grid grid-cols-3 gap-1 bg-base-200/60 p-0.5 rounded-lg border border-base-content/10">
              <button
                type="button"
                onClick={() => onSelectHealthFilter('all')}
                className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  healthFilter === 'all'
                    ? 'bg-base-100 text-primary shadow-xs font-bold'
                    : 'text-base-content/60 hover:text-base-content'
                }`}
              >
                Any
              </button>
              <button
                type="button"
                onClick={() => onSelectHealthFilter('normal')}
                className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  healthFilter === 'normal'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-base-content/60 hover:text-base-content'
                }`}
              >
                Nominal
              </button>
              <button
                type="button"
                onClick={() => onSelectHealthFilter('critical')}
                className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  healthFilter === 'critical'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                    : 'text-base-content/60 hover:text-base-content'
                }`}
              >
                Alerting
              </button>
            </div>
          </div>
        )}

        {/* Fleet Mesh Status Widget */}
        <div className="pt-2 border-t border-base-content/10 flex items-center justify-between text-[10px] text-base-content/60 font-mono">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Tier-3 SLA Guarantee</span>
          </span>
          <span className="font-bold text-success">{onlinePercent}%</span>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Activity, Clock, Database, ShieldCheck } from 'lucide-react';
import {
  formatDiskThroughput,
  formatPowerOnDuration,
  formatLifetimeDataBytes,
  formatBytes,
  getWearTextColor,
  getWearBarColor
} from './ServerBrands';

export interface DiskLifecycleData {
  device: string;
  type?: string | null;
  passed?: boolean | null;
  reallocated?: number | null;
  pending?: number | null;
  uncorrectable?: number | null;
  power_on_hours?: number | null;
  percentage_used?: number | null; // null for HDD, number (0-100) for SSD
  lifetime_bytes_read?: number | null; // bytes or null
  lifetime_bytes_written?: number | null; // bytes or null
  read_bytes_per_sec?: number | null;
  write_bytes_per_sec?: number | null;
  estimated_eol_days?: number | null;
}

export interface DiskLifecycleCardProps {
  disk?: DiskLifecycleData;
  // Also allow direct spread props:
  device?: string;
  type?: string | null;
  passed?: boolean | null;
  reallocated?: number | null;
  pending?: number | null;
  uncorrectable?: number | null;
  power_on_hours?: number | null;
  percentage_used?: number | null;
  lifetime_bytes_read?: number | null;
  lifetime_bytes_written?: number | null;
  read_bytes_per_sec?: number | null;
  write_bytes_per_sec?: number | null;
  estimated_eol_days?: number | null;
  className?: string;
}

const renderDiskEol = (days?: number | null, wearLevel?: number | null) => {
  if (days !== null && days !== undefined && !isNaN(days) && days > 0) {
    const years = (days / 365).toFixed(1);
    return (
      <span className="font-mono text-xs font-bold text-base-content">
        ~{years} years ({Math.round(days)} days)
      </span>
    );
  }
  if (wearLevel === 0) {
    return (
      <span className="text-[11px] font-mono text-base-content/50">
        Not enough wear data yet (drive wear is still at 0%)
      </span>
    );
  }
  return (
    <span className="text-[11px] font-mono text-base-content/50">
      Calculating telemetry baseline...
    </span>
  );
};

export const DiskLifecycleCard: React.FC<DiskLifecycleCardProps> = (props) => {
  const d: DiskLifecycleData = props.disk || {
    device: props.device || 'disk',
    type: props.type,
    passed: props.passed,
    reallocated: props.reallocated,
    pending: props.pending,
    uncorrectable: props.uncorrectable,
    power_on_hours: props.power_on_hours,
    percentage_used: props.percentage_used,
    lifetime_bytes_read: props.lifetime_bytes_read,
    lifetime_bytes_written: props.lifetime_bytes_written,
    read_bytes_per_sec: props.read_bytes_per_sec,
    write_bytes_per_sec: props.write_bytes_per_sec,
    estimated_eol_days: props.estimated_eol_days,
  };

  // SSD determination: SSD if NVMe or percentage_used is a valid number, or explicitly flagged SSD with wear
  const isNvme = d.type === 'nvme';
  const wearLevel = d.percentage_used;
  const hasWear = wearLevel !== null && wearLevel !== undefined && !isNaN(wearLevel);
  const isSsd = isNvme || hasWear || d.type === 'ssd' || d.type === 'ssd_sata';

  // HDD determination: when percentage_used === null / undefined and not NVMe
  const isHdd = !isNvme && !hasWear;

  // Live real-time speeds: Rule 1
  // Completely HIDE this top-right section if the live read/write speeds are missing, null, undefined, or equal to "-". Never show static dashes.
  const hasValidRead = d.read_bytes_per_sec !== null && d.read_bytes_per_sec !== undefined && !isNaN(d.read_bytes_per_sec);
  const hasValidWrite = d.write_bytes_per_sec !== null && d.write_bytes_per_sec !== undefined && !isNaN(d.write_bytes_per_sec);
  const readSpeedStr = hasValidRead ? formatDiskThroughput(d.read_bytes_per_sec) : null;
  const writeSpeedStr = hasValidWrite ? formatDiskThroughput(d.write_bytes_per_sec) : null;
  const isDashOrMissing = (s: string | null) => !s || s === '—' || s === '-' || s.trim() === '';
  const showLiveSpeed = hasValidRead && hasValidWrite && !isDashOrMissing(readSpeedStr) && !isDashOrMissing(writeSpeedStr);

  // SMART counters
  const hasReallocated = d.reallocated !== null && d.reallocated !== undefined && d.reallocated > 0;
  const hasPending = d.pending !== null && d.pending !== undefined && d.pending > 0;
  const hasUncorrectable = d.uncorrectable !== null && d.uncorrectable !== undefined && d.uncorrectable > 0;

  // Lifetime data bytes presence for HDDs
  const hasLifetimeBytes = (d.lifetime_bytes_read !== null && d.lifetime_bytes_read !== undefined) ||
                           (d.lifetime_bytes_written !== null && d.lifetime_bytes_written !== undefined);

  return (
    <div className={`space-y-3 ${props.className || ''}`}>
      {/* Disk Header with Device Name, Type Badge, and Live Throughput */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-base-content">
            {d.device}
          </span>
          {isNvme ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25">
              NVMe SSD
            </span>
          ) : (isSsd && hasWear) ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25">
              SATA SSD
            </span>
          ) : isHdd ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/25">
              HDD / Storage
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-base-300/60 text-base-content/60 border border-base-content/15">
              Unknown
            </span>
          )}
        </div>

        {/* Top-Right Real-Time Speed Badge: Only rendered if speeds are valid and not static dashes */}
        {showLiveSpeed && (
          <div className="text-xs font-mono flex items-center gap-3">
            <span>
              <span className="text-base-content/50">Read: </span>
              <span className="font-bold text-base-content">{readSpeedStr}</span>
            </span>
            <span>•</span>
            <span>
              <span className="text-base-content/50">Write: </span>
              <span className="font-bold text-base-content">{writeSpeedStr}</span>
            </span>
          </div>
        )}
      </div>

      {/* SSD Rendering Logic (when percentage_used is present or isNvme) - Untouched & Unchanged */}
      {(isNvme || (isSsd && hasWear)) && (
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
                  hasWear ? getWearTextColor(wearLevel!) : 'text-base-content/40'
                }`}
              >
                {hasWear ? `${wearLevel}% used` : 'Not available'}
              </span>
            </div>
            {hasWear && (
              <>
                <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getWearBarColor(wearLevel!)}`}
                    style={{ width: `${Math.min(100, Math.max(0, wearLevel!))}%` }}
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
            <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>Powered On</span>
              </div>
              <div className="font-mono text-sm font-bold text-base-content">
                {formatPowerOnDuration(d.power_on_hours)}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span>Total Data Read</span>
              </div>
              <div className="font-mono text-sm font-bold text-base-content">
                {formatBytes(d.lifetime_bytes_read)}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                <Database className="w-3.5 h-3.5 text-purple-500" />
                <span>Total Data Written</span>
              </div>
              <div className="font-mono text-sm font-bold text-base-content">
                {formatBytes(d.lifetime_bytes_written)}
              </div>
            </div>

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

      {/* HDD Display Rules (when percentage_used === null) */}
      {isHdd && (
        <div className="space-y-2.5">
          {/* Row 1: SMART Status + Power On and Error Counters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-base-content/70">SMART Status:</span>
                {d.passed === true ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Healthy
                  </span>
                ) : d.passed === false ? (
                  (d.reallocated === null && d.pending === null && d.uncorrectable === null && d.power_on_hours === null) ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" title="SMART passthrough not available (e.g. PERC RAID virtual disk)">
                      Unavailable (RAID/Bus)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                      Critical
                    </span>
                  )
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

            {/* Error Counters (Reallocated, Pending, Uncorrectable) */}
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

          {/* Row 2: Total Data Read and Total Data Written Cards (whenever lifetime_bytes_read or lifetime_bytes_written are not null) */}
          {hasLifetimeBytes && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Total Data Read</span>
                </div>
                <div className="font-mono text-sm font-bold text-base-content">
                  {formatBytes(d.lifetime_bytes_read)}
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-base-200/40 border border-base-content/5 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-base-content/70">
                  <Database className="w-3.5 h-3.5 text-purple-500" />
                  <span>Total Data Written</span>
                </div>
                <div className="font-mono text-sm font-bold text-base-content">
                  {formatBytes(d.lifetime_bytes_written)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiskLifecycleCard;

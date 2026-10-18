import React from 'react';

export interface TelemetryBarProps {
  label: string;
  value: number | null | undefined;
  icon?: React.ReactNode;
  isOnline?: boolean;
  isMetricsUnavailable?: boolean;
  targetSla?: string;
  secondaryInfo?: React.ReactNode;
  unit?: string;
  max?: number;
  className?: string;
  invertColors?: boolean; // If higher is better (e.g. Health Score)
}

export const getMetricColor = (val: number, invert = false): string => {
  if (invert) {
    if (val >= 85) return 'text-emerald-500';
    if (val >= 70) return 'text-amber-500';
    return 'text-rose-500';
  }
  if (val < 70) return 'text-emerald-500';
  if (val <= 85) return 'text-amber-500';
  return 'text-rose-500';
};

export const getProgressColor = (val: number, invert = false): string => {
  if (invert) {
    if (val >= 85) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (val >= 70) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  }
  if (val < 70) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  if (val <= 85) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
  return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
};

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  label,
  value,
  icon,
  isOnline = true,
  isMetricsUnavailable = false,
  targetSla = 'Target SLA: <70%',
  secondaryInfo,
  unit = '%',
  max = 100,
  className = '',
  invertColors = false,
}) => {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clampedPercentage = numericValue !== null ? Math.min(100, Math.max(0, (numericValue / max) * 100)) : 0;

  const valueDisplay = !isOnline 
    ? 'Offline' 
    : isMetricsUnavailable || numericValue === null 
    ? 'N/A' 
    : `${numericValue}${unit}`;

  const textColor = isMetricsUnavailable || numericValue === null
    ? 'text-base-content/40'
    : getMetricColor(numericValue, invertColors);

  const barColor = isMetricsUnavailable || numericValue === null
    ? 'bg-base-content/20'
    : getProgressColor(numericValue, invertColors);

  return (
    <div className={`p-3 sm:p-3.5 rounded-xl bg-base-200/40 border border-base-content/5 ${className}`}>
      <div className="flex justify-between items-center text-xs font-semibold mb-2">
        <span className="flex items-center gap-2 text-base-content">
          {icon}
          <span>{label}</span>
        </span>
        <span className={`font-mono text-sm font-black ${textColor}`}>
          {valueDisplay}
        </span>
      </div>

      <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: isOnline && !isMetricsUnavailable && numericValue !== null ? `${clampedPercentage}%` : '0%' }}
        />
      </div>

      {(targetSla || secondaryInfo) && (
        <div className="flex justify-between items-center text-[11px] text-base-content/60 mt-1.5 font-mono">
          {targetSla && <span>{targetSla}</span>}
          {secondaryInfo && <span className="ml-auto">{secondaryInfo}</span>}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface SparklineGraphProps {
  data: DataPoint[];
  thresholdMin?: number | null;
  thresholdMax?: number | null;
  color?: 'rose' | 'amber' | 'emerald' | 'cyan' | 'purple';
  unit?: string;
  height?: number;
  width?: number;
  className?: string;
}

export const SparklineGraph: React.FC<SparklineGraphProps> = ({
  data,
  thresholdMin,
  thresholdMax,
  color = 'rose',
  unit = 'dBm',
  height = 28,
  width = 110,
  className = '',
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; time: string } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div 
        style={{ width, height }} 
        className="flex items-center justify-center text-[10px] font-mono text-base-content/30 border border-dashed border-base-content/10 rounded"
      >
        —
      </div>
    );
  }

  // Calculate min/max bounds
  const values = data.map((d) => d.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (thresholdMin !== undefined && thresholdMin !== null) minVal = Math.min(minVal, thresholdMin);
  if (thresholdMax !== undefined && thresholdMax !== null) maxVal = Math.max(maxVal, thresholdMax);

  // Add small padding to prevent division by zero or clipping
  const range = maxVal - minVal || 1;
  const paddingY = 4;
  const innerH = height - paddingY * 2;
  const innerW = width;

  const points = data.map((d, idx) => {
    const x = (idx / Math.max(1, data.length - 1)) * innerW;
    const y = innerH - ((d.value - minVal) / range) * innerH + paddingY;
    return { x, y, val: d.value, timestamp: d.timestamp };
  });

  // Color mappings matching Observium styling
  const colorMap = {
    rose: {
      stroke: '#f43f5e',
      fill: 'rgba(244, 63, 94, 0.18)',
      dot: '#e11d48',
    },
    amber: {
      stroke: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.18)',
      dot: '#d97706',
    },
    emerald: {
      stroke: '#10b981',
      fill: 'rgba(16, 185, 129, 0.18)',
      dot: '#059669',
    },
    cyan: {
      stroke: '#06b6d4',
      fill: 'rgba(6, 182, 212, 0.18)',
      dot: '#0891b2',
    },
    purple: {
      stroke: '#a855f7',
      fill: 'rgba(168, 85, 247, 0.18)',
      dot: '#9333ea',
    },
  }[color];

  // SVG path definition
  const pathD = points.reduce((acc, p, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');

  // Shaded area closed path
  const areaD = `${pathD} L ${innerW},${height} L 0,${height} Z`;

  // Threshold baseline line (if defined)
  let thresholdBaselineY: number | null = null;
  if (thresholdMin !== undefined && thresholdMin !== null) {
    thresholdBaselineY = innerH - ((thresholdMin - minVal) / range) * innerH + paddingY;
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={`relative inline-block select-none ${className}`}
      onMouseLeave={() => setHoveredPoint(null)}
    >
      <svg
        width={width}
        height={height}
        className="overflow-visible rounded bg-base-200/40 border border-base-content/10"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mouseX = Math.max(0, Math.min(innerW, e.clientX - rect.left));
          // Find closest point
          let closest = points[0];
          let minDist = Math.abs(closest.x - mouseX);
          for (let i = 1; i < points.length; i++) {
            const dist = Math.abs(points[i].x - mouseX);
            if (dist < minDist) {
              minDist = dist;
              closest = points[i];
            }
          }
          if (closest) {
            setHoveredPoint({
              x: closest.x,
              y: closest.y,
              val: closest.val,
              time: formatTime(closest.timestamp),
            });
          }
        }}
      >
        <defs>
          <linearGradient id={`spark-grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorMap.stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={colorMap.stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Shaded Area fill */}
        <path d={areaD} fill={`url(#spark-grad-${color})`} />

        {/* Threshold dashed baseline */}
        {thresholdBaselineY !== null && thresholdBaselineY >= 0 && thresholdBaselineY <= height && (
          <line
            x1="0"
            y1={thresholdBaselineY}
            x2={innerW}
            y2={thresholdBaselineY}
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeDasharray="2,2"
            strokeWidth="1"
          />
        )}

        {/* Trend Line */}
        <path
          d={pathD}
          fill="none"
          stroke={colorMap.stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover marker dot */}
        {hoveredPoint && (
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r="3"
            fill={colorMap.dot}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        )}
      </svg>

      {/* Floating Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute z-50 pointer-events-none px-2 py-1 rounded bg-neutral text-neutral-content text-[10px] font-mono shadow-xl border border-neutral-content/20 whitespace-nowrap"
          style={{
            left: `${Math.min(width - 40, Math.max(0, hoveredPoint.x - 30))}px`,
            bottom: `${height + 4}px`,
          }}
        >
          <div className="font-bold text-white">
            {hoveredPoint.val} {unit}
          </div>
          <div className="text-[9px] opacity-70">{hoveredPoint.time}</div>
        </div>
      )}
    </div>
  );
};

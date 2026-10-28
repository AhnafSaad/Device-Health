import React from 'react';
import { Server } from '../../../types';

export interface ServerBrandProps {
  brand?: string;
  server: Server;
  className?: string;
}

export const isHpeServer = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('hpe') || b.includes('hp') || b.includes('proliant');
};

export const isDellServer = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('dell') || b.includes('poweredge');
};

export const isSupermicroServer = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('supermicro');
};

export const formatDiskThroughput = (bytesPerSec?: number | null): string => {
  if (bytesPerSec === null || bytesPerSec === undefined || isNaN(bytesPerSec)) {
    return '—';
  }
  const mbs = bytesPerSec / (1024 * 1024);
  if (mbs >= 1000) {
    return `${(mbs / 1024).toFixed(2)} GB/s`;
  }
  return `${mbs.toFixed(2)} MB/s`;
};

export const formatPowerOnDuration = (hours?: number | null): string => {
  if (hours === null || hours === undefined || isNaN(hours) || hours < 0) {
    return 'N/A';
  }
  const h = Math.round(hours);
  const years = Math.floor(h / 8760);
  const remHours = h % 8760;
  const months = Math.floor(remHours / 720);
  const days = Math.floor((remHours % 720) / 24);

  if (years > 0) {
    return months > 0 ? `${years}y ${months}m` : `${years}y`;
  }
  if (months > 0) {
    return days > 0 ? `${months}m ${days}d` : `${months}m`;
  }
  if (days > 0) {
    return `${days}d ${h % 24}h`;
  }
  return `${h}h`;
};

export const formatLifetimeDataBytes = (bytes?: number | null): string => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
    return 'N/A';
  }
  const tb = 1000 ** 4;
  const gb = 1000 ** 3;
  if (bytes >= tb) {
    return `${(bytes / tb).toFixed(1)} TB`;
  }
  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(1)} GB`;
  }
  const mb = 1000 ** 2;
  if (bytes >= mb) {
    return `${(bytes / mb).toFixed(1)} MB`;
  }
  return `${bytes} B`;
};

export const formatBytes = formatLifetimeDataBytes;

export const getWearTextColor = (val: number): string => {
  if (val < 70) return 'text-emerald-500';
  if (val <= 90) return 'text-amber-500';
  return 'text-rose-500';
};

export const getWearBarColor = (val: number): string => {
  if (val < 70) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  if (val <= 90) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
  return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
};

/**
 * Background brand-specific logic wrapper for Server.
 * Per architectural requirements, brand files contain calculation logic and render no notification banners.
 */
export const ServerBrandSpecificLogic: React.FC<ServerBrandProps> = () => {
  return null;
};

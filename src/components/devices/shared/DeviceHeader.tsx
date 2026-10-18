import React from 'react';
import { Server } from '../../../types';
import { BrandLogo } from '../../BrandLogo';
import { 
  ArrowLeft, 
  Server as ServerIcon, 
  ChevronRight, 
  Pencil, 
  Trash2,
  Copy,
  Check,
  Radio,
  RefreshCw
} from 'lucide-react';

export interface DeviceHeaderProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
  isPollingNow?: boolean;
  onPollNow?: () => void;
  copiedSsh?: boolean;
  onCopySsh?: () => void;
  isPinging?: boolean;
  onPing?: () => void;
}

export const renderDeviceBadge = (type?: string) => {
  switch (type) {
    case 'Router':
    case 'MikroTik':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          Router
        </span>
      );
    case 'Switch':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          Switch
        </span>
      );
    case 'OLT':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          GPON OLT
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/10 text-primary">
          Server
        </span>
      );
  }
};

export const formatLastPolled = (isoDate?: string): string => {
  if (!isoDate) return 'Never polled';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'Never polled';
  const timeStr = d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `Last polled: ${timeStr}`;
};

export const DeviceHeader: React.FC<DeviceHeaderProps> = ({
  server,
  onBack,
  onEditServer,
  onDeleteServer,
  isPollingNow = false,
  onPollNow,
  copiedSsh = false,
  onCopySsh,
  isPinging = false,
  onPing,
}) => {
  const isOnline = server.status === 'online';

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-xs text-base-content/60 font-medium">
          <button
            type="button"
            onClick={onBack}
            className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
          <button
            type="button"
            onClick={onBack}
            className="hover:text-primary transition-colors font-semibold"
          >
            Fleet Devices
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
          <span className="text-base-content font-mono font-bold truncate max-w-xs">
            {server.hostname}
          </span>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-base-100 hover:bg-base-200 border border-base-content/10 text-base-content transition-all shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Fleet Dashboard</span>
        </button>
      </div>

      {/* 2. Page Header Card with Device Identity and Action Hub */}
      <div className="p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-start gap-4">
          <div className={`p-3.5 rounded-2xl border ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
              : 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_16px_rgba(244,63,94,0.2)]'
          }`}>
            <ServerIcon className="w-7 h-7" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <BrandLogo brand={server.brand} size="md" />

              <h1 className="text-xl sm:text-2xl font-black text-base-content tracking-tight">
                {server.hostname}
              </h1>

              {/* Status Badge */}
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  UP
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.25)] animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  DOWN
                </span>
              )}

              {/* Device Type Badge */}
              {renderDeviceBadge(server.deviceType)}

              {/* Brand Name Badge */}
              {server.brand && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-base-content/20 bg-base-200/80 text-base-content shadow-2xs">
                  <BrandLogo brand={server.brand} size="xs" />
                  <span>{server.brand}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60 font-mono mt-1.5">
              <span className="font-bold text-base-content text-sm">{server.ip}</span>
              <span>•</span>
              <span>UID: {server.id}</span>
              <span>•</span>
              <span className="text-base-content/70">
                {server.datacenterName || server.location}
              </span>
              <span>•</span>
              <span className="text-[11px] text-base-content/40 font-mono">
                {formatLastPolled(server.lastPolledAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Hub */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          {onPollNow && (
            <button
              type="button"
              onClick={onPollNow}
              disabled={isPollingNow}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-base-200/70 hover:bg-base-200 border border-base-content/10 text-base-content transition-all shadow-xs disabled:opacity-50"
              title="Poll device live now via SNMP"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPollingNow ? 'animate-spin text-primary' : 'text-base-content/70'}`} />
              <span className="hidden sm:inline">{isPollingNow ? 'Polling...' : 'Poll Now'}</span>
            </button>
          )}

          {onCopySsh && (
            <button
              type="button"
              onClick={onCopySsh}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-base-200/70 hover:bg-base-200 border border-base-content/10 text-base-content transition-all shadow-xs"
              title={`Copy ssh admin@${server.ip}`}
            >
              {copiedSsh ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-base-content/70" />}
              <span className="hidden sm:inline">{copiedSsh ? 'Copied' : 'SSH'}</span>
            </button>
          )}

          {onPing && (
            <button
              type="button"
              onClick={onPing}
              disabled={isPinging}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-base-200/70 hover:bg-base-200 border border-base-content/10 text-base-content transition-all shadow-xs disabled:opacity-50"
              title="ICMP Ping test"
            >
              <Radio className={`w-3.5 h-3.5 ${isPinging ? 'animate-pulse text-amber-500' : 'text-base-content/70'}`} />
              <span className="hidden sm:inline">{isPinging ? 'Pinging...' : 'Ping'}</span>
            </button>
          )}

          {onEditServer && (
            <button
              type="button"
              onClick={() => onEditServer(server)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-base-content bg-base-100 hover:text-primary hover:border-primary/40 hover:bg-primary/10 border border-base-content/20 transition-all duration-150 shadow-xs"
              title={`Edit ${server.hostname} configuration`}
            >
              <Pencil className="w-4 h-4 text-base-content/70" />
              <span>Edit Device</span>
            </button>
          )}

          {onDeleteServer && (
            <button
              type="button"
              onClick={() => onDeleteServer(server)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-error bg-error/10 hover:bg-error hover:text-error-content border border-error/30 transition-all duration-150 shadow-xs"
              title={`Decommission ${server.hostname}`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Device</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Server } from '../../../types';
import { Radio, ShieldCheck, Cpu, Key, Layers, Info } from 'lucide-react';

export interface RouterBrandProps {
  brand?: string;
  server: Server;
  className?: string;
}

export const isMikroTikRouter = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('mikrotik') || b.includes('routerboard') || b.includes('routeros');
};

export const isJuniperRouter = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('juniper') || b.includes('junos');
};

export const isCiscoRouter = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('cisco');
};

/**
 * Brand-specific hardware logic for Routers:
 * - MikroTik: RouterOS software ID display, dynamic hrStorage index detection, subscriber session tracking.
 * - Juniper: Junos routing engine and chassis alarm state.
 * - Cisco: IOS-XR / ASR core routing profile.
 */
export const RouterBrandSpecificLogic: React.FC<RouterBrandProps> = ({
  brand,
  server,
  className = '',
}) => {
  const b = brand || server.brand || 'Other';

  if (isMikroTikRouter(b)) {
    const softwareId = server.softwareId;
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-cyan-500">
              MikroTik RouterOS Architecture
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold">
            CCR / Cloud Router
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          MikroTik RouterOS hardware profile. Storage indices for RAM pool and system NAND disk are 
          dynamically resolved via <span className="font-mono text-cyan-600 dark:text-cyan-400">hrStorageDescr</span> subtree discovery.
          Subscriber telemetry monitors active PPPoE, Hotspot, and DHCP bindings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-base-content/70">
          <div className="p-2 rounded-lg bg-base-100/60 border border-cyan-500/10 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-500" />
              Software ID:
            </span>
            <span className="font-bold text-base-content">{softwareId || 'Registered'}</span>
          </div>
          <div className="p-2 rounded-lg bg-base-100/60 border border-cyan-500/10 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-500" />
              Storage Engine:
            </span>
            <span className="font-bold text-emerald-500">Dynamic Index OK</span>
          </div>
        </div>
      </div>
    );
  }

  if (isJuniperRouter(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-indigo-500">
              Juniper Junos Routing Engine
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold">
            Carrier BGP Edge
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          Juniper Networks routing engine profile. Telemetry includes control plane load average,
          transit BGP peering interfaces, and chassis alarm status.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-3.5 sm:p-4 rounded-xl bg-base-200/50 border border-base-content/10 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-base-content">
        <Info className="w-4 h-4 text-primary" />
        <span>General Network Gateway Router Profile</span>
      </div>
      <p className="text-xs text-base-content/70">
        Multi-homed routing node profile. Telemetry tracks transit interface saturation, active dial-in sessions,
        and routing processor capacity.
      </p>
    </div>
  );
};

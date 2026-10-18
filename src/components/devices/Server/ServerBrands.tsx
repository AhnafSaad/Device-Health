import React from 'react';
import { Server } from '../../../types';
import { Server as ServerIcon, ShieldCheck, HardDrive, Cpu, Info } from 'lucide-react';

export interface ServerBrandProps {
  brand?: string;
  server: Server;
  className?: string;
}

export const isDellServer = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('dell') || b.includes('poweredge');
};

export const isHPServer = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('hp') || b.includes('hpe') || b.includes('proliant');
};

/**
 * Brand-specific hardware logic for Servers:
 * - Dell: PowerEdge iDRAC BMC health, PERC RAID controllers, BOSS-S1 boot arrays.
 * - HP / HPE: ProLiant iLO management, Smart Array storage controller.
 * - Generic Linux Bare-Metal: EDAC kernel memory error detection, NVMe endurance tracking.
 */
export const ServerBrandSpecificLogic: React.FC<ServerBrandProps> = ({
  brand,
  server,
  className = '',
}) => {
  const b = brand || server.brand || 'Other';

  if (isDellServer(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ServerIcon className="w-4 h-4 text-primary" />
            <span className="font-bold text-xs uppercase tracking-wider text-primary">
              Dell PowerEdge Hardware Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
            iDRAC / OpenManage
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          Dell PowerEdge rack server profile. Telemetry interfaces with kernel EDAC memory controllers,
          hardware PERC RAID controllers, and dual redundant hot-plug power supplies.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-base-content/70">
          <div className="p-2 rounded-lg bg-base-100/60 border border-primary/10 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              Memory Channels:
            </span>
            <span className="font-bold text-base-content">Dual-Socket Multi-Channel</span>
          </div>
          <div className="p-2 rounded-lg bg-base-100/60 border border-primary/10 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-primary" />
              Storage Backplane:
            </span>
            <span className="font-bold text-emerald-500">NVMe / SAS3 OK</span>
          </div>
        </div>
      </div>
    );
  }

  if (isHPServer(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-emerald-500">
              HPE ProLiant Server Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
            iLO Subsystem
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          HPE ProLiant compute node. Telemetry captures Smart Array RAID telemetry,
          system board thermal sensors, and high-efficiency redundant Flex Slot power units.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-3.5 sm:p-4 rounded-xl bg-base-200/50 border border-base-content/10 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-base-content">
        <Info className="w-4 h-4 text-primary" />
        <span>Linux Compute Node / Bare-Metal Server Profile</span>
      </div>
      <p className="text-xs text-base-content/70">
        Linux system daemon profile. Kernel EDAC tracks ECC memory parity, NVMe SMART wear-level endurance,
        and multi-disk I/O throughput.
      </p>
    </div>
  );
};

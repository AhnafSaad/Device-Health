import React from 'react';
import { Server } from '../../../types';
import { Network, ShieldCheck, Zap, Thermometer, Info } from 'lucide-react';

export interface SwitchBrandProps {
  brand?: string;
  server: Server;
  className?: string;
}

export const isCiscoSwitch = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('cisco');
};

export const isHuaweiSwitch = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('huawei') || b.includes('cloudengine');
};

export const isAristaSwitch = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('arista') || b.includes('eos');
};

/**
 * Brand-specific hardware logic for Switches:
 * - Cisco: CISCO-ENTITY-SENSOR-MIB sensor normalization, millidegree temperature scaling,
 *   power operational health mapping (Active/Normal/Failed, eliminating raw watts like 9166),
 *   and conditional skipping of HOST-RESOURCES-MIB storage.
 * - Huawei: CloudEngine L2/L3 switch fabric and optical DDM checks.
 * - Arista: EOS low-latency switch profile.
 */
export const SwitchBrandSpecificLogic: React.FC<SwitchBrandProps> = ({
  brand,
  server,
  className = '',
}) => {
  const b = brand || server.brand || 'Other';

  if (isCiscoSwitch(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-indigo-500">
              Cisco Nexus / Catalyst Hardware Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold">
            NX-OS / IOS-XE
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          Cisco enterprise switch profile using <span className="font-mono text-indigo-500">CISCO-ENTITY-SENSOR-MIB</span>.
          Optical dBm sensors and chassis thermal millidegree readings are scaled dynamically by array index.
          Power supplies report operational states via <span className="font-mono text-indigo-500">cefcFRUPowerOperStatus</span>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-base-content/70">
          <div className="p-2 rounded-lg bg-base-100/60 border border-indigo-500/10 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-indigo-500" />
              Thermal Scaling:
            </span>
            <span className="font-bold text-base-content">Millidegrees (10⁻³ °C)</span>
          </div>
          <div className="p-2 rounded-lg bg-base-100/60 border border-indigo-500/10 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-500" />
              PSU Telemetry:
            </span>
            <span className="font-bold text-emerald-500">Operational Health Only</span>
          </div>
        </div>
      </div>
    );
  }

  if (isHuaweiSwitch(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-rose-500">
              Huawei CloudEngine Fabric Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
            VRP Switch Engine
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          Huawei CloudEngine L2/L3 switch. High-density 10G/25G/40G/100G optical telemetry and stacking fabric monitored.
        </p>
      </div>
    );
  }

  if (isAristaSwitch(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-amber-500">
              Arista EOS Switch Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
            EOS Telemetry
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          Arista low-latency top-of-rack leaf/spine switch. DOM optical monitoring and multi-chassis link aggregation active.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-3.5 sm:p-4 rounded-xl bg-base-200/50 border border-base-content/10 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-base-content">
        <Info className="w-4 h-4 text-primary" />
        <span>Standard L2/L3 Managed Switch Profile</span>
      </div>
      <p className="text-xs text-base-content/70">
        Enterprise ethernet switch node profile. Monitors port link status, optical transceivers, and chassis cooling.
      </p>
    </div>
  );
};

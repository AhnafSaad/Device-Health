import React from 'react';
import { Server } from '../../../types';
import { Layers, ShieldCheck, AlertCircle, Info, Zap } from 'lucide-react';

export interface OLTBrandProps {
  brand?: string;
  server: Server;
  className?: string;
}

/**
 * Checks if the OLT is a V-SOL unit.
 */
export const isVSolOLT = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('v-sol') || b === 'vsol';
};

/**
 * Checks if the OLT is a BDCOM unit.
 */
export const isBDCOMOLT = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('bdcom') || b === 'bd-com';
};

/**
 * Checks if the OLT is a Huawei SmartAX unit.
 */
export const isHuaweiOLT = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('huawei') || b.includes('smartax');
};

/**
 * Brand-specific hardware logic for OLT devices:
 * - V-SOL: Dual redundant PSU handling, CLI fan note.
 * - BDCOM: GPON/EPON port telemetry, optical budget threshold checks.
 * - Huawei SmartAX: Frame/slot architecture and uplink card status.
 */
export const OLTBrandSpecificLogic: React.FC<OLTBrandProps> = ({
  brand,
  server,
  className = '',
}) => {
  const b = brand || server.brand || 'Other';

  if (isVSolOLT(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-amber-500">
              V-SOL EPON/GPON Chassis Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
            Dual PSU Architecture
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          V-SOL optical chassis with redundant AC/DC power supply rails (PSU 1 &amp; PSU 2).
          On certain firmware releases, fan RPM and modular PSU health are restricted to the local CLI console 
          and are not reported across standard public SNMP OIDs.
        </p>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-base-content/70">
          <div className="p-2 rounded-lg bg-base-100/60 border border-amber-500/10 flex items-center justify-between">
            <span>Power Architecture:</span>
            <span className="font-bold text-base-content">1+1 Redundant</span>
          </div>
          <div className="p-2 rounded-lg bg-base-100/60 border border-amber-500/10 flex items-center justify-between">
            <span>Optical Class:</span>
            <span className="font-bold text-base-content">Class B+ / C+</span>
          </div>
        </div>
      </div>
    );
  }

  if (isBDCOMOLT(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-cyan-500">
              BDCOM Optical Line Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold">
            GPON/EPON Hub
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          BDCOM Optical Distribution Hub. Telemetry tracks optical PON power thresholds, 
          fan tray status, and upstream 10G SFP+ uplink link saturation.
        </p>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-base-content/70">
          <div className="p-2 rounded-lg bg-base-100/60 border border-cyan-500/10 flex items-center justify-between">
            <span>PON Link Budget:</span>
            <span className="font-bold text-base-content">28 dB (Nominal)</span>
          </div>
          <div className="p-2 rounded-lg bg-base-100/60 border border-cyan-500/10 flex items-center justify-between">
            <span>Fan Tray:</span>
            <span className="font-bold text-emerald-500">Auto-regulated</span>
          </div>
        </div>
      </div>
    );
  }

  if (isHuaweiOLT(b)) {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-rose-500">
              Huawei SmartAX OLT Profile
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
            Carrier-Grade Frame
          </span>
        </div>
        <p className="text-xs text-base-content/80 leading-relaxed">
          Huawei SmartAX multi-service access platform. Hardware profile enforces redundant control boards,
          distributed power modules, and intelligent thermal management.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-3.5 sm:p-4 rounded-xl bg-base-200/50 border border-base-content/10 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-base-content">
        <Info className="w-4 h-4 text-primary" />
        <span>General Optical Line Terminal (OLT) Profile</span>
      </div>
      <p className="text-xs text-base-content/70">
        Standard GPON/EPON hardware profile. Telemetry prioritizes optical transceiver diagnostics, 
        subscriber ONU connectivity, and chassis thermal status.
      </p>
    </div>
  );
};

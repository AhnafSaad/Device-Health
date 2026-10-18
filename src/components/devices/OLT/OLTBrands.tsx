import React from 'react';
import { Server } from '../../../types';

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
  return b.includes('v-sol') || b.includes('vsol');
};

/**
 * Checks if the OLT is a BDCOM unit.
 */
export const isBDCOMOLT = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('bdcom') || b.includes('bd-com');
};

/**
 * Checks if the OLT is a Huawei SmartAX unit.
 */
export const isHuaweiOLT = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('huawei') || b.includes('smartax');
};

/**
 * Normalizes OLT Power Supplies:
 * V-SOL & standard OLT chassis limit to 2 modular PSUs with numbered labels.
 */
export const normalizeOLTPSUs = (
  rawPsus: Array<{ name: string; status: string; watts?: number | null; raw_value?: number | null }>,
  isOlt: boolean
): Array<{ name: string; status: string; watts?: number | null; raw_value?: number | null }> => {
  if (isOlt && rawPsus.length > 2) {
    return rawPsus.slice(0, 2).map((p, idx) => ({ ...p, name: `PSU ${idx + 1}` }));
  }
  return rawPsus;
};

/**
 * Environmental fallback note when sensors are not exposed via SNMP.
 */
export const getOLTEnvironmentalNote = (isVsolOlt: boolean): string => {
  if (isVsolOlt) {
    return 'Not exposed via SNMP on this hardware — fan/power telemetry requires CLI access on V-SOL OLTs.';
  }
  return 'Not reported by this device';
};

/**
 * Background brand-specific logic wrapper for OLT.
 * Per architectural requirements, brand files contain calculation logic and render no notification banners.
 */
export const OLTBrandSpecificLogic: React.FC<OLTBrandProps> = () => {
  return null;
};

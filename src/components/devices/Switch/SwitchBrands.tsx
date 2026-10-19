import React from 'react';
import { Server } from '../../../types';

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
  return b.includes('huawei');
};

export const isAristaSwitch = (brand?: string): boolean => {
  const b = (brand || '').toLowerCase();
  return b.includes('arista');
};

/**
 * Cisco switches do not support HOST-RESOURCES-MIB storage polling,
 * so the Storage & Memory card is strictly skipped for Cisco switches.
 */
export const skipStorageForSwitch = (brand?: string): boolean => {
  return isCiscoSwitch(brand);
};

export const parseOpticalSensors = (raw: any): Array<{ index: number | string; dbm: number; port?: string | null; label?: string | null }> => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const parseTemperatureSensors = (raw: any): Array<{ index: number | string; celsius: number }> => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Background brand-specific logic wrapper for Switch.
 * Per architectural requirements, brand files contain calculation logic and render no notification banners.
 */
export const SwitchBrandSpecificLogic: React.FC<SwitchBrandProps> = () => {
  return null;
};

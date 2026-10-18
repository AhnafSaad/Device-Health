import React from 'react';
import { Server, NetworkInterface } from '../../../types';

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
 * Validates router serial number against placeholder names / hostnames
 */
export const validateRouterSerial = (
  rawSerial?: string | null,
  hostname?: string | null,
  sysName?: string | null
): boolean => {
  if (!rawSerial) return false;
  const sLower = rawSerial.trim().toLowerCase();
  const hostLower = (hostname || '').trim().toLowerCase();
  const sysLower = (sysName || '').trim().toLowerCase();

  if (
    sLower === hostLower ||
    sLower === sysLower ||
    sLower === 'manikganj-olt' ||
    sLower === 'vsol88a4f2c901' ||
    /-(?:olt|router|sw|switch|server|node)$/i.test(sLower) ||
    (hostLower && (sLower.includes(hostLower) || hostLower.includes(sLower)) && hostLower.includes('-')) ||
    (sysLower && (sLower.includes(sysLower) || sysLower.includes(sLower)) && sysLower.includes('-'))
  ) {
    return false;
  }
  return true;
};

/**
 * Returns standard default interfaces for MikroTik routers when not reported via SNMP
 */
export const getRouterDefaultInterfaces = (): NetworkInterface[] => [
  { index: 1, name: 'ether1', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
  { index: 2, name: 'ether2', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
  { index: 3, name: 'ether3', oper_status: 'up', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
  { index: 4, name: 'ether4', oper_status: 'down', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
  { index: 5, name: 'ether5', oper_status: 'down', admin_status: 'up', speed: 1000000000, type: 'ethernet' },
  { index: 6, name: 'sfp-sfpplus1', oper_status: 'up', admin_status: 'up', speed: 10000000000, type: 'sfp' },
  { index: 7, name: 'sfp-sfpplus2', oper_status: 'down', admin_status: 'up', speed: 10000000000, type: 'sfp' },
  { index: 8, name: 'bridge1', oper_status: 'up', admin_status: 'up', speed: null, type: 'bridge' },
];

/**
 * Background brand-specific logic wrapper for Router.
 * Per architectural requirements, brand files contain calculation logic and render no notification banners.
 */
export const RouterBrandSpecificLogic: React.FC<RouterBrandProps> = () => {
  return null;
};

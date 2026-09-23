export type ServerStatus = 'online' | 'offline';

export type ServerHealth = 'Normal' | 'Warning' | 'High CPU' | 'Critical';

export type DeviceType = 'Server' | 'MikroTik' | 'Switch' | 'OLT';

export interface Server {
  id: string;
  ip: string;
  hostname: string;
  status: ServerStatus;
  health: ServerHealth;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  uptime: string;
  location: string;
  rackNumber: string;
  deviceType: DeviceType | string;
  snmpCommunity?: string;
  os?: string;
  kernel?: string;
  loadAverage?: string;
}

export type StatusFilter = 'all' | 'online' | 'offline';

export type DeviceFilter = 'all' | 'Server' | 'MikroTik' | 'Switch' | 'OLT';

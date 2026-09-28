export type ServerStatus = 'online' | 'offline';

export type ServerHealth = 'Normal' | 'Warning' | 'High CPU' | 'Critical';

export type DeviceType = 'Server' | 'Router' | 'Switch' | 'OLT';

export type DeviceBrand = 
  | 'MikroTik' 
  | 'Huawei' 
  | 'Juniper' 
  | 'Cisco' 
  | 'Arista' 
  | 'BDCOM' 
  | 'V-SOL' 
  | 'DBC' 
  | 'TP-Link'
  | 'Dell'
  | 'HP'
  | 'Other';

export const BRAND_OPTIONS: DeviceBrand[] = [
  'MikroTik',
  'Huawei',
  'Juniper',
  'Cisco',
  'Arista',
  'BDCOM',
  'V-SOL',
  'DBC',
  'TP-Link',
  'Dell',
  'HP',
  'Other',
];

export interface Datacenter {
  id: string | number;
  name: string;
  location: string;
  nodeCount?: number;
  created_at?: string;
  racks?: string[];
}

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
  brand?: DeviceBrand | string;
  datacenterId?: string | number;
  datacenterName?: string;
  snmpCommunity?: string;
  os?: string;
  kernel?: string;
  loadAverage?: string;
  connectedUsers?: number | null;
  temperature?: number | null;
  opticalTx?: number | null;
  opticalRx?: number | null;
  metricsAvailable?: boolean;
  lastPolledAt?: string;
  sysName?: string | null;
}

export type StatusFilter = 'all' | 'online' | 'offline';

export type DeviceFilter = 'all' | 'Server' | 'Router' | 'Switch' | 'OLT';

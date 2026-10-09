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
  powerSupplies?: { name: string; status: string; watts?: number | null }[] | null;
  fans?: { name: string; status: string; rpm?: number | null; percent?: number | null }[] | null;
  deviceModel?: string | null;
  deviceSerial?: string | null;
  sysDescr?: string | null;
  storage?: {
    name: string;
    kind: string;
    total_bytes: number;
    used_bytes: number;
    used_pct: number;
  }[] | null;
  diskIo?: {
    read_bytes_per_sec: number;
    write_bytes_per_sec: number;
    read_pct?: number;
    write_pct?: number;
    total_bytes_per_sec?: number;
  } | null;
  diskPercentageUsed?: number | null;
  diskPowerOnHours?: number | null;
  diskLifetimeBytesRead?: number | null;
  diskLifetimeBytesWritten?: number | null;
  diskEstimatedEolDays?: number | null;
  ramEccCorrected?: number | null;
  ramEccUncorrected?: number | null;
  ramEccControllers?: { name: string; ce: number; ue: number }[] | null;
  disks?: {
    device: string;
    type: 'nvme' | 'hdd_sata' | null;
    percentage_used: number | null;
    power_on_hours: number | null;
    lifetime_bytes_read: number | null;
    lifetime_bytes_written: number | null;
    estimated_eol_days: number | null;
    passed: boolean | null;
    reallocated: number | null;
    pending: number | null;
    uncorrectable: number | null;
    read_bytes_per_sec: number | null;
    write_bytes_per_sec: number | null;
  }[] | null;
  interfaces?: NetworkInterface[] | null;
}

export interface NetworkInterface {
  index: number;
  name: string;
  oper_status: 'up' | 'down' | 'unknown';
  admin_status?: 'up' | 'down' | 'unknown';
  speed?: number | null;
  type?: string | null;
  mac?: string | null;
}

export type StatusFilter = 'all' | 'online' | 'offline';

export type DeviceFilter = 'all' | 'Server' | 'Router' | 'Switch' | 'OLT';

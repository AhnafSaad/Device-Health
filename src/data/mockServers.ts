import { Server, DeviceType } from '../types';

const LOCATIONS = [
  { loc: 'US-East (N. Virginia)', racks: ['Rack A-01', 'Rack A-04', 'Rack A-09', 'Rack A-12', 'Rack B-03'] },
  { loc: 'US-West (Oregon)', racks: ['Rack W-01', 'Rack W-05', 'Rack W-08', 'Rack W-14'] },
  { loc: 'EU-Central (Frankfurt)', racks: ['Rack F-02', 'Rack F-10', 'Rack F-12', 'Rack F-14'] },
  { loc: 'EU-West (London)', racks: ['Rack L-01', 'Rack L-06', 'Rack L-09'] },
  { loc: 'AP-East (Tokyo)', racks: ['Rack T-01', 'Rack T-04', 'Rack T-08'] },
  { loc: 'AP-Southeast (Singapore)', racks: ['Rack S-02', 'Rack S-05', 'Rack S-11'] },
  { loc: 'SA-East (São Paulo)', racks: ['Rack SP-01', 'Rack SP-03'] },
  { loc: 'AF-South (Cape Town)', racks: ['Rack C-02', 'Rack C-07'] },
];

const DEVICE_TYPES: DeviceType[] = ['Server', 'MikroTik', 'Switch', 'OLT'];

const ROLE_PRESETS: Record<DeviceType, string[]> = {
  Server: ['postgres-db', 'k8s-node-worker', 'kafka-broker', 'redis-cluster', 'api-gateway', 'worker-pool'],
  MikroTik: ['edge-router', 'bgp-border-gw', 'vpn-concentrator', 'core-router'],
  Switch: ['spine-switch', 'leaf-tor-sw', 'agg-switch', 'core-backbone-sw'],
  OLT: ['gpon-olt-chassis', 'xgspon-fiber-agg', 'ftth-distribution-olt', 'metro-access-olt'],
};

export const INITIAL_SERVERS: Server[] = Array.from({ length: 60 }, (_, i) => {
  const index = i + 1;
  const deviceType = DEVICE_TYPES[index % DEVICE_TYPES.length];
  const isOffline = index === 8 || index === 21 || index === 37 || index === 52;
  const isWarning = !isOffline && (index % 5 === 0);
  const isCritical = !isOffline && (index % 11 === 0);

  const locObj = LOCATIONS[index % LOCATIONS.length];
  const rack = locObj.racks[index % locObj.racks.length];
  const roles = ROLE_PRESETS[deviceType];
  const role = roles[index % roles.length];
  const prefix = deviceType === 'Server' ? 'srv' : deviceType === 'MikroTik' ? 'mtik' : deviceType === 'Switch' ? 'sw' : 'olt';

  const cpu = isOffline ? 0 : isCritical ? 92 + (index % 7) : isWarning ? 78 + (index % 12) : 18 + (index % 48);
  const ram = isOffline ? 0 : isCritical ? 88 + (index % 10) : isWarning ? 75 + (index % 14) : 28 + (index % 48);
  const disk = isOffline ? 0 : isCritical ? 85 + (index % 12) : 22 + (index % 60);

  const ip = deviceType === 'MikroTik'
    ? `192.168.${(index * 3) % 250 + 1}.${(index * 7) % 250 + 2}`
    : deviceType === 'Switch'
    ? `172.20.${(index * 2) % 250 + 1}.${(index * 5) % 250 + 3}`
    : deviceType === 'OLT'
    ? `172.31.${(index * 4) % 250 + 1}.${(index * 6) % 250 + 4}`
    : `10.${(index * 2) % 250}.${(index * 4) % 250 + 1}.${(index * 9) % 250 + 5}`;

  return {
    id: `dev-${1000 + index}`,
    ip,
    hostname: `${prefix}-${role}-${index.toString().padStart(2, '0')}`,
    status: isOffline ? 'offline' : 'online',
    health: isOffline ? 'Critical' : isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal',
    cpuUsage: cpu,
    ramUsage: ram,
    diskUsage: disk,
    uptime: isOffline ? '0 hrs (Outage)' : `${(index * 17) % 360 + 5} days, ${(index * 3) % 24} hrs`,
    location: locObj.loc,
    rackNumber: rack,
    deviceType,
    snmpCommunity: 'public',
    os: deviceType === 'MikroTik'
      ? 'RouterOS v7.14.3'
      : deviceType === 'Switch'
      ? 'NOS JunOS/EOS 4.28'
      : deviceType === 'OLT'
      ? 'OLT-Firmware v3.2.1'
      : index % 2 === 0 ? 'Ubuntu 24.04 LTS' : 'Debian 12 Bookworm',
    kernel: deviceType === 'Server' ? 'Linux 6.8.0-31-generic' : `${deviceType} RTOS Kernel`,
    loadAverage: isOffline ? '0.00, 0.00, 0.00' : `${(cpu / 50).toFixed(2)}, ${((cpu - 4) / 50).toFixed(2)}, ${((cpu - 8) / 50).toFixed(2)}`,
  };
});

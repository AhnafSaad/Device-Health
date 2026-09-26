/**
 * SNMP OID Mapping Table
 * 
 * Includes:
 * - COMMON_OIDS: Universal SNMP MIB-II (RFC 1213) and IF-MIB (RFC 2863) definitions.
 * - VENDOR_OIDS: Proprietary enterprise MIB definitions keyed by hardware brand.
 * 
 * NOTE: Vendor proprietary OIDs must be verified against real target hardware
 * before trusting in production, as exact enterprise branches can vary by model and firmware version.
 */

export const COMMON_OIDS = {
  // RFC 1213 / SNMPv2-MIB System Group
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  sysServices: '1.3.6.1.2.1.1.7.0',

  // IF-MIB (RFC 2863) Interface Table prefix (1.3.6.1.2.1.2.2.1)
  ifTablePrefix: '1.3.6.1.2.1.2.2.1',
  ifIndex: '1.3.6.1.2.1.2.2.1.1',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifMtu: '1.3.6.1.2.1.2.2.1.4',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8', // 1=up, 2=down, 3=testing, 4=unknown, 5=dormant, 6=notPresent, 7=lowerLayerDown
  ifLastChange: '1.3.6.1.2.1.2.2.1.9',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifInUcastPkts: '1.3.6.1.2.1.2.2.1.11',
  ifInErrors: '1.3.6.1.2.1.2.2.1.14',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
  ifOutUcastPkts: '1.3.6.1.2.1.2.2.1.17',
  ifOutErrors: '1.3.6.1.2.1.2.2.1.20',

  // Primary interface direct values (index 1 fallback)
  ifOperStatus_1: '1.3.6.1.2.1.2.2.1.8.1',
  ifInOctets_1: '1.3.6.1.2.1.2.2.1.10.1',
  ifOutOctets_1: '1.3.6.1.2.1.2.2.1.16.1',

  // Standard Host Resources MIB (RFC 2790) Fallback OIDs
  hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2.1',
  hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6.1',
  hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5.1',
};

export const VENDOR_OIDS = {
  // MikroTik RouterOS (Enterprise 14988)
  MikroTik: {
    cpu: '1.3.6.1.4.1.14988.1.1.1.3.1.0', // verify against real hardware before trusting in production
    cpuAlt: '1.3.6.1.4.1.14988.1.1.1.3.0', // verify against real hardware before trusting in production
    memoryTotal: '1.3.6.1.4.1.14988.1.1.1.1.0', // verify against real hardware before trusting in production
    memoryFree: '1.3.6.1.4.1.14988.1.1.1.2.0', // verify against real hardware before trusting in production
    diskTotal: '1.3.6.1.4.1.14988.1.1.1.5.0', // verify against real hardware before trusting in production
    diskFree: '1.3.6.1.4.1.14988.1.1.1.6.0', // verify against real hardware before trusting in production
  },

  // Cisco Systems (Enterprise 9)
  Cisco: {
    cpu: '1.3.6.1.4.1.9.9.109.1.1.1.1.8.1', // verify against real hardware before trusting in production
    cpu1min: '1.3.6.1.4.1.9.9.109.1.1.1.1.7.1', // verify against real hardware before trusting in production
    cpuLegacy: '1.3.6.1.4.1.9.2.1.58.0', // verify against real hardware before trusting in production
    memoryUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5.1', // verify against real hardware before trusting in production
    memoryFree: '1.3.6.1.4.1.9.9.48.1.1.1.6.1', // verify against real hardware before trusting in production
  },

  // Juniper Networks (Enterprise 2636)
  Juniper: {
    cpu: '1.3.6.1.4.1.2636.3.1.13.1.8.9.1.0.0', // verify against real hardware before trusting in production
    cpuAlt: '1.3.6.1.4.1.2636.3.1.13.1.8.1.1.0.0', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.2636.3.1.13.1.11.9.1.0.0', // verify against real hardware before trusting in production
    memoryAlt: '1.3.6.1.4.1.2636.3.1.13.1.11.1.1.0.0', // verify against real hardware before trusting in production
  },

  // Huawei Technologies (Enterprise 2011)
  Huawei: {
    cpu: '1.3.6.1.4.1.2011.6.3.4.1.2.0.0.0', // verify against real hardware before trusting in production
    cpuAlt: '1.3.6.1.4.1.2011.6.1.1.1.4.0.0.0', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.2011.6.3.5.1.1.2.0.0.0', // verify against real hardware before trusting in production
    memoryAlt: '1.3.6.1.4.1.2011.6.1.2.1.1.2.0.0.0', // verify against real hardware before trusting in production
  },

  // Arista Networks (Enterprise 30065 / RFC 2790)
  Arista: {
    cpu: '1.3.6.1.2.1.25.3.3.1.2.1', // verify against real hardware before trusting in production
    memoryUsed: '1.3.6.1.2.1.25.2.3.1.6.1', // verify against real hardware before trusting in production
    memoryTotal: '1.3.6.1.2.1.25.2.3.1.5.1', // verify against real hardware before trusting in production
  },

  // BDCOM (Enterprise 3320)
  BDCOM: {
    cpu: '1.3.6.1.4.1.3320.9.183.1.1.1.0', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.3320.9.183.1.1.2.0', // verify against real hardware before trusting in production
  },

  // V-SOL (Enterprise 37950)
  'V-SOL': {
    cpu: '1.3.6.1.4.1.37950.1.1.5.10.12.1.1.4.1', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.37950.1.1.5.10.12.1.1.5.1', // verify against real hardware before trusting in production
  },

  // TP-Link (Enterprise 11863)
  'TP-Link': {
    cpu: '1.3.6.1.4.1.11863.6.4.1.1.1.1.2.1', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.11863.6.4.1.1.1.1.3.1', // verify against real hardware before trusting in production
  },

  // Ubiquiti Networks (Enterprise 41112)
  Ubiquiti: {
    cpu: '1.3.6.1.4.1.41112.1.4.1.1.4.1', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.41112.1.4.1.1.5.1', // verify against real hardware before trusting in production
  },

  // Standard/Generic Linux & Other Network Nodes
  Other: {
    cpu: '1.3.6.1.2.1.25.3.3.1.2.1', // verify against real hardware before trusting in production
    memoryUsed: '1.3.6.1.2.1.25.2.3.1.6.1', // verify against real hardware before trusting in production
    memoryTotal: '1.3.6.1.2.1.25.2.3.1.5.1', // verify against real hardware before trusting in production
  },
};

export default {
  COMMON_OIDS,
  VENDOR_OIDS,
};

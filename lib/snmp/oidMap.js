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

  // Standard Host Resources MIB (RFC 2790) OIDs
  hrSystemUptime: '1.3.6.1.2.1.25.1.1.0',
  hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
  hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6.1',
  hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5.1',
};

export const VENDOR_OIDS = {
  // MikroTik RouterOS (Enterprise 14988) — CPU uses standard hrProcessorLoad 1.3.6.1.2.1.25.3.3.1.2 walk
  MikroTik: {
    memoryTotal: '1.3.6.1.4.1.14988.1.1.1.1.0', // verify against real hardware before trusting in production
    memoryFree: '1.3.6.1.4.1.14988.1.1.1.2.0', // verify against real hardware before trusting in production
    diskTotal: '1.3.6.1.4.1.14988.1.1.1.5.0', // verify against real hardware before trusting in production
    diskFree: '1.3.6.1.4.1.14988.1.1.1.6.0', // verify against real hardware before trusting in production
    connectedUsers: '1.3.6.1.4.1.9.9.150.1.1.1.0', // candidate, must be verified against real router (CISCO-AAA-SESSION-MIB casnActiveTableEntries)
    temperature: '1.3.6.1.4.1.14988.1.1.3.10.0', // divide by 10 (Celsius); verify against real hardware before trusting in production
    temperatureDivisor: 10,
    opticalTx: '1.3.6.1.4.1.14988.1.1.19.1.1.9', // unverified column numbers; unverified, test on real hardware (indexed by interface, divide by 1000 for dBm)
    opticalRx: '1.3.6.1.4.1.14988.1.1.19.1.1.10', // unverified column numbers; unverified, test on real hardware (indexed by interface, divide by 1000 for dBm)
    opticalDivisor: 1000,
  },

  // Cisco Systems (Enterprise 9)
  Cisco: {
    cpu: '1.3.6.1.4.1.9.9.109.1.1.1.1.8', // verify against real hardware before trusting in production
    memoryUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5.1', // verify against real hardware before trusting in production
    memoryFree: '1.3.6.1.4.1.9.9.48.1.1.1.6.1', // verify against real hardware before trusting in production
    connectedUsers: '1.3.6.1.4.1.9.9.150.1.1.1.0', // verify against real hardware before trusting in production
    temperature: '1.3.6.1.4.1.9.9.13.1.3.1.3.1', // verify against real hardware before trusting in production
    opticalTx: '1.3.6.1.4.1.9.9.91.1.1.1.1.4.1', // unverified, test on real hardware
    opticalRx: '1.3.6.1.4.1.9.9.91.1.1.1.1.4.2', // unverified, test on real hardware
  },

  // Juniper Networks (Enterprise 2636)
  Juniper: {
    cpu: '1.3.6.1.4.1.2636.3.1.13.1.8', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.2636.3.1.13.1.11.9.1.0.0', // verify against real hardware before trusting in production
    memoryAlt: '1.3.6.1.4.1.2636.3.1.13.1.11.1.1.0.0', // verify against real hardware before trusting in production
    connectedUsers: '1.3.6.1.4.1.2636.3.64.1.1.1.2.0', // verify against real hardware before trusting in production
    temperature: '1.3.6.1.4.1.2636.3.1.13.1.7', // verify against real hardware before trusting in production
    opticalRx: '1.3.6.1.4.1.2636.3.60.1.1.1.1.5', // divide by 100; unverified, test on real hardware
    opticalTx: '1.3.6.1.4.1.2636.3.60.1.1.1.1.7', // tx column unverified (divide by 100); unverified, test on real hardware
    opticalDivisor: 100,
  },

  // Huawei Technologies (Enterprise 2011)
  Huawei: {
    cpu: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5', // indexed by entity, average or take max; verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.2011.6.3.5.1.1.2.0.0.0', // verify against real hardware before trusting in production
    memoryAlt: '1.3.6.1.4.1.2011.6.1.2.1.1.2.0.0.0', // verify against real hardware before trusting in production
    connectedUsers: '1.3.6.1.4.1.2011.5.2.1.14.1.0', // verify against real hardware before trusting in production
    temperature: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.11', // indexed by entity, average or take max; verify against real hardware before trusting in production
  },

  // Arista Networks (Enterprise 30065 / RFC 2790)
  Arista: {
    memoryUsed: '1.3.6.1.2.1.25.2.3.1.6.1', // verify against real hardware before trusting in production
    memoryTotal: '1.3.6.1.2.1.25.2.3.1.5.1', // verify against real hardware before trusting in production
    temperature: '1.3.6.1.2.1.99.1.1.1.4.100006001', // verify against real hardware before trusting in production
    opticalTx: '1.3.6.1.2.1.99.1.1.1.4.100301102', // unverified, test on real hardware
    opticalRx: '1.3.6.1.2.1.99.1.1.1.4.100301103', // unverified, test on real hardware
  },

  // BDCOM (Enterprise 3320)
  BDCOM: {
    cpu: '1.3.6.1.4.1.3320.9.183.1.1.1.0', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.3320.9.183.1.1.2.0', // verify against real hardware before trusting in production
    temperature: '1.3.6.1.4.1.3320.9.183.1.1.3.0', // unverified, test on real hardware
    opticalRx: '1.3.6.1.4.1.3320.101.10.5.1.5', // unverified, test on real hardware (divide by 10)
    opticalTx: '1.3.6.1.4.1.3320.101.10.5.1.6', // unverified, test on real hardware (divide by 10)
    opticalDivisor: 10,
  },

  // V-SOL OLT: no vendor OIDs; uses only sysUpTime, sysName, and hrProcessorLoad
  'V-SOL': {},

  // DBC OLT: no vendor OIDs; uses only sysUpTime, sysName, and hrProcessorLoad
  DBC: {},

  // ZTE OLT: no vendor OIDs; uses only sysUpTime, sysName, and hrProcessorLoad
  ZTE: {},

  // TP-Link (Enterprise 11863)
  'TP-Link': {
    cpu: '1.3.6.1.4.1.11863.6.4.1.1.1.1.2.1', // verify against real hardware before trusting in production
    memory: '1.3.6.1.4.1.11863.6.4.1.1.1.1.3.1', // verify against real hardware before trusting in production
    connectedUsers: '1.3.6.1.4.1.11863.6.4.1.1.1.1.4.1', // verify against real hardware before trusting in production
    temperature: '1.3.6.1.4.1.11863.6.4.1.2.1.1.2.1', // verify against real hardware before trusting in production
  },

  // Standard/Generic Linux & Other Network Nodes
  Other: {
    memoryUsed: '1.3.6.1.2.1.25.2.3.1.6.1', // verify against real hardware before trusting in production
    memoryTotal: '1.3.6.1.2.1.25.2.3.1.5.1', // verify against real hardware before trusting in production
  },
};

export default {
  COMMON_OIDS,
  VENDOR_OIDS,
};

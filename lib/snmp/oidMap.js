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

  // IF-MIB (RFC 2863) ifXTable extensions
  ifName: '1.3.6.1.2.1.31.1.1.1.1',
  ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15',
  ifAlias: '1.3.6.1.2.1.31.1.1.1.18',

  // Primary interface direct values (index 1 fallback)
  ifOperStatus_1: '1.3.6.1.2.1.2.2.1.8.1',
  ifInOctets_1: '1.3.6.1.2.1.2.2.1.10.1',
  ifOutOctets_1: '1.3.6.1.2.1.2.2.1.16.1',

  // Standard Host Resources MIB (RFC 2790) OIDs
  hrSystemUptime: '1.3.6.1.2.1.25.1.1.0',
  hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
  hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6.1',
  hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5.1',

  // hrStorageTable columns (RFC 2790)
  hrStorageTableType: '1.3.6.1.2.1.25.2.3.1.2',
  hrStorageTableDescr: '1.3.6.1.2.1.25.2.3.1.3',
  hrStorageTableAllocUnits: '1.3.6.1.2.1.25.2.3.1.4',
  hrStorageTableSize: '1.3.6.1.2.1.25.2.3.1.5',
  hrStorageTableUsed: '1.3.6.1.2.1.25.2.3.1.6',

  // ENTITY-MIB (RFC 6933)
  entPhysicalDescr: '1.3.6.1.2.1.47.1.1.1.1.2',
  entPhysicalClass: '1.3.6.1.2.1.47.1.1.1.1.5',
  entPhysicalModelName: '1.3.6.1.2.1.47.1.1.1.1.13',
};

export const VENDOR_OIDS = {
  // MikroTik RouterOS (Enterprise 14988) — CPU uses standard hrProcessorLoad 1.3.6.1.2.1.25.3.3.1.2 walk
  MikroTik: {
    mtxrBoardName: '1.3.6.1.4.1.14988.1.1.7.8.0', // candidate, unverified
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

export const HARDWARE_OIDS = {
  // MikroTik RouterOS (Enterprise 14988)
  MikroTik: {
    gaugeName: '1.3.6.1.4.1.14988.1.1.3.100.1.2', // unverified, test on real hardware
    gaugeValue: '1.3.6.1.4.1.14988.1.1.3.100.1.3', // unverified, test on real hardware
    gaugeUnit: '1.3.6.1.4.1.14988.1.1.3.100.1.4', // unverified, test on real hardware (unit 1 = Celsius, 2 = rpm)
    legacyTemperature: '1.3.6.1.4.1.14988.1.1.3.10.0', // unverified, test on real hardware (divide by 10)
    legacyTemperatureDivisor: 10,
    legacyPsu: [
      '1.3.6.1.4.1.14988.1.1.3.15.0', // unverified, test on real hardware (1 = ok, anything else = critical)
      '1.3.6.1.4.1.14988.1.1.3.16.0', // unverified, test on real hardware (1 = ok, anything else = critical)
    ],
    legacyFans: [
      '1.3.6.1.4.1.14988.1.1.3.17.0', // unverified, test on real hardware (rpm)
      '1.3.6.1.4.1.14988.1.1.3.18.0', // unverified, test on real hardware (rpm)
    ],
  },

  // Cisco ENVMON (enum 1=ok 2=warning 3=critical 4=critical 5=not_present 6=critical)
  Cisco: {
    statusEnum: { 1: 'ok', 2: 'warning', 3: 'critical', 4: 'critical', 5: 'not_present', 6: 'critical' },
    psuName: '1.3.6.1.4.1.9.9.13.1.5.1.2', // unverified, test on real hardware
    psuStatus: '1.3.6.1.4.1.9.9.13.1.5.1.3', // unverified, test on real hardware
    fanName: '1.3.6.1.4.1.9.9.13.1.4.1.2', // unverified, test on real hardware
    fanStatus: '1.3.6.1.4.1.9.9.13.1.4.1.3', // unverified, test on real hardware
    temperatureName: '1.3.6.1.4.1.9.9.13.1.3.1.2', // unverified, test on real hardware
    temperatureValue: '1.3.6.1.4.1.9.9.13.1.3.1.3', // unverified, test on real hardware (Celsius)
  },

  // Juniper Operating Table (state 1=warning 2=ok 3=ok 4=warning 5=ok 6=critical 7=ok)
  Juniper: {
    statusEnum: { 1: 'warning', 2: 'ok', 3: 'ok', 4: 'warning', 5: 'ok', 6: 'critical', 7: 'ok' },
    names: '1.3.6.1.4.1.2636.3.1.13.1.5', // unverified, test on real hardware
    state: '1.3.6.1.4.1.2636.3.1.13.1.6', // unverified, test on real hardware
    temperature: '1.3.6.1.4.1.2636.3.1.13.1.7', // unverified, test on real hardware (ignore 0)
  },

  // Server hardware MIB candidates tried in order (first one that returns rows wins)
  Server: [
    {
      name: 'Dell iDRAC',
      statusEnum: { 1: 'warning', 2: 'warning', 3: 'ok', 4: 'warning', 5: 'critical', 6: 'critical' },
      psuStatus: '1.3.6.1.4.1.674.10892.5.4.600.12.1.5', // unverified, test on real hardware
      fanStatus: '1.3.6.1.4.1.674.10892.5.4.700.12.1.5', // unverified, test on real hardware
      fanRpm: '1.3.6.1.4.1.674.10892.5.4.700.12.1.6', // unverified, test on real hardware
      temperatureValue: '1.3.6.1.4.1.674.10892.5.4.700.20.1.6', // unverified, test on real hardware (divide by 10)
      temperatureDivisor: 10,
    },
    {
      name: 'HP iLO',
      statusEnum: { 1: 'warning', 2: 'ok', 3: 'warning', 4: 'critical' },
      psuStatus: '1.3.6.1.4.1.232.6.2.9.3.1.4', // unverified, test on real hardware
      fanStatus: '1.3.6.1.4.1.232.6.2.6.7.1.9', // unverified, test on real hardware
      temperatureValue: '1.3.6.1.4.1.232.6.2.6.8.1.4', // unverified, test on real hardware (Celsius)
      temperatureDivisor: 1,
    },
    {
      name: 'Linux LM-SENSORS',
      temperatureName: '1.3.6.1.4.1.2021.13.16.2.1.2', // unverified, test on real hardware
      temperatureValue: '1.3.6.1.4.1.2021.13.16.2.1.3', // unverified, test on real hardware (divide by 1000)
      temperatureDivisor: 1000,
      fanName: '1.3.6.1.4.1.2021.13.16.3.1.2', // unverified, test on real hardware
      fanRpm: '1.3.6.1.4.1.2021.13.16.3.1.3', // unverified, test on real hardware
    },
  ],

  // Huawei, ZTE, BDCOM, V-SOL, DBC, Arista, Supermicro: no PSU/fan OIDs (keep existing Huawei/BDCOM temperature OIDs)
  Huawei: {
    temperature: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.11', // unverified, test on real hardware
  },
  BDCOM: {
    temperature: '1.3.6.1.4.1.3320.9.183.1.1.3.0', // unverified, test on real hardware
  },
  ZTE: null,
  'V-SOL': null,
  DBC: null,
  Arista: null,
  Supermicro: null,
};

// Enterprise number in sysObjectID (1.3.6.1.4.1.<N>...) -> hardware brand
// enterprise numbers for V-SOL/DBC unverified
export const ENTERPRISE_BRANDS = {
  14988: 'MikroTik',
  9: 'Cisco',
  2636: 'Juniper',
  2011: 'Huawei',
  3320: 'BDCOM',
  3902: 'ZTE',
  30065: 'Arista',
  674: 'Dell',
  232: 'HP',
  10876: 'Supermicro',
  8072: 'Linux',
  311: 'Windows',
};

// Keyword fallback list on sysDescr for brands without a reliable enterprise number
// enterprise numbers for V-SOL/DBC unverified
export const SYSDESCR_BRAND_KEYWORDS = [
  { regex: /v-?sol/i, brand: 'V-SOL' },
  { regex: /\bdbc\b/i, brand: 'DBC' },
  { regex: /mikrotik|routeros/i, brand: 'MikroTik' },
];

// fixed OID for the snmpd extend script named 'disk-lifecycle'; identical on every host using that script name
export const DISK_LIFECYCLE_EXTEND_OID =
  '1.3.6.1.4.1.8072.1.3.2.3.1.1.14.100.105.115.107.45.108.105.102.101.99.121.99.108.101';

// fixed OID for the snmpd extend script named 'ram-health'; identical on every host using that script name; confirmed working value example: '0 0'
export const RAM_HEALTH_EXTEND_OID =
  '1.3.6.1.4.1.8072.1.3.2.3.1.1.10.114.97.109.45.104.101.97.108.116.104';

// fixed OID for the snmpd extend script named 'ram-mc-detail'; confirmed working value example: 'mc0:0:0 mc1:0:0 mc2:0:0 mc3:0:0 '
export const RAM_MC_DETAIL_EXTEND_OID =
  '1.3.6.1.4.1.8072.1.3.2.3.1.1.13.114.97.109.45.109.99.45.100.101.116.97.105.108';

// fixed OID for the snmpd extend script named 'ipmi-health'; identical on every host using that script name
export const IPMI_HEALTH_EXTEND_OID =
  '1.3.6.1.4.1.8072.1.3.2.3.1.1.11.105.112.109.105.45.104.101.97.108.116.104';

// fixed OID for the snmpd extend script named 'disk-io-all'
export const DISK_IO_ALL_EXTEND_OID =
  '1.3.6.1.4.1.8072.1.3.2.3.1.1.11.100.105.115.107.45.105.111.45.97.108.108';

// fixed OID for the snmpd extend script named 'disk-lifecycle-all'
export const DISK_LIFECYCLE_ALL_EXTEND_OID =
  '1.3.6.1.4.1.8072.1.3.2.3.1.1.18.100.105.115.107.45.108.105.102.101.99.121.99.108.101.45.97.108.108';

// Fixed OID for the snmpd extend script named 'hw-identity' (dmidecode-based: manufacturer|model|serial). Server device_type only. Confirmed live value on a real host: 'HP|ProLiant DL380 Gen9|CZ3801C9P8'.
export const HW_IDENTITY_EXTEND_OID =
  '1.3.6.1.4.1.8072.1.3.2.3.1.1.11.104.119.45.105.100.101.110.116.105.116.121';

export const ENTITY_MIB_PHYSICAL_CLASS_BASE = '1.3.6.1.2.1.47.1.1.1.1.5';
export const ENTITY_MIB_SERIAL_BASE = '1.3.6.1.2.1.47.1.1.1.1.11';

// unverified candidate for MikroTik board serial — confirm against real hardware; if it returns empty or wrong data on a given device, that device simply shows no serial, do not treat as an error
export const MIKROTIK_SERIAL_CANDIDATE_OID = '1.3.6.1.4.1.14988.1.1.7.3.0';

// MikroTik RouterOS License Software ID (mtxrLicSoftwareId.0)
export const MIKROTIK_SOFTWARE_ID_OID = '1.3.6.1.4.1.14988.1.1.4.1.0';

export default {
  COMMON_OIDS,
  VENDOR_OIDS,
  HARDWARE_OIDS,
  ENTERPRISE_BRANDS,
  SYSDESCR_BRAND_KEYWORDS,
  DISK_LIFECYCLE_EXTEND_OID,
  RAM_HEALTH_EXTEND_OID,
  RAM_MC_DETAIL_EXTEND_OID,
  IPMI_HEALTH_EXTEND_OID,
  DISK_IO_ALL_EXTEND_OID,
  DISK_LIFECYCLE_ALL_EXTEND_OID,
  HW_IDENTITY_EXTEND_OID,
  ENTITY_MIB_PHYSICAL_CLASS_BASE,
  ENTITY_MIB_SERIAL_BASE,
  MIKROTIK_SERIAL_CANDIDATE_OID,
  MIKROTIK_SOFTWARE_ID_OID,
};

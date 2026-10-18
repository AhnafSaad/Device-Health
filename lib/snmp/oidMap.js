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
    entitySensorTable: '1.3.6.1.4.1.9.9.91.1.1.1.1',
    psuStatusTable: '1.3.6.1.4.1.9.9.117.1.1.2.1',
    fanStatusTable: '1.3.6.1.4.1.9.9.117.1.1.1.1',
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

  // Huawei Technologies (Enterprise 2011 - SmartAX MA5683T / MA5680T / MA5608T / MA5800)
  Huawei: {
    cpu: '1.3.6.1.4.1.2011.6.3.4.1.2', // hwCpuDevDuty table (SmartAX MA5683T/MA5680T)
    cpuTable: '1.3.6.1.4.1.2011.6.3.4.1.2',
    cpu1Min: '1.3.6.1.4.1.2011.6.3.4.1.3', // 1-minute CPU duty
    cpu5Min: '1.3.6.1.4.1.2011.6.3.4.1.4', // 5-minute CPU duty
    cpuMusa: '1.3.6.1.4.1.2011.2.6.7.1.1.2.1.5', // hwMusaBoardCpuRate (SmartAX SCUN/SCUK control board)
    cpuAlt: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5', // hwEntityCpuUsage
    cpuAlt2: '1.3.6.1.4.1.2011.6.3.4.1.3',
    cpuAlt3: '1.3.6.1.4.1.2011.6.1.1.1.2',
    cpuAlt4: '1.3.6.1.4.1.2011.6.1.1.1.4',
    cpuSysAvg: '1.3.6.1.4.1.2011.6.3.1.5', // hwSysAverageCpuUsed
    memory: '1.3.6.1.4.1.2011.6.3.5.1.1.2', // hwMemoryDevDuty table (SmartAX OLT memory usage %)
    memoryBuffer: '1.3.6.1.4.1.2011.6.3.5.1.1.3', // hwBufferDuty
    memorySysAvg: '1.3.6.1.4.1.2011.6.3.1.6', // hwSysAverageBufferUsed
    memoryMusa: '1.3.6.1.4.1.2011.2.6.7.1.1.2.1.6', // hwMusaBoardMemRate
    memoryAlt: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.7', // hwEntityMemUsage
    memoryOlt: '1.3.6.1.4.1.2011.9.48.1', // OLT Memory Usage
    memoryAlt2: '1.3.6.1.4.1.2011.6.3.5.1.1.3',
    memoryAlt3: '1.3.6.1.4.1.2011.6.1.2.1.1.2',
    flash: '1.3.6.1.4.1.2011.6.3.6.1.1.2', // hwFlashDevDuty
    sysNameAlt: '1.3.6.1.4.1.2011.6.3.1.1.0',
    model: '1.3.6.1.4.1.2011.6.3.3.1.1.1',
    modelAlt: '1.3.6.1.4.1.2011.2.6.1.1.1.2',
    modelEntity: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.6',
    connectedUsers: '1.3.6.1.4.1.2011.5.2.1.14.1.0',
    temperature: '1.3.6.1.4.1.2011.6.3.3.1.1.2', // hwBoardTemperature table
    temperatureMusa: '1.3.6.1.4.1.2011.2.6.7.1.1.2.1.10', // hwMusaBoardTemperature
    temperatureSlot: '1.3.6.1.4.1.2011.6.3.3.2.1.13', // hwSlotTemprature
    temperatureAlt: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.11', // hwEntityTemperature
    temperatureAlt2: '1.3.6.1.4.1.2011.2.6.1.4.1.1',
    opticalRx: '1.3.6.1.4.1.2011.6.128.1.1.2.51.1.2', // hwGponOntOpticalDdmRxPower
    opticalTx: '1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4', // hwGponOntOpticalDdmTxPower
    opticalDivisor: 100,
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
    cpu: '1.3.6.1.4.1.3320.9.109.1.1.1.1.4.1', // 1-minute CPU usage (BDCOM-PROCESS-MIB bdpmCPUTotal1min.1)
    cpuTable: '1.3.6.1.4.1.3320.9.109.1.1.1.1.4', // bdpmCPUTotal1min table
    cpu5sec: '1.3.6.1.4.1.3320.9.109.1.1.1.1.2.1', // bdpmCPUTotal5sec.1
    cpuAlt: '1.3.6.1.4.1.3320.3.6.10.1.12.1', // nmscardCPUUtilization.1 (NMS-CHASSIS)
    cpuAlt2: '1.3.6.1.4.1.3320.9.183.1.1.1.0',
    memory: '1.3.6.1.4.1.3320.9.48.1.2.1.1.1', // bdcomMemoryPoolUtil1Min.1 (%)
    memoryTable: '1.3.6.1.4.1.3320.9.48.1.2.1.1', // bdcomMemoryPoolUtil1Min table
    memoryScalar: '1.3.6.1.4.1.3320.9.48.0', // nmsMemoryPoolUtilization scalar %
    memoryCard: '1.3.6.1.4.1.3320.3.6.10.1.12.1', // nmscardMemoryUsage %
    memoryAlt: '1.3.6.1.4.1.3320.9.183.1.1.2.0',
    temperature: '1.3.6.1.4.1.3320.9.181.1.1.7.0', // cardSysTemperature (NMS-CARD-SYS-MIB Global box temp °C)
    temperatureBox: '1.3.6.1.4.1.3320.3.6.14.0', // NMS-CHASSIS box temperature
    temperatureCard: '1.3.6.1.4.1.3320.3.6.10.1.13', // nmscardTemperature table
    model: '1.3.6.1.4.1.3320.3.6.10.1.3.1', // nmscardDescr.1
    modelName: '1.3.6.1.4.1.3320.3.6.21.0', // nmsSwitchName
    serial: '1.3.6.1.4.1.3320.3.6.10.1.4.1', // nmscardSerial.1
    swVersion: '1.3.6.1.4.1.3320.3.6.10.1.6.1', // nmscardSwVersion.1
    opticalRx: '1.3.6.1.4.1.3320.101.108.1.3', // OLT PON port Rx power (0.1 dBm)
    opticalRxAlt: '1.3.6.1.4.1.3320.101.10.5.1.5', // ONU PON Rx
    opticalTx: '1.3.6.1.4.1.3320.101.107.1.3', // OLT PON Tx power
    opticalTxAlt: '1.3.6.1.4.1.3320.101.10.5.1.6', // ONU PON Tx
    opticalDivisor: 10,
  },

  // V-SOL OLT (Enterprise 37950 / 50058 / 57531 / Cortina 3320 compatibility: V1600D, V1600D4, V1600G, V1600G0, V1600GS, V1600GT, V1600X)
  'V-SOL': {
    // CPU Utilization OID candidates (v1600dSysCpu1MinAvg, v1600dSysCpuUsage, scalar, Cortina)
    cpu1Min: '1.3.6.1.4.1.37950.1.1.5.10.12.3.1.0', // v1600dSysCpu1MinAvg (1-minute moving average CPU %)
    cpu1MinScalar: '1.3.6.1.4.1.37950.1.1.5.10.12.3.1',
    cpu: '1.3.6.1.4.1.37950.1.1.5.10.12.3.0', // v1600dSysCpuUsage / cpuLoad (5-second real-time CPU %)
    cpuScalar: '1.3.6.1.4.1.37950.1.1.5.10.12.3',
    cpuV1600d: '1.3.6.1.4.1.37950.1.1.5.10.12.3.0',
    cpuAlt: '1.3.6.1.4.1.37950.1.1.1.8.0', // V-SOL scalar CPU %
    cpuTable: '1.3.6.1.4.1.37950.1.1.5.1.1.3.1.1', // V-SOL MIB CPU %
    cpuCortina: '1.3.6.1.4.1.3320.9.109.1.1.1.1.4.1', // 1-minute CPU (Cortina CS8032 EPON)
    cpuCortinaCard: '1.3.6.1.4.1.3320.3.6.10.1.11.1', // nmsCpuUsage.1
    cpu50058: '1.3.6.1.4.1.50058.1.1.1.8.0',
    cpu57531: '1.3.6.1.4.1.57531.1.1.1.8.0',

    // Memory Utilization OID candidates (v1600dSysMemUsage, total/used/free KB pools, Cortina)
    memory: '1.3.6.1.4.1.37950.1.1.5.10.12.4.0', // v1600dSysMemUsage (RAM utilization %)
    memoryScalar: '1.3.6.1.4.1.37950.1.1.5.10.12.4',
    memoryTotal: '1.3.6.1.4.1.37950.1.1.5.10.12.4.1.0', // v1600dSysMemTotal (KB)
    memoryUsed: '1.3.6.1.4.1.37950.1.1.5.10.12.4.2.0', // v1600dSysMemUsed (KB)
    memoryFree: '1.3.6.1.4.1.37950.1.1.5.10.12.4.3.0', // v1600dSysMemFree (KB)
    memoryAlt: '1.3.6.1.4.1.37950.1.1.1.9.0',
    memoryTable: '1.3.6.1.4.1.37950.1.1.5.1.1.4.1.1',
    memoryCortinaPool: '1.3.6.1.4.1.3320.9.48.1.0',
    memoryCortinaCard: '1.3.6.1.4.1.3320.3.6.10.1.12.1', // nmsMemoryUsage.1 (%)

    // Temperature (°C)
    temperatureBox: '1.3.6.1.4.1.37950.1.1.5.10.12.5.9.0', // v1600dSysTemp (chassis ambient box temp °C)
    temperatureBoxScalar: '1.3.6.1.4.1.37950.1.1.5.10.12.5.9',
    temperatureCpu: '1.3.6.1.4.1.37950.1.1.5.10.12.5.8.0', // v1600dCpuTemp (CPU/SoC die temp °C)
    temperatureCpuScalar: '1.3.6.1.4.1.37950.1.1.5.10.12.5.8',
    temperature: '1.3.6.1.4.1.37950.1.1.5.10.12.5.9.0',
    temperatureCortina: '1.3.6.1.4.1.3320.3.6.14.0', // nmsBoxTemp (°C)
    temperatureCortinaCard: '1.3.6.1.4.1.3320.3.6.10.1.13', // nmscardTemperature table

    // Hardware Identity & Inventory
    model: '1.3.6.1.4.1.37950.1.1.5.10.12.7.0', // v1600dSysModelName (e.g. "V1600D4-DP", "V1600G1")
    modelScalar: '1.3.6.1.4.1.37950.1.1.5.10.12.7',
    serial: '1.3.6.1.4.1.37950.1.1.5.10.12.5.11.0', // v1600dSysSerialNumber
    serialScalar: '1.3.6.1.4.1.37950.1.1.5.10.12.5.11',
    firmware: '1.3.6.1.4.1.37950.1.1.5.10.12.8.0', // v1600dSysFirmwareVer
    macAddress: '1.3.6.1.4.1.37950.1.1.5.10.12.9.0', // v1600dSysBaseMacAddr
    sysNameV1600d: '1.3.6.1.4.1.37950.1.1.5.10.12.5.3.0',

    // Subscriber ONUs & Active Connections
    connectedUsers: '1.3.6.1.4.1.37950.1.1.5.10.12.10.0', // v1600dGlobalOnlineOnuCount (global online ONUs)
    connectedUsersTable: '1.3.6.1.4.1.37950.1.1.5.10.1.3.1.2', // v1600dPortOnlineOnuCount (per-port online ONUs)
    ponPortStatus: '1.3.6.1.4.1.37950.1.1.5.10.1.2.1.4', // v1600dPonPortOpStatus (1=up, 2=down)

    // Optical Tx / Rx Power (dBm, divide by 10)
    opticalTx: '1.3.6.1.4.1.37950.1.1.5.10.1.4.1.3', // oltPonTxPower (OLT PON port Tx power /10)
    opticalRx: '1.3.6.1.4.1.3320.101.108.1.3', // ponOpticsRxPower (OLT PON Rx power /10)
    opticalRxOnu: '1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.6', // v1600dOnuRxPower (EPON ONU Rx /10)
    opticalRxGponOnu: '1.3.6.1.4.1.37950.1.1.6.1.1.3.1.3', // gOnuRxPower (GPON ONU Rx /10)
    opticalRxCortina: '1.3.6.1.4.1.3320.101.10.5.1.5', // opModuleRxPower
    opticalDivisor: 10,
  },

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

// Ensure both 'V-SOL' and 'VSOL' resolve to the same vendor map
VENDOR_OIDS['VSOL'] = VENDOR_OIDS['V-SOL'];

/**
 * from V-SOL 37950 native MIB documentation — unconfirmed against real hardware, GET individually with try/catch, never walk
 */
export const VSOL_NATIVE_OIDS = {
  cpuUsage: '1.3.6.1.4.1.37950.1.1.5.10.12.3.0',       // v1600dSysCpuUsage, percent 0-100
  memUsagePercent: '1.3.6.1.4.1.37950.1.1.5.10.12.4.0', // v1600dSysMemUsage, percent 0-100
  memTotalKB: '1.3.6.1.4.1.37950.1.1.5.10.12.4.1.0',    // v1600dSysMemTotal, KB
  memUsedKB: '1.3.6.1.4.1.37950.1.1.5.10.12.4.2.0',     // v1600dSysMemUsed, KB
  sysTempC: '1.3.6.1.4.1.37950.1.1.5.10.12.5.9.0',      // v1600dSysTemp, degrees C, direct integer
  fanStatus: '1.3.6.1.4.1.37950.1.1.5.10.12.11.1.0',    // confirmed working on live V1600G0 hardware; not in vendor MIB docs but returns a usable value on this unit. GET-only, 1=ok, else=critical
  cpuTempC: '1.3.6.1.4.1.37950.1.1.5.10.12.5.8.0',      // v1600dCpuTemp, degrees C, direct integer
  // confirmed via vendor MIB analysis — only present on firmware built after ~May 2021; older firmware will return NoSuchObject here, which is expected and must fail silently to null, not an error.
  serialNumber: '1.3.6.1.4.1.37950.1.1.5.10.12.5.11.0', // sysSerialNumber, under the systemInfo sub-branch
  modelName: '1.3.6.1.4.1.37950.1.1.5.10.12.7.0',       // v1600dSysModelName, DisplayString
  firmwareVer: '1.3.6.1.4.1.37950.1.1.5.10.12.8.0',     // v1600dSysFirmwareVer, DisplayString
  sysHostName: '1.3.6.1.4.1.37950.1.1.5.10.12.5.1.0',    // sysHostName under systemInfo (.12.5.1.0)
  sysHardVersion: '1.3.6.1.4.1.37950.1.1.5.10.12.5.5.0', // sysHardVersion board serial / hardware revision
  sysMac: '1.3.6.1.4.1.37950.1.1.5.10.12.5.7.0',         // sysMac backplane base MAC address
  ponTransceiverTemp: '1.3.6.1.4.1.37950.1.1.5.10.13.1.1.2', // PON Transceiver Temperature
  ponTxPower: '1.3.6.1.4.1.37950.1.1.5.10.13.1.1.5',         // PON Port Transmit (TX) Power
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

  // Cisco ENVMON & Nexus CISCO-ENTITY-FRU-CONTROL-MIB / CISCO-ENTITY-SENSOR-MIB
  Cisco: {
    statusEnum: { 1: 'ok', 2: 'warning', 3: 'critical', 4: 'critical', 5: 'not_present', 6: 'critical' },
    psuName: '1.3.6.1.4.1.9.9.13.1.5.1.2', // unverified, test on real hardware
    psuStatus: '1.3.6.1.4.1.9.9.13.1.5.1.3', // unverified, test on real hardware
    fanName: '1.3.6.1.4.1.9.9.13.1.4.1.2', // unverified, test on real hardware
    fanStatus: '1.3.6.1.4.1.9.9.13.1.4.1.3', // unverified, test on real hardware
    temperatureName: '1.3.6.1.4.1.9.9.13.1.3.1.2', // unverified, test on real hardware
    temperatureValue: '1.3.6.1.4.1.9.9.13.1.3.1.3', // unverified, test on real hardware (Celsius)
    cefcFRUPowerStatusTable: '1.3.6.1.4.1.9.9.117.1.1.2.1',
    cefcFanTrayStatusTable: '1.3.6.1.4.1.9.9.117.1.1.1.1',
    entitySensorTable: '1.3.6.1.4.1.9.9.91.1.1.1.1',
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

  // Huawei OLT (SmartAX MA5683T / MA5680T / MA5608T / MA5800): temperature, fans, and power supplies
  Huawei: {
    statusEnum: { 1: 'ok', 2: 'critical', 3: 'warning' },
    temperature: '1.3.6.1.4.1.2011.6.3.3.1.1.2', // hwBoardTemperature table
    temperatureMusa: '1.3.6.1.4.1.2011.2.6.7.1.1.2.1.10', // hwMusaBoardTemperature
    temperatureSlot: '1.3.6.1.4.1.2011.6.3.3.2.1.13', // hwSlotTemprature
    temperatureEntity: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.11', // hwEntityTemperature
    fanStatus: '1.3.6.1.4.1.2011.6.3.3.3.1.2', // hwFanStatus table (1=normal/ok, 2=abnormal/critical)
    fanSpeed: '1.3.6.1.4.1.2011.6.3.3.3.1.3', // hwFanSpeed table (RPM)
    fanTable: '1.3.6.1.4.1.2011.6.3.3.3.1', // hwFanTable
    fanEntityState: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.1', // hwEntityFanState
    psuStatus: '1.3.6.1.4.1.2011.5.25.31.1.1.18.1.6', // hwEntityPwrState (1=supply, 2=notsupply)
    psuTable: '1.3.6.1.4.1.2011.5.25.31.1.1.18.1', // hwPwrStatusTable
    psuFramePower: '1.3.6.1.4.1.2011.2.6.7.1.1.1.1.11', // hwMusaFramePower
  },
  // BDCOM (Enterprise 3320 - OLT and Switch candidate OIDs)
  BDCOM: {
    statusEnum: { 1: 'ok', 2: 'critical', 3: 'warning' },
    // Temperature (cardSysTemperature scalar, nmscardTemperature table, Box temp)
    cardSysTemperature: '1.3.6.1.4.1.3320.9.181.1.1.7.0',
    cardSysTemperatureScalar: '1.3.6.1.4.1.3320.9.181.1.1.7',
    temperatureCard: '1.3.6.1.4.1.3320.3.6.10.1.13',
    temperatureBox: '1.3.6.1.4.1.3320.3.6.14.0',
    temperatureBoxScalar: '1.3.6.1.4.1.3320.3.6.14',
    temperatureLegacy: '1.3.6.1.4.1.3320.9.183.1.1.3.0',
    temperatureValue: '1.3.6.1.4.1.3320.9.2.1.1.0',

    // Power Supplies (powerStatus scalar dual redundancy: 1=A, 2=B, 3=both ok, 4=fail; powerExtDefTable modular)
    powerStatus: '1.3.6.1.4.1.3320.9.189.1.0',
    powerStatusScalar: '1.3.6.1.4.1.3320.9.189.1',
    psuExtStatus: '1.3.6.1.4.1.3320.9.189.5.1.1.4', // 1=normal, 2=fail
    psuExtPresence: '1.3.6.1.4.1.3320.9.189.5.1.1.3', // 1=present, 2=absent
    psuStatus: '1.3.6.1.4.1.3320.9.189.1.1.2',
    psuTableAlt: '1.3.6.1.4.1.3320.9.189.1.1',
    psuCardStatus: '1.3.6.1.4.1.3320.3.6.10.1.10',

    // Cooling Fans (nmsFanTable modern table: 1.3.6.1.4.1.3320.9.187.5.1.1; legacy table; scalars)
    fanStatusModern: '1.3.6.1.4.1.3320.9.187.5.1.1.4', // 1=normal, 2=abnormal/fail
    fanRpmModern: '1.3.6.1.4.1.3320.9.187.5.1.1.6', // Tachometer RPM
    fanPresenceModern: '1.3.6.1.4.1.3320.9.187.5.1.1.5', // 1=present, 2=absent
    fanStatusOld: '1.3.6.1.4.1.3320.9.187.4.1.2', // legacy table
    fanSpeedOld: '1.3.6.1.4.1.3320.9.187.4.1.3',
    fanStatusScalar: '1.3.6.1.4.1.3320.9.187.1.0', // 1=normal, 2=stop/fail
    fan1RunningStatus: '1.3.6.1.4.1.3320.9.187.3.1.0', // 1=normal, 2=stop/fail
    fanStatus: '1.3.6.1.4.1.3320.9.187.1.1.2',
    fanStatusAlt2: '1.3.6.1.4.1.3320.9.187.4',
    fanCardStatus: '1.3.6.1.4.1.3320.3.6.10.1.11',
  },
  ZTE: null,
  'V-SOL': VSOL_NATIVE_OIDS,
  DBC: null,
  Arista: null,
  Supermicro: null,
};

HARDWARE_OIDS['VSOL'] = HARDWARE_OIDS['V-SOL'];

// Enterprise number in sysObjectID (1.3.6.1.4.1.<N>...) -> hardware brand
export const ENTERPRISE_BRANDS = {
  14988: 'MikroTik',
  9: 'Cisco',
  2636: 'Juniper',
  2011: 'Huawei',
  3320: 'BDCOM',
  37950: 'V-SOL',
  50058: 'V-SOL',
  57531: 'V-SOL',
  55555: 'V-SOL',
  3902: 'ZTE',
  30065: 'Arista',
  674: 'Dell',
  232: 'HP',
  10876: 'Supermicro',
  8072: 'Linux',
  311: 'Windows',
};

// Keyword fallback list on sysDescr for brands without a reliable enterprise number
export const SYSDESCR_BRAND_KEYWORDS = [
  { regex: /v-?sol|vsolution|v-solution|\bv1600|\bv280/i, brand: 'V-SOL' },
  { regex: /\bdbc\b/i, brand: 'DBC' },
  { regex: /mikrotik|routeros/i, brand: 'MikroTik' },
  { regex: /\bbd-?com\b/i, brand: 'BDCOM' },
  { regex: /\bhuawei\b|smartax|\bma56\d{2}|frame-300/i, brand: 'Huawei' },
  { regex: /\bzte\b/i, brand: 'ZTE' },
  { regex: /\bcisco\b/i, brand: 'Cisco' },
  { regex: /\bjuniper\b/i, brand: 'Juniper' },
  { regex: /\bdell\b/i, brand: 'Dell' },
  { regex: /\bhp\b|proliant/i, brand: 'HP' },
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

// Candidate serial OIDs for Huawei OLTs (SmartAX MA5683T, MA5680T, MA5608T, MA5800)
export const HUAWEI_SERIAL_CANDIDATE_OIDS = [
  '1.3.6.1.4.1.2011.6.3.3.1.1.19.0', // hwFrameGponDeviceSn (Frame serial number instance .0)
  '1.3.6.1.4.1.2011.6.3.3.1.1.19.1', // Frame 1
  '1.3.6.1.4.1.2011.6.3.3.1.1.19.0.0',
  '1.3.6.1.4.1.2011.6.3.3.1.1.19', // hwFrameGponDeviceSn table root
  '1.3.6.1.4.1.2011.6.3.3.2.1.7.0.0', // hwBoardSerialNum subrack 0 slot 0
  '1.3.6.1.4.1.2011.6.3.3.2.1.7.0.1', // hwBoardSerialNum subrack 0 slot 1
  '1.3.6.1.4.1.2011.6.3.3.2.1.7.0.6', // hwBoardSerialNum subrack 0 slot 6
  '1.3.6.1.4.1.2011.6.3.3.2.1.7.0.7', // hwBoardSerialNum subrack 0 slot 7 (SCUN control board)
  '1.3.6.1.4.1.2011.6.3.3.2.1.7.0.8', // hwBoardSerialNum subrack 0 slot 8 (SCUN control board)
  '1.3.6.1.4.1.2011.6.3.3.2.1.7', // hwBoardSerialNum table root
  '1.3.6.1.4.1.2011.6.3.3.1.1.4.0.0',
  '1.3.6.1.4.1.2011.6.3.3.1.1.4.0.7',
  '1.3.6.1.4.1.2011.6.3.3.1.1.4.0.8',
  '1.3.6.1.4.1.2011.6.3.3.1.1.4', // hwBoardSerialNum table
  '1.3.6.1.4.1.2011.2.6.2.2.1.1.2', // hwDeviceSerialNumber
  '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.11', // hwEntityMfgSerialNum
  '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.10', // hwEntityBomEn
  '1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3', // hwGponDeviceSerial
  '1.3.6.1.2.1.47.1.1.1.1.11.1', // entPhysicalSerialNum chassis
  '1.3.6.1.2.1.47.1.1.1.1.11.2',
  '1.3.6.1.2.1.47.1.1.1.1.11.7',
  '1.3.6.1.2.1.47.1.1.1.1.11.8',
];

// Candidate serial OIDs for BDCOM OLTs and switches (P3608, P3616, P3616-2TE, GP3600, S2500, S3900)
export const BDCOM_SERIAL_CANDIDATE_OIDS = [
  '1.3.6.1.4.1.3320.3.6.10.1.4.1', // NMS-CHASSIS nmscardSerial.1 (factory hardware serial number)
  '1.3.6.1.4.1.3320.3.6.10.1.4', // nmscardSerial table
  '1.3.6.1.4.1.3320.3.6.16.1.4.1', // nmssubcardSerial.1 (subcard serial)
  '1.3.6.1.4.1.3320.3.6.16.1.4',
  '1.3.6.1.4.1.3320.3.6.3.0', // nmschassisId (base chassis MAC / identifier)
  '1.3.6.1.4.1.3320.9.184.2.1.3.1', // BDCOM serial candidate
  '1.3.6.1.4.1.3320.9.184.2.1.3',
  '1.3.6.1.4.1.3320.101.10.1.1.2.1', // BDCOM OLT serial
  '1.3.6.1.4.1.3320.101.10.1.1.79', // EPON ONU / card serial
  '1.3.6.1.4.1.3320.3.6.10.1.2.1', // BDCOM card serial
  '1.3.6.1.4.1.3320.9.109.1.1.1.1.1',
  '1.3.6.1.4.1.3320.9.254.1.1.1.1.1',
  '1.3.6.1.2.1.47.1.1.1.1.11.1',
];

// Candidate serial OIDs for V-SOL OLTs (V1600D, V1600G, V1600G0, V1600GT, V1600GS)
export const VSOL_SERIAL_CANDIDATE_OIDS = [
  '1.3.6.1.4.1.37950.1.1.5.10.12.5.11.0', // v1600dSysSerialNumber (Native V-SOL system chassis serial)
  '1.3.6.1.4.1.37950.1.1.5.10.12.5.11',
  '1.3.6.1.2.1.47.1.1.1.1.11.1', // ENTITY-MIB entPhysicalSerialNum.1 (Standard physical chassis serial)
  '1.3.6.1.4.1.25355.3.2.6.3.2.1.11.0', // HIOSO / Cortina / BDCOM shared SDK legacy serial
  '1.3.6.1.4.1.37950.1.1.5.10.12.5.5.0', // sysHardVersion (PCB hardware revision / board serial)
  '1.3.6.1.4.1.37950.1.1.5.10.12.5.7.0', // sysMac (immutable base backplane MAC address)
  '1.3.6.1.4.1.3320.3.6.1.1.5.1', // nmsCardSerialNumber.1 (Cortina CS8032 EPON serial)
  '1.3.6.1.4.1.3320.3.6.1.1.5',
  '1.3.6.1.4.1.37950.1.1.5.10.12.5.1.0', // V1600D MIB v1600dSysCfg systemInfo hardware serial
  '1.3.6.1.4.1.37950.1.1.5.10.12.5.1', // scalar instance
  '1.3.6.1.4.1.37950.1.1.1.4.0', // V-SOL scalar serial number
  '1.3.6.1.4.1.37950.1.1.1.4', // V-SOL serial without .0 instance
  '1.3.6.1.4.1.37950.1.1.1.12.0', // V-SOL alternate serial
  '1.3.6.1.4.1.37950.1.1.5.1.1.2.1.1', // V-SOL MIB card serial
  '1.3.6.1.4.1.37950.1.1.5.1.1.2', // V-SOL MIB card serial subtree
  '1.3.6.1.4.1.37950.1.1.5.10.1.1.1.1.1', // slot serial
  '1.3.6.1.4.1.37950.1.1.6.1.1.1.1.1',
  '1.3.6.1.4.1.37950.1.1.2.1.1.0',
  '1.3.6.1.4.1.37950.1.1.5.10.12.1.1.0',
  '1.3.6.1.4.1.37950.1.2.1.1.0',
  '1.3.6.1.4.1.50058.1.1.1.4.0', // V-SOL enterprise 50058 serial
  '1.3.6.1.4.1.50058.1.1.1.4',
  '1.3.6.1.4.1.57531.1.1.1.4.0',
  '1.3.6.1.4.1.3320.9.184.2.1.3.1', // Cortina / BDCOM candidate serial
  '1.3.6.1.4.1.3320.9.184.2.1.3',
  '1.3.6.1.4.1.3320.101.10.1.1.2.1', // Cortina candidate serial
  '1.3.6.1.4.1.3320.3.6.10.1.2.1', // Cortina card serial
  '1.3.6.1.4.1.37950.1.1.5.10.3.10', // V-SOL MAC address
  '1.3.6.1.4.1.37950.1.1.1.5.0', // V-SOL scalar MAC address
  '1.3.6.1.2.1.17.1.1.0', // dot1dBaseBridgeAddress (Bridge MAC as authentic fallback)
  '1.3.6.1.2.1.2.2.1.6.1', // ifPhysAddress index 1
  '1.3.6.1.2.1.47.1.1.1.1.11.1',
  '1.3.6.1.2.1.47.1.1.1.1.11.2',
  '1.3.6.1.2.1.47.1.1.1.1.11.3',
  '1.3.6.1.2.1.47.1.1.1.1.11.4',
];

// CISCO-ENTITY-SENSOR-MIB, confirmed working on live Cisco Nexus hardware for optical dBm and temperature sensors.
// Type 14 = dBm (hundredths, divide by 100), Type 8 = Celsius (millidegrees 10^-3 on NX-OS, e.g. 41492 = 41.49 °C).
export const CISCO_ENTITY_SENSOR_TABLE = Object.assign(new String('1.3.6.1.4.1.9.9.91.1.1.1.1'), {
  entSensorType: '1',
  entSensorPrecision: '3',
  entSensorValue: '4',
  entSensorStatus: '5',
  columns: {
    entSensorType: '1',
    entSensorPrecision: '3',
    entSensorValue: '4',
    entSensorStatus: '5',
  },
});
export const CISCO_ENTITY_SENSOR_COLUMNS = {
  entSensorType: '1',
  entSensorPrecision: '3',
  entSensorValue: '4',
  entSensorStatus: '5',
};

// Cisco FRU control OIDs for PSU and Fan monitoring (CISCO-ENTITY-FRU-CONTROL-MIB).
// Note: cefcFRUPowerStatusTable.3 is cefcFRUCurrent (FRUCurrentType, current measurement in cefcPowerUnits, NOT watts).
export const CISCO_PSU_STATUS_TABLE = Object.assign(new String('1.3.6.1.4.1.9.9.117.1.1.2.1'), {
  operStatus: '1',
  columns: {
    operStatus: '1',
  },
});
export const CISCO_PSU_STATUS_COLUMNS = {
  operStatus: '2', // cefcFRUPowerOperStatus (column .2)
};

export const CISCO_FAN_STATUS_TABLE = Object.assign(new String('1.3.6.1.4.1.9.9.117.1.1.1.1'), {
  status: '1',
  columns: {
    status: '1',
  },
});
export const CISCO_FAN_STATUS_COLUMNS = {
  status: '1',
};

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
  HUAWEI_SERIAL_CANDIDATE_OIDS,
  BDCOM_SERIAL_CANDIDATE_OIDS,
  VSOL_SERIAL_CANDIDATE_OIDS,
  VSOL_NATIVE_OIDS,
  CISCO_ENTITY_SENSOR_TABLE,
  CISCO_ENTITY_SENSOR_COLUMNS,
  CISCO_PSU_STATUS_TABLE,
  CISCO_PSU_STATUS_COLUMNS,
  CISCO_FAN_STATUS_TABLE,
  CISCO_FAN_STATUS_COLUMNS,
};
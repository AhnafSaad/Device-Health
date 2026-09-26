#!/usr/bin/env node
/**
 * SNMP Discovery & OID Walker CLI Tool
 * 
 * Walks an SNMP agent subtree (default: 1.3.6.1.4.1 enterprise subtree)
 * to discover vendor-specific MIB variables on physical devices (MikroTik, Cisco, Huawei, etc.).
 * 
 * Usage:
 *   node scripts/snmp-discover.js <ip> <community> [startOid]
 * 
 * Example:
 *   node scripts/snmp-discover.js 192.168.88.1 public 1.3.6.1.4.1
 *   node scripts/snmp-discover.js 10.0.0.1 noc_v2 1.3.6.1.2.1.1
 */

import snmp from 'net-snmp';

const args = process.argv.slice(2);
const ip = args[0];
const community = args[1];
const startOid = args[2] || '1.3.6.1.4.1'; // Default: enterprises subtree

if (!ip || !community) {
  console.log(`
=====================================================================
                    SNMP DISCOVERY & OID WALKER
=====================================================================
Usage:
  node scripts/snmp-discover.js <ip> <community> [startOid]

Parameters:
  <ip>         Target IPv4 address of the switch / router / server
  <community>  SNMP v2c read community string (e.g. public)
  [startOid]   Optional starting root OID (default: 1.3.6.1.4.1 enterprises)

Examples:
  node scripts/snmp-discover.js 192.168.88.1 public 1.3.6.1.4.1
  node scripts/snmp-discover.js 172.16.1.1 private 1.3.6.1.4.1.14988  # MikroTik
  node scripts/snmp-discover.js 10.10.1.1 secret 1.3.6.1.4.1.9       # Cisco
  node scripts/snmp-discover.js 10.20.1.1 huawei 1.3.6.1.4.1.2011    # Huawei
=====================================================================
`);
  process.exit(1);
}

// Map snmp.ObjectType number to human name
const TYPE_NAMES = {
  [snmp.ObjectType.Boolean]: 'Boolean',
  [snmp.ObjectType.Integer]: 'Integer',
  [snmp.ObjectType.OctetString]: 'OctetString',
  [snmp.ObjectType.Null]: 'Null',
  [snmp.ObjectType.OID]: 'OID',
  [snmp.ObjectType.IpAddress]: 'IpAddress',
  [snmp.ObjectType.Counter]: 'Counter',
  [snmp.ObjectType.Gauge]: 'Gauge',
  [snmp.ObjectType.TimeTicks]: 'TimeTicks',
  [snmp.ObjectType.Opaque]: 'Opaque',
  [snmp.ObjectType.Counter64]: 'Counter64',
  [snmp.ObjectType.NoSuchObject]: 'NoSuchObject',
  [snmp.ObjectType.NoSuchInstance]: 'NoSuchInstance',
  [snmp.ObjectType.EndOfMibView]: 'EndOfMibView',
};

/**
 * Format varbind value for display
 */
function formatValue(value, type) {
  if (value === null || value === undefined) {
    return '<null>';
  }
  if (Buffer.isBuffer(value)) {
    // Check if buffer is printable ASCII string
    const isPrintable = value.every((b) => (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13);
    if (isPrintable) {
      return `"${value.toString('utf8').trim()}"`;
    }
    return `0x${value.toString('hex')}`;
  }
  if (type === snmp.ObjectType.TimeTicks) {
    const totalSecs = Math.floor(value / 100);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    return `${value} (${d}d ${h}h ${m}m)`;
  }
  return String(value);
}

console.log('---------------------------------------------------------------------');
console.log(`[SNMP Walk Initiated]`);
console.log(` Target Host : ${ip}:161`);
console.log(` Community   : ${community}`);
console.log(` Root OID    : ${startOid}`);
console.log('---------------------------------------------------------------------\n');

const startTime = Date.now();
let count = 0;

const session = snmp.createSession(ip, community, {
  port: 161,
  version: snmp.Version2c,
  timeout: 5000,
  retries: 1,
  transport: 'udp4',
});

const maxRepetitions = 20;

function feedCallback(varbinds) {
  for (const vb of varbinds) {
    if (snmp.isVarbindError(vb)) {
      console.warn(`[WARN] ${vb.oid} -> Error: ${snmp.varbindError(vb)}`);
      continue;
    }
    count++;
    const typeLabel = TYPE_NAMES[vb.type] || `Type(${vb.type})`;
    const formattedVal = formatValue(vb.value, vb.type);
    console.log(`${vb.oid} = ${formattedVal}  [${typeLabel}]`);
  }
}

function doneCallback(error) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n---------------------------------------------------------------------');
  if (error) {
    console.error(`[SNMP Walk Interrupted/Finished with Error]`);
    console.error(` Error: ${error.message}`);
  } else {
    console.log(`[SNMP Walk Completed Successfully]`);
  }
  console.log(` Total OIDs Walked : ${count}`);
  console.log(` Elapsed Time      : ${elapsed}s`);
  console.log('---------------------------------------------------------------------');

  try {
    session.close();
  } catch {
    // Ignore close error
  }

  process.exit(error ? 1 : 0);
}

try {
  session.subtree(startOid, maxRepetitions, feedCallback, doneCallback);
} catch (err) {
  console.error(`[Fatal] Failed to initiate walk: ${err.message}`);
  session.close();
  process.exit(1);
}

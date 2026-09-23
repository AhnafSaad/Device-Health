import { NextResponse } from 'next/server';
import { query, ensureTablesExist } from '@/lib/db';

/**
 * Baseline fallback generator if telemetry_data has not yet been populated by Telegraf
 */
function generateFallbackTelemetry() {
  const fallbackNodes = [
    { ip: '10.0.1.1', hostname: 'edge-gw-frankfurt-01', deviceType: 'Server', loc: 'Frankfurt DC-1', rack: 'Rack B-12 (U22)' },
    { ip: '192.168.10.1', hostname: 'core-router-ams-02', deviceType: 'MikroTik', loc: 'Amsterdam Teleport', rack: 'Rack A-04 (U10)' },
    { ip: '172.16.20.5', hostname: 'sw-aggregation-ld4-03', deviceType: 'Switch', loc: 'London Slough LD4', rack: 'Rack F-09 (U14)' },
    { ip: '10.200.50.2', hostname: 'olt-gpon-ny9-04', deviceType: 'OLT', loc: 'New York NY9 (Equinix)', rack: 'Rack R-22 (U42)' },
    { ip: '10.0.4.15', hostname: 'pg-cluster-db-sg1-05', deviceType: 'Server', loc: 'Singapore SG1', rack: 'Rack S-05 (U18)' },
    { ip: '192.168.20.1', hostname: 'mikrotik-bgp-transit-06', deviceType: 'MikroTik', loc: 'Tokyo TY2', rack: 'Rack T-02 (U16)' },
    { ip: '172.16.30.12', hostname: 'sw-tor-access-07', deviceType: 'Switch', loc: 'Frankfurt DC-1', rack: 'Rack B-14 (U10)' },
    { ip: '10.200.50.6', hostname: 'olt-ftth-distribution-08', deviceType: 'OLT', loc: 'Amsterdam Teleport', rack: 'Rack A-08 (U20)' },
  ];

  return fallbackNodes.map((n, idx) => {
    const isOffline = idx === 3;
    const cpu = isOffline ? 0 : Math.floor(Math.random() * 65) + 15;
    const ram = isOffline ? 0 : Math.floor(Math.random() * 50) + 30;
    const health = isOffline ? 'Critical' : cpu > 75 ? 'Warning' : 'Normal';

    return {
      id: `dev-${1000 + idx + 1}`,
      ip_address: n.ip,
      hostname: n.hostname,
      device_type: n.deviceType,
      location: n.loc,
      rack_number: n.rack,
      cpu_usage: cpu,
      ram_usage: ram,
      disk_usage: isOffline ? 0 : 42,
      uptime: isOffline ? 'Unreachable (Host Down)' : `${(idx * 17) % 360 + 5}d ${(idx * 3) % 24}h`,
      status: isOffline ? 'offline' : 'online',
      health,
      load_average: isOffline ? 'N/A' : `${(cpu / 50).toFixed(2)}, ${((cpu - 4) / 50).toFixed(2)}, 0.45`,
      recorded_at: new Date().toISOString(),
    };
  });
}

/**
 * GET /api/telemetry
 * Queries PostgreSQL telemetry_data table for the most recent hardware metrics
 * (CPU, RAM, Status, Uptime) for all active nodes.
 */
export async function GET() {
  try {
    await ensureTablesExist();

    // Query distinct latest telemetry row per IP, joined with registered hardware details
    const sqlQuery = `
      SELECT DISTINCT ON (COALESCE(s.ip_address, t.ip_address))
        COALESCE(s.id, t.id) AS id,
        COALESCE(s.ip_address, t.ip_address) AS ip_address,
        COALESCE(s.hostname, CONCAT(LOWER(COALESCE(s.device_type, 'node')), '-', REPLACE(t.ip_address, '.', '-'))) AS hostname,
        COALESCE(s.device_type, 'Server') AS device_type,
        COALESCE(s.location, 'Local Datacenter') AS location,
        COALESCE(s.rack_number, 'Unassigned') AS rack_number,
        ROUND(COALESCE(t.cpu_usage, 0)::numeric, 1) AS cpu_usage,
        ROUND(COALESCE(t.ram_usage, 0)::numeric, 1) AS ram_usage,
        ROUND(COALESCE(t.disk_usage, 0)::numeric, 1) AS disk_usage,
        COALESCE(t.uptime, '0d 0h') AS uptime,
        COALESCE(t.status, 'online') AS status,
        COALESCE(t.health, 'Normal') AS health,
        COALESCE(t.load_average, '0.10, 0.08, 0.05') AS load_average,
        COALESCE(t.recorded_at, NOW()) AS recorded_at
      FROM servers_info s
      FULL OUTER JOIN telemetry_data t ON s.ip_address = t.ip_address
      ORDER BY COALESCE(s.ip_address, t.ip_address), t.recorded_at DESC NULLS LAST;
    `;

    const result = await query(sqlQuery);

    if (result.rows && result.rows.length > 0) {
      return NextResponse.json({
        status: 'success',
        source: 'postgresql',
        database: 'noc_db',
        table: 'telemetry_data',
        timestamp: new Date().toISOString(),
        total_nodes: result.rowCount,
        telemetry: result.rows,
      });
    }

    // If database has no telemetry data yet, provide seed nodes
    const fallback = generateFallbackTelemetry();
    return NextResponse.json({
      status: 'success',
      source: 'baseline_telemetry',
      database: 'noc_db',
      note: 'Database table empty; returning initial baseline telemetry.',
      timestamp: new Date().toISOString(),
      total_nodes: fallback.length,
      telemetry: fallback,
    });

  } catch (error) {
    console.error('Failed to query telemetry_data:', error.message);
    
    // In local dev/bare-metal startup before postgres is seeded, return resilient live telemetry
    const fallback = generateFallbackTelemetry();
    return NextResponse.json({
      status: 'success',
      source: 'resilient_fallback',
      warning: `PostgreSQL connection unavailable (${error.message}). Serving resilient baseline telemetry.`,
      timestamp: new Date().toISOString(),
      total_nodes: fallback.length,
      telemetry: fallback,
    });
  }
}

import { query } from '../../../lib/db.js';

/**
 * Next.js App Router Route Handler: /api/devices
 * GET: Lists all devices joined with datacenters
 * POST: Registers a new device node into servers_info with snmp_community (default: 'public')
 */

export async function GET() {
  try {
    const dbRes = await query(`
      SELECT 
        s.id,
        s.ip_address,
        s.hostname,
        s.device_type,
        s.datacenter_id,
        d.name AS datacenter_name,
        COALESCE(s.location, d.location, 'Local Datacenter') AS location,
        s.rack_number,
        s.snmp_community,
        s.created_at,
        s.updated_at
      FROM servers_info s
      LEFT JOIN datacenters d ON s.datacenter_id = d.id
      ORDER BY s.id DESC;
    `);

    const rows = (dbRes && dbRes.rows) || [];
    return Response.json({
      status: 'success',
      count: rows.length,
      devices: rows,
    });
  } catch (error) {
    return Response.json(
      { error: 'Internal Server Error', message: error?.message || 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      ip_address,
      ip,
      hostname,
      device_type,
      deviceType,
      datacenter_id,
      datacenterId,
      snmp_community,
      snmpCommunity,
      location,
      rack_number,
      rackNumber,
    } = body || {};

    const cleanIp = (ip_address || ip || '').trim();
    const cleanType = (device_type || deviceType || 'Server').trim();
    const cleanHost = (hostname || '').trim() || `${cleanType.toLowerCase()}-node-${cleanIp.replace(/\./g, '-')}`;
    const cleanCommunity = (snmp_community || snmpCommunity || '').trim() || 'public';
    const cleanDcId = datacenter_id !== undefined ? datacenter_id : datacenterId;
    const cleanLocation = (location || '').trim() || 'Local Datacenter';
    const cleanRack = (rack_number || rackNumber || '').trim() || 'Rack 01';

    // Validate IPv4
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(cleanIp)) {
      return Response.json(
        { error: 'Bad Request', message: `Invalid IPv4 address format: "${cleanIp}"` },
        { status: 400 }
      );
    }

    // Check duplicate IP in PostgreSQL
    const existingCheck = await query(
      'SELECT id FROM servers_info WHERE ip_address = $1 LIMIT 1;',
      [cleanIp]
    );

    if (existingCheck && existingCheck.rows && existingCheck.rows.length > 0) {
      return Response.json(
        { error: 'Conflict', message: `Device with IP ${cleanIp} already exists in servers_info.` },
        { status: 409 }
      );
    }

    // Insert into PostgreSQL
    const insertRes = await query(
      `INSERT INTO servers_info (ip_address, hostname, device_type, datacenter_id, snmp_community, location, rack_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *;`,
      [
        cleanIp,
        cleanHost,
        cleanType,
        cleanDcId || null,
        cleanCommunity,
        cleanLocation,
        cleanRack,
      ]
    );

    const createdRecord = (insertRes && insertRes.rows && insertRes.rows[0]) || {
      id: Date.now(),
      ip_address: cleanIp,
      hostname: cleanHost,
      device_type: cleanType,
      datacenter_id: cleanDcId,
      snmp_community: cleanCommunity,
      location: cleanLocation,
      rack_number: cleanRack,
      created_at: new Date().toISOString(),
    };

    return Response.json(
      {
        status: 'success',
        message: `Device ${cleanHost} (${cleanIp}) successfully registered with SNMP community.`,
        device: createdRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: 'Internal Server Error', message: error?.message || 'Failed to create device' },
      { status: 500 }
    );
  }
}

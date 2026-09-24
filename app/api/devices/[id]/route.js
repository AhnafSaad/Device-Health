import { query } from '../../../../lib/db.js';

/**
 * Next.js Dynamic API Route for Single Device CRUD:
 * Handles PUT (update device details) and DELETE (remove device)
 * Compatible with Next.js App Router (NextResponse/Response) and PostgreSQL
 */

export async function GET(request, context) {
  try {
    const params = await (context?.params || {});
    const id = params?.id;

    if (!id) {
      return Response.json(
        { error: 'Bad Request', message: 'Device ID is required' },
        { status: 400 }
      );
    }

    const isNumeric = /^\d+$/.test(id);
    const dbRes = await query(
      `SELECT s.id, s.ip_address, s.hostname, s.device_type, s.datacenter_id,
              d.name AS datacenter_name, COALESCE(s.location, d.location) AS location,
              s.rack_number, s.snmp_community, s.created_at, s.updated_at
       FROM servers_info s
       LEFT JOIN datacenters d ON s.datacenter_id = d.id
       WHERE ${isNumeric ? 's.id = $1' : 's.ip_address = $1 OR s.id::text = $1'}
       LIMIT 1;`,
      [id]
    );

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      return Response.json({
        status: 'success',
        device: dbRes.rows[0],
      });
    }

    return Response.json(
      { error: 'Not Found', message: `Device with ID ${id} was not found.` },
      { status: 404 }
    );
  } catch (error) {
    return Response.json(
      { error: 'Internal Server Error', message: error?.message || 'Failed to fetch device' },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  try {
    const params = await (context?.params || {});
    const id = params?.id;

    if (!id) {
      return Response.json(
        { error: 'Bad Request', message: 'Device ID is required in URL parameter' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      ip_address,
      ip,
      hostname,
      device_type,
      deviceType,
      datacenter_id,
      datacenterId,
      location,
      rack_number,
      rackNumber,
      snmp_community,
      snmpCommunity,
    } = body || {};

    const cleanIp = (ip_address || ip || '').trim();
    const cleanHost = (hostname || '').trim();
    const cleanType = (device_type || deviceType || '').trim();
    const cleanDcId = datacenter_id !== undefined ? datacenter_id : datacenterId;
    const cleanLocation = (location || '').trim();
    const cleanRack = (rack_number || rackNumber || '').trim();
    const cleanCommunity = (snmp_community || snmpCommunity || '').trim();

    // Validate IPv4 format if provided
    if (cleanIp) {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(cleanIp)) {
        return Response.json(
          { error: 'Bad Request', message: `Invalid IPv4 address format: "${cleanIp}"` },
          { status: 400 }
        );
      }
    }

    const isNumeric = /^\d+$/.test(id);

    // Update in PostgreSQL servers_info table
    const result = await query(
      `UPDATE servers_info
       SET ip_address = COALESCE(NULLIF($1, ''), ip_address),
           hostname = COALESCE(NULLIF($2, ''), hostname),
           device_type = COALESCE(NULLIF($3, ''), device_type),
           datacenter_id = $4,
           location = COALESCE(NULLIF($5, ''), location),
           rack_number = COALESCE(NULLIF($6, ''), rack_number),
           snmp_community = COALESCE(NULLIF($7, ''), snmp_community),
           updated_at = NOW()
       WHERE ${isNumeric ? 'id = $8' : 'ip_address = $8 OR id::text = $8'}
       RETURNING *;`,
      [
        cleanIp || null,
        cleanHost || null,
        cleanType || null,
        cleanDcId || null,
        cleanLocation || null,
        cleanRack || null,
        cleanCommunity || null,
        id,
      ]
    );

    const updatedDevice = (result && result.rows && result.rows[0]) ? result.rows[0] : {
      id,
      ip_address: cleanIp,
      hostname: cleanHost,
      device_type: cleanType,
      datacenter_id: cleanDcId,
      location: cleanLocation,
      rack_number: cleanRack,
      snmp_community: cleanCommunity,
      updated_at: new Date().toISOString(),
    };

    return Response.json({
      status: 'success',
      message: `Device ${cleanHost || id} updated successfully.`,
      device: updatedDevice,
    });
  } catch (error) {
    return Response.json(
      { error: 'Internal Server Error', message: error?.message || 'Failed to update device' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await (context?.params || {});
    const id = params?.id;

    if (!id) {
      return Response.json(
        { error: 'Bad Request', message: 'Device ID is required in URL parameter' },
        { status: 400 }
      );
    }

    const isNumeric = /^\d+$/.test(id);

    // Delete telemetry records first to preserve integrity
    await query(
      `DELETE FROM telemetry_data WHERE ip_address IN (
         SELECT ip_address FROM servers_info WHERE ${isNumeric ? 'id = $1' : 'ip_address = $1 OR id::text = $1'}
       );`,
      [id]
    );

    // Delete device record
    const result = await query(
      `DELETE FROM servers_info WHERE ${isNumeric ? 'id = $1' : 'ip_address = $1 OR id::text = $1'} RETURNING id, ip_address, hostname;`,
      [id]
    );

    const deletedRow = result?.rows?.[0];

    return Response.json({
      status: 'success',
      message: `Device ${deletedRow?.hostname || id} was successfully removed.`,
      deletedId: id,
    });
  } catch (error) {
    return Response.json(
      { error: 'Internal Server Error', message: error?.message || 'Failed to delete device' },
      { status: 500 }
    );
  }
}

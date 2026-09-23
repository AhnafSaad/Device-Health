import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Initialize connection pool (reuses pool across invocations)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { ip_address, device_type, snmp_community, location, rack_number } = body;

    // 1. Validation
    if (!ip_address || !ip_address.trim()) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'ip_address is required.' },
        { status: 400 }
      );
    }

    const validDeviceTypes = ['linux', 'mikrotik'];
    const chosenDeviceType = (device_type || 'linux').toLowerCase();
    if (!validDeviceTypes.includes(chosenDeviceType)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'device_type must be either "linux" or "mikrotik".' },
        { status: 400 }
      );
    }

    // 2. Insert into PostgreSQL servers_info table
    const queryText = `
      INSERT INTO servers_info (ip_address, device_type, snmp_community, location, rack_number, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, ip_address, device_type, snmp_community, location, rack_number, created_at;
    `;

    const values = [
      ip_address.trim(),
      chosenDeviceType,
      snmp_community ? snmp_community.trim() : 'public',
      location ? location.trim() : null,
      rack_number ? rack_number.trim() : null,
    ];

    const result = await pool.query(queryText, values);
    const newServer = result.rows[0];

    return NextResponse.json(
      {
        status: 'success',
        message: 'Server registered successfully into PostgreSQL servers_info.',
        server: newServer,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error inserting into servers_info:', error);

    // Check for PostgreSQL Unique Violation code '23505' (unique constraint on ip_address)
    if (error.code === '23505') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'A server with this IP address already exists in servers_info.',
          code: 409,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to insert server into database.',
      },
      { status: 500 }
    );
  }
}

-- NOC Fleet Monitor Data Center Schema Migration
-- 1. Create datacenters table
CREATE TABLE IF NOT EXISTS datacenters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(150) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE datacenters
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create servers_info table with snmp_community (default: 'public')
CREATE TABLE IF NOT EXISTS servers_info (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  hostname VARCHAR(150) NOT NULL,
  device_type VARCHAR(50) NOT NULL DEFAULT 'Server',
  brand VARCHAR(50),
  datacenter_id INTEGER REFERENCES datacenters(id) ON DELETE SET NULL,
  snmp_community VARCHAR(100) NOT NULL DEFAULT 'public',
  location VARCHAR(150) DEFAULT 'Local Datacenter',
  rack_number VARCHAR(50) DEFAULT 'Unassigned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ensure columns exist on legacy tables
ALTER TABLE servers_info 
ADD COLUMN IF NOT EXISTS datacenter_id INTEGER REFERENCES datacenters(id) ON DELETE SET NULL;

ALTER TABLE servers_info 
ADD COLUMN IF NOT EXISTS snmp_community VARCHAR(100) NOT NULL DEFAULT 'public';

ALTER TABLE servers_info 
ADD COLUMN IF NOT EXISTS brand VARCHAR(50);

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_servers_datacenter_id ON servers_info(datacenter_id);

-- 5. Create telemetry_data table for SNMP telemetry metrics
CREATE TABLE IF NOT EXISTS telemetry_data (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  cpu_usage NUMERIC(5, 2) DEFAULT 0,
  ram_usage NUMERIC(5, 2) DEFAULT 0,
  disk_usage NUMERIC(5, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'online',
  health VARCHAR(50) DEFAULT 'Normal',
  uptime VARCHAR(100) DEFAULT '0d 0h',
  load_average VARCHAR(100) DEFAULT '0.00, 0.00, 0.00',
  connected_users INTEGER,
  temperature NUMERIC,
  optical_tx NUMERIC,
  optical_rx NUMERIC,
  sys_name VARCHAR(255),
  power_supplies JSONB,
  fans JSONB,
  device_model VARCHAR(255),
  sys_descr TEXT,
  storage JSONB,
  disk_percentage_used INTEGER,
  disk_power_on_hours INTEGER,
  disk_lifetime_bytes_read NUMERIC,
  disk_lifetime_bytes_written NUMERIC,
  disk_estimated_eol_days INTEGER,
  ram_ecc_corrected INTEGER,
  ram_ecc_uncorrected INTEGER,
  ram_ecc_controllers JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS connected_users INTEGER;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS temperature NUMERIC;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS optical_tx NUMERIC;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS optical_rx NUMERIC;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS sys_name VARCHAR(255);
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS power_supplies JSONB;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS fans JSONB;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS device_model VARCHAR(255);
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS sys_descr TEXT;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS storage JSONB;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS disk_percentage_used INTEGER;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS disk_power_on_hours INTEGER;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS disk_lifetime_bytes_read NUMERIC;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS disk_lifetime_bytes_written NUMERIC;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS disk_estimated_eol_days INTEGER;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS ram_ecc_corrected INTEGER;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS ram_ecc_uncorrected INTEGER;
ALTER TABLE telemetry_data ADD COLUMN IF NOT EXISTS ram_ecc_controllers JSONB;

-- Indexes on ip_address and recorded_at (descending)
CREATE INDEX IF NOT EXISTS idx_telemetry_ip ON telemetry_data(ip_address);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at_desc ON telemetry_data(recorded_at DESC);

-- 7. Create users table for multi-user authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create settings table for runtime system configuration
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default snmp_poll_cron if not exists
INSERT INTO settings (key, value)
VALUES ('snmp_poll_cron', '*/1 * * * *')
ON CONFLICT (key) DO NOTHING;

-- 9. Create alert_thresholds table for configurable alert thresholds
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id SERIAL PRIMARY KEY,
  metric VARCHAR(32) NOT NULL,        -- 'cpu' | 'ram' | 'disk' | 'temperature' | 'connected_users'
  device_type VARCHAR(32) NOT NULL DEFAULT 'All',  -- 'All' | 'Server' | 'Router' | 'Switch' | 'OLT'
  warning_value NUMERIC NOT NULL,
  critical_value NUMERIC NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(metric, device_type)
);

INSERT INTO alert_thresholds (metric, device_type, warning_value, critical_value, enabled)
VALUES
  ('cpu', 'All', 75, 85, true),
  ('ram', 'All', 80, 90, true),
  ('disk', 'All', 70, 85, true),
  ('temperature', 'All', 60, 75, true),
  ('ram_ecc_corrected', 'All', 10, 50, true),
  ('ram_ecc_uncorrected', 'All', 1, 1, true)
ON CONFLICT (metric, device_type) DO NOTHING;



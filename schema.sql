-- NOC Fleet Monitor Data Center Schema Migration
-- 1. Create datacenters table
CREATE TABLE IF NOT EXISTS datacenters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(150) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create servers_info table with snmp_community (default: 'public')
CREATE TABLE IF NOT EXISTS servers_info (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  hostname VARCHAR(150) NOT NULL,
  device_type VARCHAR(50) NOT NULL DEFAULT 'Server',
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

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_servers_datacenter_id ON servers_info(datacenter_id);

-- 5. Initial seed datacenters
INSERT INTO datacenters (name, location) VALUES
  ('DC-US-East', 'US-East (N. Virginia)'),
  ('DC-US-West', 'US-West (Oregon)'),
  ('DC-EU-Central', 'EU-Central (Frankfurt)'),
  ('DC-EU-West', 'EU-West (London)'),
  ('DC-AP-East', 'AP-East (Tokyo)'),
  ('DC-AP-South', 'AP-Southeast (Singapore)'),
  ('DC-SA-East', 'SA-East (São Paulo)'),
  ('DC-AF-South', 'AF-South (Cape Town)')
ON CONFLICT (name) DO NOTHING;

-- NOC Fleet Monitor Data Center Schema Migration
-- 1. Create datacenters table
CREATE TABLE IF NOT EXISTS datacenters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(150) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add datacenter_id foreign key to servers_info table
ALTER TABLE servers_info 
ADD COLUMN IF NOT EXISTS datacenter_id INTEGER REFERENCES datacenters(id) ON DELETE SET NULL;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_servers_datacenter_id ON servers_info(datacenter_id);

-- 4. Initial seed datacenters
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

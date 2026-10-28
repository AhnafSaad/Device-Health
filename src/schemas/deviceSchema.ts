import { z } from 'zod';

export const ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Zod validation schema for Device Creation and Editing
 * Rack is completely OPTIONAL and nullable.
 */
export const DeviceFormSchema = z.object({
  ip_address: z
    .string()
    .trim()
    .min(1, 'IP address is required.')
    .regex(ipv4Regex, 'Invalid IPv4 address format (e.g. 192.168.1.100).'),
  device_type: z.enum(['Server', 'Router', 'Switch', 'OLT']),
  datacenter_id: z.string().optional().nullable(),
  datacenter_name: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  // Rack is completely OPTIONAL and nullable
  rack: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() ? val.trim() : null)),
  rack_number: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() ? val.trim() : null)),
  snmp_community: z.string().trim().default('public'),
});

export type DeviceFormValues = z.infer<typeof DeviceFormSchema>;

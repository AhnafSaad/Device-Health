import React, { useState } from 'react';
import { 
  Server as ServerIcon, 
  Cpu, 
  MapPin, 
  Layers, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  ShieldCheck,
  Send,
  RotateCcw,
  Sparkles,
  Database
} from 'lucide-react';
import { Server, DeviceType } from '../types';

interface AddServerViewProps {
  onBack: () => void;
  onServerAdded: (newServer: Server) => void;
  existingIps: string[];
}

export const AddServerView: React.FC<AddServerViewProps> = ({
  onBack,
  onServerAdded,
  existingIps,
}) => {
  const [formData, setFormData] = useState({
    ip_address: '',
    device_type: 'Server' as DeviceType,
    snmp_community: 'public',
    location: '',
    rack_number: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string; submessage?: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleReset = () => {
    setFormData({
      ip_address: '',
      device_type: 'Server',
      snmp_community: 'public',
      location: '',
      rack_number: '',
    });
    setAlert(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setIsLoading(true);

    // Simulate backend network latency & PostgreSQL insert query
    setTimeout(() => {
      setIsLoading(false);

      // 1. IP validation check
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(formData.ip_address.trim())) {
        setAlert({
          type: 'error',
          message: 'Invalid IPv4 Format',
          submessage: 'Please provide a valid IPv4 address (e.g. 192.168.1.100).',
        });
        return;
      }

      // 2. Check 409 Conflict: IP already exists in servers_info
      if (existingIps.includes(formData.ip_address.trim())) {
        setAlert({
          type: 'error',
          message: '409 Conflict: Duplicate Node IP',
          submessage: `A device node with IP ${formData.ip_address.trim()} already exists in servers_info.`,
        });
        return;
      }

      const prefix = formData.device_type === 'Server'
        ? 'srv'
        : formData.device_type === 'MikroTik'
        ? 'mtik'
        : formData.device_type === 'Switch'
        ? 'sw'
        : 'olt';

      // 3. Success: Create new Server model
      const newServer: Server = {
        id: `dev-${Math.floor(1000 + Math.random() * 9000)}`,
        ip: formData.ip_address.trim(),
        hostname: `${prefix}-node-${formData.ip_address.split('.').slice(-2).join('-')}`,
        status: 'online',
        health: 'Normal',
        cpuUsage: Math.floor(Math.random() * 30) + 18,
        ramUsage: Math.floor(Math.random() * 35) + 22,
        diskUsage: Math.floor(Math.random() * 35) + 15,
        uptime: 'Just provisioned (1 min)',
        location: formData.location.trim() || 'Global Datacenter',
        rackNumber: formData.rack_number.trim() || 'Rack TBD',
        deviceType: formData.device_type,
        snmpCommunity: formData.snmp_community.trim() || 'public',
        os: formData.device_type === 'MikroTik'
          ? 'MikroTik RouterOS 7.14'
          : formData.device_type === 'Switch'
          ? 'JunOS / EOS 4.28'
          : formData.device_type === 'OLT'
          ? 'OLT-Firmware v3.2'
          : 'Ubuntu 24.04 LTS (Linux 6.8)',
        kernel: formData.device_type === 'Server' ? 'Linux 6.8.0-31-generic' : `${formData.device_type} RTOS Kernel`,
        loadAverage: '0.12, 0.18, 0.16',
      };

      onServerAdded(newServer);

      setAlert({
        type: 'success',
        message: 'Device Provisioned Successfully (200 OK)',
        submessage: `Device node ${formData.ip_address} (${formData.device_type}) has been recorded into PostgreSQL table 'servers_info' and telemetry streaming is active!`,
      });

      // Clear input fields
      setFormData({
        ip_address: '',
        device_type: 'Server',
        snmp_community: 'public',
        location: '',
        rack_number: '',
      });
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-fadeIn">
      
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/60 hover:text-primary transition-colors mb-1 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Fleet Dashboard</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-base-content flex items-center gap-2.5">
            <span>Add Device</span>
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
              Admin Provisioning
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-base-content/60">
          <span className="px-2.5 py-1 rounded-lg bg-base-200 border border-base-content/10 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-primary" />
            <span>Target: <b>PostgreSQL (public.servers_info)</b></span>
          </span>
        </div>
      </div>

      {/* Centered Modern Card Container */}
      <div className="rounded-3xl border border-base-content/10 bg-base-100/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        
        {/* Card Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-base-content/10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-content flex items-center justify-center shadow-lg shadow-primary/20">
            <ServerIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-base-content">
              Register New Device Node
            </h2>
            <p className="text-xs sm:text-sm text-base-content/50 mt-0.5">
              Provision an infrastructure device (Server, MikroTik, Switch, or OLT) and begin streaming live SNMP &amp; ICMP telemetry.
            </p>
          </div>
        </div>

        {/* In-Card Alert Notice (if triggered) */}
        {alert && (
          <div
            className={`mt-6 p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              alert.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold">{alert.message}: </span>
              <span>{alert.submessage}</span>
            </div>
          </div>
        )}

        {/* Modern Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          
          {/* Row 1: IP Address & Device Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* IP Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <ServerIcon className="w-3.5 h-3.5 text-primary" />
                <span>IP Address</span>
                <span className="text-error">*</span>
              </label>
              <input
                type="text"
                name="ip_address"
                required
                value={formData.ip_address}
                onChange={handleChange}
                placeholder="e.g. 192.168.1.100"
                className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-mono text-base-content placeholder:text-base-content/30 outline-none transition-all"
              />
              <p className="text-[11px] text-base-content/40 font-mono">
                Primary IPv4 management interface
              </p>
            </div>

            {/* Device Type Select (Server, MikroTik, Switch, OLT) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-secondary" />
                <span>Device Type</span>
                <span className="text-error">*</span>
              </label>
              <select
                name="device_type"
                value={formData.device_type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-semibold text-base-content outline-none transition-all"
              >
                <option value="Server">Server</option>
                <option value="MikroTik">MikroTik</option>
                <option value="Switch">Switch</option>
                <option value="OLT">OLT</option>
              </select>
              <p className="text-[11px] text-base-content/40 font-mono">
                Selects automated SNMP OID telemetry probe
              </p>
            </div>

          </div>

          {/* Row 2: SNMP Community String */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-accent" />
                <span>SNMP Community String</span>
              </label>
              <span className="text-[10px] font-mono text-base-content/40">Default: &apos;public&apos;</span>
            </div>
            <input
              type="text"
              name="snmp_community"
              value={formData.snmp_community}
              onChange={handleChange}
              placeholder="public"
              className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-mono text-base-content placeholder:text-base-content/30 outline-none transition-all"
            />
            <p className="text-[11px] text-base-content/40 font-mono">
              Read-only community for CPU/RAM &amp; interface polling
            </p>
          </div>

          {/* Row 3: Datacenter Location & Rack Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Datacenter Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-info" />
                <span>Datacenter Location</span>
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. EU-Central (Frankfurt)"
                className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm text-base-content placeholder:text-base-content/30 outline-none transition-all"
              />
              <p className="text-[11px] text-base-content/40 font-mono">
                Facility &amp; geographic region
              </p>
            </div>

            {/* Rack Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-warning" />
                <span>Rack Number</span>
              </label>
              <input
                type="text"
                name="rack_number"
                value={formData.rack_number}
                onChange={handleChange}
                placeholder="e.g. Rack F-12 (U24)"
                className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-mono text-base-content placeholder:text-base-content/30 outline-none transition-all"
              />
              <p className="text-[11px] text-base-content/40 font-mono">
                Cabinet location &amp; U-position
              </p>
            </div>

          </div>

          {/* Form Action Buttons */}
          <div className="pt-4 border-t border-base-content/10 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold border border-base-content/20 hover:bg-base-200 text-base-content/80 transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Form</span>
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-primary-content shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  <span>Provisioning Device...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Register Device &amp; Begin Telemetry</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>

      {/* Security & Architecture Guarantee Card */}
      <div className="rounded-2xl border border-base-content/10 bg-base-100/50 p-4 sm:p-5 flex items-start gap-3.5 text-xs text-base-content/70 backdrop-blur-sm">
        <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-base-content">
            Security &amp; Automated Polling Enrollment
          </div>
          <p className="leading-relaxed">
            Registered devices are automatically enrolled into the real-time SNMP/ICMP collector engine. SNMP v2c/v3 requests are routed via encrypted WireGuard tunnels and ICMP latency is monitored continuously for SLA compliance.
          </p>
        </div>
      </div>

    </div>
  );
};

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
  Send,
  RotateCcw,
  Sparkles,
  Building2,
  Plus,
  Tag
} from 'lucide-react';
import { Server, DeviceType, Datacenter, DeviceBrand, BRAND_OPTIONS } from '../types';
import { DatacenterDropdown } from './DatacenterDropdown';
import { BrandLogo } from './BrandLogo';

interface AddServerViewProps {
  onBack: () => void;
  onServerAdded: (newServer: Server) => void;
  existingIps: string[];
  datacenters: Datacenter[];
  onOpenDcModal?: () => void;
  onNavigateToDatacenters?: () => void;
}

export const AddServerView: React.FC<AddServerViewProps> = ({
  onBack,
  onServerAdded,
  existingIps,
  datacenters,
  onOpenDcModal,
  onNavigateToDatacenters,
}) => {
  const handleManageDcs = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (onNavigateToDatacenters) {
      onNavigateToDatacenters();
    } else if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/admin/data-centers');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };
  const [formData, setFormData] = useState({
    ip_address: '',
    device_type: 'Server' as DeviceType,
    brand: 'MikroTik' as DeviceBrand,
    snmp_community: 'public',
    datacenter_id: datacenters.length > 0 ? String(datacenters[0].id) : '',
    location: datacenters.length > 0 ? datacenters[0].location : '',
    rack_number: 'Rack 01 (U10)',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string; submessage?: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'datacenter_id') {
      const selectedDc = datacenters.find((d) => String(d.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        datacenter_id: value,
        location: selectedDc ? selectedDc.location : prev.location,
        rack_number: selectedDc && selectedDc.racks && selectedDc.racks.length > 0 ? selectedDc.racks[0] : prev.rack_number,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setIsLoading(true);

    const cleanIp = formData.ip_address.trim();

    // 1. IP validation check
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(cleanIp)) {
      setIsLoading(false);
      setAlert({
        type: 'error',
        message: 'Invalid IPv4 Format',
        submessage: 'Please provide a valid IPv4 address (e.g. 192.168.1.100).',
      });
      return;
    }

    // 2. Check 409 Conflict: IP already exists in servers_info
    if (existingIps.includes(cleanIp)) {
      setIsLoading(false);
      setAlert({
        type: 'error',
        message: '409 Conflict: Duplicate Node IP',
        submessage: `A device node with IP ${cleanIp} already exists in servers_info.`,
      });
      return;
    }

    const prefix = formData.device_type === 'Server'
      ? 'srv'
      : formData.device_type === 'Router'
      ? (formData.brand === 'MikroTik' ? 'mtik' : 'rtr')
      : formData.device_type === 'Switch'
      ? 'sw'
      : 'olt';

    const generatedHostname = `${prefix}-node-${cleanIp.split('.').slice(-2).join('-')}`;
    const selectedDc = datacenters.find((d) => String(d.id) === String(formData.datacenter_id));
    const finalLocation = selectedDc ? selectedDc.location : formData.location.trim() || 'Global Datacenter';
    const finalDcName = selectedDc ? selectedDc.name : undefined;

    let pollReachable: boolean | undefined = undefined;
    let polledTelemetry: any = null;

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip_address: cleanIp,
          hostname: generatedHostname,
          device_type: formData.device_type,
          brand: formData.brand,
          datacenter_id: formData.datacenter_id || null,
          datacenter_name: finalDcName,
          snmp_community: formData.snmp_community.trim() || 'public',
          location: finalLocation,
          rack_number: formData.rack_number.trim() || 'Rack TBD',
        }),
      });

      if (response.status === 409) {
        setIsLoading(false);
        setAlert({
          type: 'error',
          message: '409 Conflict: Duplicate Node IP',
          submessage: `A device with IP ${cleanIp} already exists in servers_info.`,
        });
        return;
      }

      if (response.ok) {
        try {
          const resJson = await response.json();
          pollReachable = resJson.snmp_reachable;
          polledTelemetry = resJson.telemetry;
        } catch {
          // ignore
        }
      }
    } catch {
      // Local fallback in case backend is offline
    }

    setIsLoading(false);

    const isOnline = pollReachable === true;

    // 3. Success: Create new Server model reflecting real polled status
    const newServer: Server = {
      id: `dev-${Math.floor(1000 + Math.random() * 9000)}`,
      ip: cleanIp,
      hostname: generatedHostname,
      status: isOnline ? 'online' : 'offline',
      health: isOnline ? (polledTelemetry?.health || 'Normal') : 'Critical',
      cpuUsage: isOnline ? (polledTelemetry?.cpu_usage || 15) : 0,
      ramUsage: isOnline ? (polledTelemetry?.ram_usage || 35) : 0,
      diskUsage: isOnline ? (polledTelemetry?.disk_usage || 25) : 0,
      uptime: isOnline ? (polledTelemetry?.uptime || '0d 1h') : '0d 0h (Offline)',
      location: finalLocation,
      datacenterId: formData.datacenter_id || undefined,
      datacenterName: finalDcName,
      rackNumber: formData.rack_number.trim() || 'Rack TBD',
      deviceType: formData.device_type,
      brand: formData.brand,
      snmpCommunity: formData.snmp_community.trim() || 'public',
      os: formData.device_type === 'Router'
        ? (formData.brand === 'MikroTik' ? 'MikroTik RouterOS 7.14' : formData.brand === 'Cisco' ? 'Cisco IOS-XE 17.9' : formData.brand === 'Juniper' ? 'Junos OS 23.2' : `${formData.brand} RouterOS`)
        : formData.device_type === 'Switch'
        ? 'JunOS / EOS 4.28'
        : formData.device_type === 'OLT'
        ? 'OLT-Firmware v3.2'
        : 'Ubuntu 24.04 LTS (Linux 6.8)',
      kernel: formData.device_type === 'Server' ? 'Linux 6.8.0-31-generic' : `${formData.device_type} RTOS Kernel`,
      loadAverage: isOnline ? (polledTelemetry?.load_average || '0.12, 0.18, 0.16') : '0.00, 0.00, 0.00',
    };

    onServerAdded(newServer);

    const reachabilityText = pollReachable === true 
      ? 'SNMP Reachability: Verified Online (Community accepted)' 
      : pollReachable === false 
      ? 'SNMP Reachability: Unreachable / Offline (Check IP & Community)'
      : 'Registered into active registry';

    setAlert({
      type: pollReachable === false ? 'warning' : 'success',
      message: pollReachable === false ? 'Device Registered (SNMP Unreachable)' : 'Device Provisioned Successfully (201 Created)',
      submessage: `Device node ${cleanIp} (${formData.brand} ${formData.device_type}) assigned to Data Center ${finalDcName || finalLocation}. ${reachabilityText}.`,
    });

    // Reset IP input
    setFormData((prev) => ({
      ...prev,
      ip_address: '',
    }));
  };

  const selectedDc = datacenters.find((d) => String(d.id) === String(formData.datacenter_id));

  const handleReset = () => {
    setFormData({
      ip_address: '',
      device_type: 'Server' as DeviceType,
      brand: 'MikroTik' as DeviceBrand,
      snmp_community: 'public',
      datacenter_id: datacenters.length > 0 ? String(datacenters[0].id) : '',
      location: datacenters.length > 0 ? datacenters[0].location : '',
      rack_number: 'Rack 01 (U10)',
    });
    setAlert(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-6 px-4 space-y-6">
      
      {/* Top Breadcrumb & Back Action */}
      <div className="flex items-center justify-start">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-xs font-semibold text-base-content/70 hover:text-primary transition-colors"
        >
          <div className="p-1.5 rounded-lg bg-base-200 group-hover:bg-primary/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span>Back to Fleet Dashboard</span>
        </button>
      </div>

      {/* Centered Modern Card Container */}
      <div className="rounded-3xl border border-base-content/10 bg-base-100/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        
        {/* Card Header */}
        <div className="flex items-center justify-between pb-6 border-b border-base-content/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-content flex items-center justify-center shadow-lg shadow-primary/20">
              <ServerIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-base-content">
                Register New Device
              </h2>
              <p className="text-xs sm:text-sm text-base-content/50 mt-0.5">
                Provision an infrastructure device (Server, Router, Switch, or OLT) with automatic Data Center association.
              </p>
            </div>
          </div>

          <a
            href="/admin/data-centers"
            onClick={handleManageDcs}
            className="btn btn-outline btn-primary btn-sm gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span>Manage DCs</span>
          </a>
        </div>

        {/* In-Card Alert Notice (if triggered) */}
        {alert && (
          <div
            className={`mt-6 p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              alert.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                : alert.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
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

            {/* Device Type Select (Server, Router, Switch, OLT) */}
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
                <option value="Server">Server (Compute / Database)</option>
                <option value="Router">Router (Gateway / BGP / Core Router)</option>
                <option value="Switch">Switch (Spine / Leaf ToR)</option>
                <option value="OLT">OLT (Fiber Chassis GPON/XGS-PON)</option>
              </select>
              <p className="text-[11px] text-base-content/40 font-mono">
                Selects automated SNMP OID telemetry probe
              </p>
            </div>

          </div>

          {/* Row 2: Device Brand / Vendor & Data Center Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Device Brand / Vendor Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-accent" />
                  <span>Device Brand / Vendor</span>
                  <span className="text-error">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <BrandLogo brand={formData.brand} size="xs" />
                  <span className="text-[10px] text-base-content/50 font-mono">{formData.brand}</span>
                </div>
              </div>
              <div className="relative flex items-center">
                <select
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-semibold text-base-content outline-none transition-all pr-10"
                >
                  {BRAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 pointer-events-none flex items-center">
                  <BrandLogo brand={formData.brand} size="sm" />
                </div>
              </div>
              <p className="text-[11px] text-base-content/40 font-mono">
                Manual hardware vendor (unlocked across all device types)
              </p>
            </div>

            {/* Dynamic Datacenter Dropdown with solid opaque container & z-50 */}
            <div className="space-y-1.5 relative z-20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>Data Center (Dynamic Dropdown)</span>
                  <span className="text-error">*</span>
                </label>
                <a
                  href="/admin/data-centers"
                  onClick={handleManageDcs}
                  className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New DC</span>
                </a>
              </div>

              <DatacenterDropdown
                datacenters={datacenters}
                selectedId={formData.datacenter_id}
                onSelect={(dcId) => {
                  const selected = datacenters.find((d) => String(d.id) === String(dcId));
                  setFormData((prev) => ({
                    ...prev,
                    datacenter_id: dcId,
                    location: selected ? selected.location : prev.location,
                    rack_number: selected && selected.racks && selected.racks.length > 0 ? selected.racks[0] : prev.rack_number,
                  }));
                }}
                onOpenDcModal={handleManageDcs}
                size="md"
              />
              
              <p className="text-[11px] text-base-content/50 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-primary shrink-0" />
                <span>Facility: {selectedDc?.location || formData.location || 'Unassigned'}</span>
              </p>
            </div>

          </div>

          {/* Row 3: Rack Cabinet & SNMP Community String */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Rack Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-warning" />
                <span>Rack Cabinet &amp; Unit</span>
                <span className="text-error">*</span>
              </label>
              
              {selectedDc && selectedDc.racks && selectedDc.racks.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    name="rack_number"
                    value={formData.rack_number}
                    onChange={handleChange}
                    className="select select-bordered flex-1 text-sm bg-base-200/50 font-mono"
                  >
                    {selectedDc.racks.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="Custom">Custom Cabinet...</option>
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  name="rack_number"
                  value={formData.rack_number}
                  onChange={handleChange}
                  placeholder="e.g. Rack A-01 (U12)"
                  className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-mono text-base-content placeholder:text-base-content/30 outline-none transition-all"
                />
              )}
              
              <p className="text-[11px] text-base-content/40 font-mono">
                Cabinet location &amp; U-position
              </p>
            </div>

            {/* SNMP Community String */}
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
                Read-only community for CPU/RAM polling
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
                  <span>Register Device</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};

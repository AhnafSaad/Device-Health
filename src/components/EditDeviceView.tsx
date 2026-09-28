import React, { useState, useEffect } from 'react';
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
  Save,
  RotateCcw,
  Sparkles,
  Database,
  Building2,
  HardDrive,
  Radio,
  Pencil,
  ChevronRight,
  Activity,
  Tag
} from 'lucide-react';
import { Server, DeviceType, Datacenter } from '../types';
import { DatacenterDropdown } from './DatacenterDropdown';
import { fetchWithAuth, clearAuth } from '../utils/auth';
import { formatRack } from '../utils/rack';

interface EditDeviceViewProps {
  deviceId: string;
  device?: Server | null;
  datacenters: Datacenter[];
  existingIps: string[];
  onBack: () => void;
  onDeviceUpdated: (updatedServer: Server) => void;
  onOpenDcModal?: () => void;
  router?: { push: (url: string) => void; back?: () => void };
}

export const EditDeviceView: React.FC<EditDeviceViewProps> = ({
  deviceId,
  device: initialDevice,
  datacenters,
  existingIps,
  onBack,
  onDeviceUpdated,
  onOpenDcModal,
  router,
}) => {
  const [device, setDevice] = useState<Server | null>(initialDevice || null);
  const [isFetching, setIsFetching] = useState(!initialDevice);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    ip_address: '',
    hostname: '',
    device_type: 'Server' as DeviceType,
    snmp_community: 'public',
    datacenter_id: '',
    location: '',
    rack_number: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string; submessage?: string } | null>(null);

  // Navigate back helper
  const handleNavigateBack = () => {
    if (router?.push) {
      router.push('/');
    } else {
      onBack();
    }
  };

  // Fetch device if not passed or when deviceId changes
  useEffect(() => {
    let isMounted = true;

    async function loadDeviceData() {
      if (initialDevice && initialDevice.id === deviceId) {
        setDevice(initialDevice);
        setFormData({
          ip_address: initialDevice.ip,
          hostname: initialDevice.hostname,
          device_type: (initialDevice.deviceType as DeviceType) || 'Server',
          snmp_community: initialDevice.snmpCommunity || 'public',
          datacenter_id: initialDevice.datacenterId ? String(initialDevice.datacenterId) : '',
          location: initialDevice.location,
          rack_number: formatRack(initialDevice.rackNumber),
        });
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      setFetchError(null);

      try {
        const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, { credentials: 'include' });
        if (!res.ok) {
          // If specific endpoint failed, fallback to listing devices
          const listRes = await fetch('/api/devices', { credentials: 'include' });
          if (listRes.ok) {
            const listData = await listRes.json();
            const found = (listData.devices || []).find(
              (d: any) => String(d.id) === String(deviceId) || d.ip_address === deviceId
            );
            if (found && isMounted) {
              const mapped: Server = {
                id: found.id,
                ip: found.ip_address,
                hostname: found.hostname,
                deviceType: found.device_type,
                brand: found.brand,
                datacenterId: found.datacenter_id,
                datacenterName: found.datacenter_name,
                location: found.location,
                rackNumber: found.rack_number,
                snmpCommunity: found.snmp_community,
                cpuUsage: found.cpu_usage ?? 25,
                ramUsage: found.ram_usage ?? 40,
                diskUsage: found.disk_usage ?? 50,
                status: found.status ?? 'online',
                health: found.health ?? 'Normal',
                uptime: found.uptime ?? '14d 6h',
              };
              setDevice(mapped);
              setFormData({
                ip_address: mapped.ip,
                hostname: mapped.hostname,
                device_type: (mapped.deviceType as DeviceType) || 'Server',
                snmp_community: mapped.snmpCommunity || 'public',
                datacenter_id: mapped.datacenterId ? String(mapped.datacenterId) : '',
                location: mapped.location,
                rack_number: formatRack(mapped.rackNumber),
              });
              setIsFetching(false);
              return;
            }
          }
          throw new Error('Device not found');
        }

        const data = await res.json();
        const d = data.device;
        if (d && isMounted) {
          const mapped: Server = {
            id: d.id,
            ip: d.ip_address,
            hostname: d.hostname,
            deviceType: d.device_type,
            brand: d.brand,
            datacenterId: d.datacenter_id,
            datacenterName: d.datacenter_name,
            location: d.location,
            rackNumber: d.rack_number,
            snmpCommunity: d.snmp_community,
            cpuUsage: d.cpu_usage ?? 25,
            ramUsage: d.ram_usage ?? 40,
            diskUsage: d.disk_usage ?? 50,
            status: d.status ?? 'online',
            health: d.health ?? 'Normal',
            uptime: d.uptime ?? '14d 6h',
          };
          setDevice(mapped);
          setFormData({
            ip_address: mapped.ip,
            hostname: mapped.hostname,
            device_type: (mapped.deviceType as DeviceType) || 'Server',
            snmp_community: mapped.snmpCommunity || 'public',
            datacenter_id: mapped.datacenterId ? String(mapped.datacenterId) : '',
            location: mapped.location,
            rack_number: formatRack(mapped.rackNumber),
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setFetchError(err.message || 'Failed to load device information');
        }
      } finally {
        if (isMounted) setIsFetching(false);
      }
    }

    loadDeviceData();

    return () => {
      isMounted = false;
    };
  }, [deviceId, initialDevice]);

  // Form input change handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'datacenter_id') {
      const selectedDc = datacenters.find((d) => String(d.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        datacenter_id: value,
        location: selectedDc ? selectedDc.location : prev.location,
        rack_number: selectedDc && selectedDc.racks && selectedDc.racks.length > 0 ? formatRack(selectedDc.racks[0]) : prev.rack_number,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleDeviceTypeSelect = (type: DeviceType) => {
    setFormData((prev) => ({ ...prev, device_type: type }));
  };

  const handleReset = () => {
    if (device) {
      setFormData({
        ip_address: device.ip,
        hostname: device.hostname,
        device_type: (device.deviceType as DeviceType) || 'Server',
        snmp_community: device.snmpCommunity || 'public',
        datacenter_id: device.datacenterId ? String(device.datacenterId) : '',
        location: device.location,
        rack_number: formatRack(device.rackNumber),
      });
      setAlert(null);
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
        message: 'Invalid IPv4 Address Format',
        submessage: 'Please provide a valid IPv4 address (e.g., 10.0.1.15, 192.168.1.1).',
      });
      return;
    }

    // 2. Conflict check (if IP changed to another node's IP)
    const originalIp = device?.ip;
    if (cleanIp !== originalIp) {
      const isConflicting = existingIps.some((existing) => existing === cleanIp && existing !== originalIp);
      if (isConflicting) {
        setIsLoading(false);
        setAlert({
          type: 'error',
          message: 'IP Conflict Detected (HTTP 409)',
          submessage: `The IP address "${cleanIp}" is already assigned to another active device in this cluster.`,
        });
        return;
      }
    }

    // Resolve Datacenter Name
    const matchedDc = datacenters.find((d) => String(d.id) === String(formData.datacenter_id));
    const resolvedDcName = matchedDc ? matchedDc.name : (device?.datacenterName || 'Local Datacenter');

    try {
      const existingHost = device?.hostname || formData.hostname;
      const cleanRack = formatRack(formData.rack_number) || 'Rack 01';
      const payload = {
        id: deviceId,
        ip_address: cleanIp,
        hostname: existingHost,
        device_type: formData.device_type,
        datacenter_id: formData.datacenter_id || undefined,
        datacenter_name: resolvedDcName,
        location: formData.location.trim() || (matchedDc ? matchedDc.location : 'Primary Datacenter'),
        rack_number: cleanRack,
        snmp_community: formData.snmp_community.trim() || 'public',
      };

      const res = await fetchWithAuth(`/api/devices/${encodeURIComponent(deviceId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        clearAuth();
        setIsLoading(false);
        setAlert({
          type: 'error',
          message: 'Admin authentication required — please log in again',
          submessage: 'Your administrator session has expired or is missing.',
        });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server responded with status code ${res.status}`);
      }

      const result = await res.json();
      const updatedServerData = result.device || {
        ...device,
        ...payload,
        ip: cleanIp,
        deviceType: formData.device_type,
        snmpCommunity: formData.snmp_community,
        rackNumber: formData.rack_number,
        datacenterName: resolvedDcName,
      };

      const normalizedServer: Server = {
        id: updatedServerData.id || deviceId,
        ip: updatedServerData.ip_address || cleanIp,
        hostname: existingHost,
        deviceType: (updatedServerData.device_type || formData.device_type) as DeviceType,
        brand: device?.brand || updatedServerData.brand,
        datacenterId: updatedServerData.datacenter_id || formData.datacenter_id,
        datacenterName: updatedServerData.datacenter_name || resolvedDcName,
        location: updatedServerData.location || payload.location,
        rackNumber: formatRack(updatedServerData.rack_number) || cleanRack,
        snmpCommunity: updatedServerData.snmp_community || payload.snmp_community,
        cpuUsage: updatedServerData.cpu_usage ?? device?.cpuUsage ?? 30,
        ramUsage: updatedServerData.ram_usage ?? device?.ramUsage ?? 45,
        diskUsage: updatedServerData.disk_usage ?? device?.diskUsage ?? 50,
        status: updatedServerData.status ?? device?.status ?? 'online',
        health: updatedServerData.health ?? device?.health ?? 'Normal',
        uptime: updatedServerData.uptime ?? device?.uptime ?? '14d 6h',
      };

      setDevice(normalizedServer);
      onDeviceUpdated(normalizedServer);

      setAlert({
        type: 'success',
        message: 'Device Configuration Successfully Updated',
        submessage: `Changes for "${normalizedServer.hostname}" (${normalizedServer.ip}) have been saved.`,
      });

      // Automatically return after a short pause so user sees confirmation
      setTimeout(() => {
        handleNavigateBack();
      }, 1200);

    } catch (err: any) {
      setAlert({
        type: 'error',
        message: 'Failed to Update Device',
        submessage: err.message || 'An unexpected error occurred while saving the configuration.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deviceTypes: { type: DeviceType; label: string; desc: string; icon: any }[] = [
    { type: 'Server', label: 'Compute Server', desc: 'Bare-metal, VM, or Hypervisor device', icon: ServerIcon },
    { type: 'Router', label: 'Router / Gateway', desc: 'Edge, BGP border, or core router', icon: Radio },
    { type: 'Switch', label: 'Managed Switch', desc: 'Spine, leaf, or Top-of-Rack Layer 2/3', icon: Layers },
    { type: 'OLT', label: 'Fiber GPON OLT', desc: 'Optical Line Terminal chassis / PON', icon: HardDrive },
  ];

  if (isFetching) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="p-4 rounded-2xl bg-base-200 border border-base-content/10 shadow-xl space-y-4 max-w-sm w-full">
          <div className="loading loading-spinner loading-lg text-primary mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-base-content">Retrieving Device Details</h3>
            <p className="text-xs text-base-content/60 font-mono">UID: {deviceId}</p>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError && !device) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="p-6 rounded-2xl bg-base-100 border border-error/30 shadow-2xl space-y-4 max-w-md w-full">
          <div className="w-12 h-12 rounded-2xl bg-error/15 text-error flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-base-content">Device Not Found</h3>
            <p className="text-xs text-base-content/70">
              {fetchError || `Unable to locate a device with identifier "${deviceId}".`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleNavigateBack}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-content hover:opacity-90 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Fleet Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-content/10 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-base-content/60">
            <button 
              type="button"
              onClick={handleNavigateBack}
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <span>Dashboard</span>
            </button>
            <ChevronRight className="w-3 h-3 text-base-content/30" />
            <span>Fleet Inventory</span>
            <ChevronRight className="w-3 h-3 text-base-content/30" />
            <span className="text-primary font-bold">Edit Device</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-base-content tracking-tight">
                Edit Device Configuration
              </h1>
              <p className="text-xs text-base-content/60 font-mono mt-0.5">
                Target Device: <span className="font-bold text-base-content">{device?.hostname}</span> ({device?.ip}) • UID: {deviceId}
              </p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <button
          type="button"
          onClick={handleNavigateBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-base-100 hover:bg-base-200 border border-base-content/15 text-base-content transition-all shadow-xs shrink-0 self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div 
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          )}
          <div className="space-y-0.5 flex-1">
            <h4 className="font-bold text-sm tracking-tight">{alert.message}</h4>
            {alert.submessage && <p className="opacity-90">{alert.submessage}</p>}
          </div>
        </div>
      )}

      {/* Main Grid: Form on Left (2 cols), Live Preview on Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Card 1: Network & Identity */}
            <div className="bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
                <div className="flex items-center gap-2">
                  <ServerIcon className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-base-content tracking-tight">
                    Network &amp; Device Identity
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-base-200 text-base-content/60">
                  Step 1 of 3
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-base-content flex items-center justify-between">
                  <span>IPv4 Management Address *</span>
                  <span className="text-[10px] font-normal text-base-content/50">Required</span>
                </label>
                <input
                  type="text"
                  name="ip_address"
                  required
                  placeholder="e.g. 10.0.1.15"
                  value={formData.ip_address}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 font-mono text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <p className="text-[10px] text-base-content/50">
                  Static IP used for ICMP echo and telemetry polling.
                </p>
              </div>

              {/* Device Type Selection Cards */}
              <div className="space-y-2 pt-2 border-t border-base-content/10">
                <label className="text-xs font-bold text-base-content block">
                  Device Hardware Profile *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {deviceTypes.map((dt) => {
                    const Icon = dt.icon;
                    const isSelected = formData.device_type === dt.type;
                    return (
                      <button
                        key={dt.type}
                        type="button"
                        onClick={() => handleDeviceTypeSelect(dt.type)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30'
                            : 'bg-base-200/40 border-base-content/10 text-base-content hover:bg-base-200/80 hover:border-base-content/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-base-content/60'}`} />
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block">{dt.label}</span>
                          <span className="text-[9px] text-base-content/50 leading-tight block mt-0.5 truncate">
                            {dt.type}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 2: Physical Placement & Datacenter */}
            <div className="bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-base-content tracking-tight">
                    Datacenter &amp; Physical Rack Placement
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-base-200 text-base-content/60">
                  Step 2 of 3
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Datacenter Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-base-content flex items-center justify-between">
                    <span>Datacenter Facility</span>
                    {onOpenDcModal && (
                      <button
                        type="button"
                        onClick={onOpenDcModal}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Manage DCs
                      </button>
                    )}
                  </label>
                  <DatacenterDropdown
                    datacenters={datacenters}
                    selectedId={formData.datacenter_id}
                    onSelect={(dcId) => {
                      const selectedDc = datacenters.find((d) => String(d.id) === String(dcId));
                      setFormData((prev) => ({
                        ...prev,
                        datacenter_id: dcId,
                        location: selectedDc ? selectedDc.location : prev.location,
                        rack_number: selectedDc && selectedDc.racks && selectedDc.racks.length > 0 ? formatRack(selectedDc.racks[0]) : prev.rack_number,
                      }));
                    }}
                    onOpenDcModal={onOpenDcModal}
                    placeholder="Choose Facility"
                  />
                </div>

                {/* Location string */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-base-content">
                    Location &amp; Region
                  </label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g. US-East (N. Virginia)"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                {/* Rack Number */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-base-content">
                    Rack
                  </label>
                  <input
                    type="text"
                    name="rack_number"
                    placeholder="e.g. Rack A-01"
                    value={formData.rack_number}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 font-mono text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: SNMP Configuration */}
            <div className="bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-base-content tracking-tight">
                    Telemetry &amp; SNMP Polling
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-base-200 text-base-content/60">
                  Step 3 of 3
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-base-content">
                  SNMP v2c Community String
                </label>
                <input
                  type="text"
                  name="snmp_community"
                  placeholder="e.g. public or monitoring-ro"
                  value={formData.snmp_community}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 font-mono text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <p className="text-[10px] text-base-content/50">
                  Read-only credential used by HealthStream worker agents to poll hardware telemetry.
                </p>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-base-content/20 text-base-content hover:bg-base-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Initial</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleNavigateBack}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-base-content/20 text-base-content hover:bg-base-200 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-content hover:opacity-90 shadow-md shadow-primary/25 transition-all flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Device Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Right: Live Preview & Status Card */}
        <div className="space-y-4">
          <div className="bg-base-100 border border-base-content/10 rounded-2xl p-5 shadow-sm space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Live Device Preview
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                {device?.status || 'ONLINE'}
              </span>
            </div>

            {/* Preview Card */}
            <div className="p-4 rounded-xl bg-base-200/60 border border-base-content/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-base-content">
                  {formData.ip_address || '0.0.0.0'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-primary/10 text-primary border border-primary/20">
                  {formData.device_type}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-base-content block truncate font-mono">
                  {device?.hostname || formData.hostname || 'unnamed-device'}
                </span>
                <span className="text-[11px] text-base-content/60 block truncate">
                  {formData.location || 'Unassigned Location'}
                </span>
              </div>

              <div className="pt-2 border-t border-base-content/10 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[9px] uppercase font-bold text-base-content/40 block">Rack Position</span>
                  <span className="font-mono text-base-content/80 truncate block">{formatRack(formData.rack_number) || 'Rack 01'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-base-content/40 block">SNMP Community</span>
                  <span className="font-mono text-base-content/80 truncate block">{formData.snmp_community || 'public'}</span>
                </div>
              </div>
            </div>

            {/* Telemetry Summary */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase font-bold text-base-content/50 block">Current Telemetry</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-base-200/50 border border-base-content/10">
                  <span className="text-[9px] text-base-content/50 block">CPU</span>
                  <span className="text-xs font-mono font-bold text-base-content">{device?.cpuUsage ?? 25}%</span>
                </div>
                <div className="p-2 rounded-lg bg-base-200/50 border border-base-content/10">
                  <span className="text-[9px] text-base-content/50 block">RAM</span>
                  <span className="text-xs font-mono font-bold text-base-content">{device?.ramUsage ?? 40}%</span>
                </div>
                <div className="p-2 rounded-lg bg-base-200/50 border border-base-content/10">
                  <span className="text-[9px] text-base-content/50 block">DISK</span>
                  <span className="text-xs font-mono font-bold text-base-content">{device?.diskUsage ?? 50}%</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-info/10 border border-info/20 text-xs text-info-content dark:text-info space-y-1">
              <span className="font-bold block">Cluster Synch Active</span>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Saving updates will propagate configuration to both PostgreSQL registry (<code className="font-mono text-[10px]">servers_info</code>) and the active telemetry polling agent.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

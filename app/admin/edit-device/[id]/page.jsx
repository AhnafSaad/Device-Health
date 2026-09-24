'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  Server as ServerIcon, 
  Cpu, 
  MapPin, 
  Layers, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  Save,
  RotateCcw,
  Building2,
  HardDrive,
  Radio,
  Pencil,
  ChevronRight,
  Activity
} from 'lucide-react';

export default function EditDevicePage(props) {
  // Support both Next.js 15 (params as Promise) and Next.js 13/14 (params as object)
  let resolvedParams = null;
  if (props?.params) {
    if (typeof props.params.then === 'function') {
      try {
        resolvedParams = use(props.params);
      } catch (e) {
        // Fallback if use() not available
        resolvedParams = props.params;
      }
    } else {
      resolvedParams = props.params;
    }
  }

  // Fallback to reading from window.location in client environment if params not passed
  const [deviceId, setDeviceId] = useState(resolvedParams?.id || '');

  useEffect(() => {
    if (!deviceId && typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/admin\/edit-device\/([^/]+)/);
      if (match && match[1]) {
        setDeviceId(decodeURIComponent(match[1]));
      }
    }
  }, [deviceId]);

  // Client router navigation helper
  const navigateTo = (path) => {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  const [device, setDevice] = useState(null);
  const [datacenters, setDatacenters] = useState([]);
  const [existingIps, setExistingIps] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    ip_address: '',
    hostname: '',
    device_type: 'Server',
    snmp_community: 'public',
    datacenter_id: '',
    location: '',
    rack_number: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Load device and datacenters
  useEffect(() => {
    if (!deviceId) return;
    let isMounted = true;

    async function loadData() {
      setIsFetching(true);
      setFetchError(null);

      try {
        // 1. Fetch datacenters
        const dcRes = await fetch('/api/datacenters').catch(() => null);
        let dcList = [];
        if (dcRes && dcRes.ok) {
          const dcData = await dcRes.json();
          dcList = dcData.datacenters || [];
          if (isMounted) setDatacenters(dcList);
        }

        // 2. Fetch all devices to check for IP conflicts
        const devListRes = await fetch('/api/devices').catch(() => null);
        let foundDevice = null;
        if (devListRes && devListRes.ok) {
          const listData = await devListRes.json();
          const allDevs = listData.devices || [];
          if (isMounted) {
            setExistingIps(allDevs.map((d) => d.ip_address));
          }
          foundDevice = allDevs.find(
            (d) => String(d.id) === String(deviceId) || d.ip_address === deviceId
          );
        }

        // 3. If not found in list, try single device endpoint
        if (!foundDevice) {
          const singleRes = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`);
          if (singleRes.ok) {
            const singleData = await singleRes.json();
            foundDevice = singleData.device;
          }
        }

        if (!foundDevice) {
          throw new Error(`Device with ID "${deviceId}" could not be found.`);
        }

        if (isMounted) {
          setDevice(foundDevice);
          setFormData({
            ip_address: foundDevice.ip_address || foundDevice.ip || '',
            hostname: foundDevice.hostname || '',
            device_type: foundDevice.device_type || foundDevice.deviceType || 'Server',
            snmp_community: foundDevice.snmp_community || foundDevice.snmpCommunity || 'public',
            datacenter_id: foundDevice.datacenter_id || foundDevice.datacenterId || '',
            location: foundDevice.location || '',
            rack_number: foundDevice.rack_number || foundDevice.rackNumber || '',
          });
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(err.message || 'Error loading device data');
        }
      } finally {
        if (isMounted) setIsFetching(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [deviceId]);

  const handleChange = (e) => {
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

  const handleDeviceTypeSelect = (type) => {
    setFormData((prev) => ({ ...prev, device_type: type }));
  };

  const handleReset = () => {
    if (device) {
      setFormData({
        ip_address: device.ip_address || device.ip || '',
        hostname: device.hostname || '',
        device_type: device.device_type || device.deviceType || 'Server',
        snmp_community: device.snmp_community || device.snmpCommunity || 'public',
        datacenter_id: device.datacenter_id || device.datacenterId || '',
        location: device.location || '',
        rack_number: device.rack_number || device.rackNumber || '',
      });
      setAlert(null);
    }
  };

  const handleSubmit = async (e) => {
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
        submessage: 'Please provide a valid IPv4 address (e.g., 10.0.1.15).',
      });
      return;
    }

    // 2. Conflict check
    const currentDeviceIp = device?.ip_address || device?.ip;
    if (cleanIp !== currentDeviceIp) {
      const isConflicting = existingIps.some((existing) => existing === cleanIp && existing !== currentDeviceIp);
      if (isConflicting) {
        setIsLoading(false);
        setAlert({
          type: 'error',
          message: 'IP Conflict Detected (HTTP 409)',
          submessage: `The IP address "${cleanIp}" is already in use by another cluster node.`,
        });
        return;
      }
    }

    const matchedDc = datacenters.find((d) => String(d.id) === String(formData.datacenter_id));
    const resolvedDcName = matchedDc ? matchedDc.name : (device?.datacenter_name || 'Local Datacenter');

    try {
      const payload = {
        id: deviceId,
        ip_address: cleanIp,
        hostname: formData.hostname.trim() || `${formData.device_type.toLowerCase()}-${cleanIp.replace(/\./g, '-')}`,
        device_type: formData.device_type,
        datacenter_id: formData.datacenter_id || undefined,
        datacenter_name: resolvedDcName,
        location: formData.location.trim() || (matchedDc ? matchedDc.location : 'Primary Datacenter'),
        rack_number: formData.rack_number.trim() || 'Rack 01 (U10)',
        snmp_community: formData.snmp_community.trim() || 'public',
      };

      const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server responded with status ${res.status}`);
      }

      setAlert({
        type: 'success',
        message: 'Device Configuration Successfully Updated',
        submessage: `Changes for "${payload.hostname}" (${payload.ip_address}) have been saved.`,
      });

      setTimeout(() => {
        navigateTo('/');
      }, 1200);

    } catch (err) {
      setAlert({
        type: 'error',
        message: 'Failed to Update Device',
        submessage: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deviceTypes = [
    { type: 'Server', label: 'Compute Server', icon: ServerIcon },
    { type: 'MikroTik', label: 'MikroTik Router', icon: Radio },
    { type: 'Switch', label: 'Managed Switch', icon: Layers },
    { type: 'OLT', label: 'Fiber GPON OLT', icon: HardDrive },
  ];

  if (isFetching) {
    return (
      <div className="min-h-screen bg-base-200/40 text-base-content flex flex-col items-center justify-center p-6">
        <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-xl space-y-4 max-w-sm w-full text-center">
          <div className="loading loading-spinner loading-lg text-primary mx-auto" />
          <h3 className="text-sm font-bold text-base-content">Loading Device Details...</h3>
          <p className="text-xs text-base-content/60 font-mono">UID: {deviceId}</p>
        </div>
      </div>
    );
  }

  if (fetchError && !device) {
    return (
      <div className="min-h-screen bg-base-200/40 text-base-content flex flex-col items-center justify-center p-6">
        <div className="p-6 rounded-2xl bg-base-100 border border-error/30 shadow-2xl space-y-4 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-error/15 text-error flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-base-content">Device Not Found</h3>
          <p className="text-xs text-base-content/70">{fetchError}</p>
          <button
            type="button"
            onClick={() => navigateTo('/')}
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
    <div className="min-h-screen bg-base-200/40 text-base-content py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        
        {/* Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-content/10 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-base-content/60">
              <button 
                type="button"
                onClick={() => navigateTo('/')}
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
                  Target Node: <span className="font-bold text-base-content">{device?.hostname}</span> ({device?.ip_address}) • UID: {deviceId}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('/')}
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

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Form */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content flex items-center justify-between">
                      <span>Cluster Hostname</span>
                      <span className="text-[10px] font-normal text-base-content/50">Optional</span>
                    </label>
                    <input
                      type="text"
                      name="hostname"
                      placeholder="e.g. srv-app-prod-01"
                      value={formData.hostname}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 font-mono text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                {/* Device Type Selection */}
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

              {/* Card 2: Datacenter & Rack */}
              <div className="bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-base-content tracking-tight">
                      Datacenter &amp; Physical Placement
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-base-200 text-base-content/60">
                    Step 2 of 3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content">
                      Datacenter Facility
                    </label>
                    <select
                      name="datacenter_id"
                      value={formData.datacenter_id}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 text-xs text-base-content focus:outline-none focus:border-primary transition-all"
                    >
                      <option value="">Select Facility</option>
                      {datacenters.map((dc) => (
                        <option key={dc.id} value={dc.id}>
                          {dc.name} ({dc.location})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content">
                      Location &amp; Region
                    </label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g. EU-Central (Frankfurt)"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-base-content">
                      Rack Unit Position
                    </label>
                    <input
                      type="text"
                      name="rack_number"
                      placeholder="e.g. Rack F-02 (U12)"
                      value={formData.rack_number}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 font-mono text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary transition-all"
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
                    placeholder="e.g. public"
                    value={formData.snmp_community}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-base-content/20 bg-base-200/50 font-mono text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary transition-all"
                  />
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
                    onClick={() => navigateTo('/')}
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

          {/* Right Live Preview Card */}
          <div className="space-y-4">
            <div className="bg-base-100 border border-base-content/10 rounded-2xl p-5 shadow-sm space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  Live Node Preview
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                  ONLINE
                </span>
              </div>

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
                    {formData.hostname || 'unnamed-node'}
                  </span>
                  <span className="text-[11px] text-base-content/60 block truncate">
                    {formData.location || 'Unassigned Location'}
                  </span>
                </div>

                <div className="pt-2 border-t border-base-content/10 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-base-content/40 block">Rack Position</span>
                    <span className="font-mono text-base-content/80 truncate block">{formData.rack_number || 'Rack 01'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-base-content/40 block">SNMP Community</span>
                    <span className="font-mono text-base-content/80 truncate block">{formData.snmp_community || 'public'}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-info/10 border border-info/20 text-xs text-info-content dark:text-info space-y-1">
                <span className="font-bold block">Cluster Telemetry Active</span>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Saving updates will propagate configuration to PostgreSQL servers_info registry and live telemetry workers.
                </p>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

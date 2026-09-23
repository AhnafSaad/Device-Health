'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Server as ServerIcon, 
  Cpu, 
  MapPin, 
  Layers, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowLeft,
  ShieldCheck,
  Send,
  RotateCcw,
  Database
} from 'lucide-react';

export default function AddDevicePage() {
  const [formData, setFormData] = useState({
    ip_address: '',
    hostname: '',
    device_type: 'Server',
    snmp_community: 'public',
    location: '',
    rack_number: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleReset = () => {
    setFormData({
      ip_address: '',
      hostname: '',
      device_type: 'Server',
      snmp_community: 'public',
      location: '',
      rack_number: '',
    });
    setAlert(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 201 || response.status === 200) {
        const reloadInfo = data?.automation?.step_c_reload?.reloaded 
          ? 'Telegraf reloaded via SIGHUP (zero downtime)' 
          : (data?.automation?.step_c_reload?.message || 'Telegraf config generated');
        const configPath = data?.automation?.step_b_telegraf_config?.path || `/etc/telegraf/telegraf.d/device_${formData.ip_address}.conf`;

        setAlert({
          type: 'success',
          message: 'Device Added & Telegraf Orchestrated (201 Created)',
          submessage: `Registered ${data?.device?.hostname || formData.hostname || formData.ip_address} into PostgreSQL servers_info.\n• Config: ${configPath}\n• Status: ${reloadInfo}`,
          details: data?.automation,
        });

        setFormData({
          ip_address: '',
          hostname: '',
          device_type: 'Server',
          snmp_community: 'public',
          location: '',
          rack_number: '',
        });
      } else if (response.status === 409) {
        setAlert({
          type: 'error',
          message: '409 Conflict: Duplicate Node IP',
          submessage: data.message || `A device with IP ${formData.ip_address} already exists in servers_info.`,
        });
      } else if (response.status === 400) {
        setAlert({
          type: 'error',
          message: '400 Bad Request: Validation Error',
          submessage: data.message || 'Invalid IPv4 address or missing required fields.',
        });
      } else {
        setAlert({
          type: 'error',
          message: `Error (${response.status})`,
          submessage: data.message || 'Failed to complete orchestrator workflow.',
        });
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: 'Backend Orchestrator Error',
        submessage: err.message || 'Unable to connect to the /api/devices route handler.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200/40 text-base-content flex flex-col font-sans p-4 sm:p-6 lg:p-8">
      
      {/* Toast Notification Alert */}
      {alert && (
        <div className="fixed top-6 right-6 z-50 max-w-md animate-slideDown">
          <div
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3.5 ${
              alert.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200 shadow-emerald-500/10'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-200 shadow-rose-500/10'
            }`}
          >
            {alert.type === 'success' ? (
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              <div className="font-bold text-sm text-white">{alert.message}</div>
              {alert.submessage && (
                <div className="text-xs opacity-80 mt-0.5 leading-relaxed">{alert.submessage}</div>
              )}
            </div>
            <button
              onClick={() => setAlert(null)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-base-content/70 hover:text-base-content hover:bg-base-200/80 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Fleet Overview</span>
          </Link>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-primary/10 border border-primary/20 text-primary">
            <Database className="w-3.5 h-3.5" />
            <span>PostgreSQL: servers_info</span>
          </div>
        </div>

        {/* Centered Modern Card Container */}
        <div className="rounded-3xl border border-base-content/10 bg-base-100/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-base-content/10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-content flex items-center justify-center shadow-lg shadow-primary/20">
              <ServerIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-base-content">
                Add Device
              </h2>
              <p className="text-xs sm:text-sm text-base-content/50 mt-0.5">
                Register a hardware device (Server, MikroTik, Switch, or OLT) into PostgreSQL <code className="font-mono text-primary font-semibold">servers_info</code> table.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            
            {/* Row 1: IP Address & Hostname */}
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
                  Target node IPv4 management interface
                </p>
              </div>

              {/* Hostname */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Device Hostname</span>
                </label>
                <input
                  type="text"
                  name="hostname"
                  value={formData.hostname}
                  onChange={handleChange}
                  placeholder="e.g. core-router-ams-01"
                  className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-mono text-base-content placeholder:text-base-content/30 outline-none transition-all"
                />
                <p className="text-[11px] text-base-content/40 font-mono">
                  DNS FQDN or human-readable identifier
                </p>
              </div>

            </div>

            {/* Row 2: Device Type & SNMP Community */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Device Type (Server, MikroTik, Switch, OLT) */}
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
                  <option value="Server">Server (Host-Resources MIB)</option>
                  <option value="MikroTik">MikroTik (RouterOS MIB)</option>
                  <option value="Switch">Switch (L2/L3 IF-MIB)</option>
                  <option value="OLT">OLT (PON Chassis)</option>
                </select>
                <p className="text-[11px] text-base-content/40 font-mono">
                  Selects Telegraf SNMP input template
                </p>
              </div>

              {/* SNMP Community String */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-accent" />
                    <span>SNMP Community</span>
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
                  SNMP v2c read-only community
                </p>
              </div>

            </div>

            {/* Row 3: Datacenter Location & Rack Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-info" />
                  <span>Location</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Frankfurt DC-1"
                  className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm text-base-content placeholder:text-base-content/30 outline-none transition-all"
                />
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
                  placeholder="e.g. Rack A-04"
                  className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-mono text-base-content placeholder:text-base-content/30 outline-none transition-all"
                />
              </div>

            </div>

            {/* Form Actions */}
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
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-content shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    <span>Inserting Device...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Add Device</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

        {/* Security & Automation Pipeline Info Footer */}
        <div className="rounded-2xl border border-base-content/10 bg-base-100/50 p-5 space-y-3 text-xs text-base-content/70">
          <div className="flex items-center gap-2 font-bold text-base-content">
            <ShieldCheck className="w-4 h-4 text-success shrink-0" />
            <span>Bare-Metal Ubuntu Automation Pipeline</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
            <div className="p-2.5 rounded-xl bg-base-200/50 border border-base-content/5 space-y-1">
              <div className="font-bold text-primary flex items-center gap-1">
                <span>Step A</span>
              </div>
              <p className="opacity-80">
                Inserts node metadata into local PostgreSQL <code className="font-mono text-base-content">servers_info</code> table.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-base-200/50 border border-base-content/5 space-y-1">
              <div className="font-bold text-secondary flex items-center gap-1">
                <span>Step B</span>
              </div>
              <p className="opacity-80">
                Writes custom SNMP TOML to <code className="font-mono text-base-content">/etc/telegraf/telegraf.d/device_[ip].conf</code>.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-base-200/50 border border-base-content/5 space-y-1">
              <div className="font-bold text-accent flex items-center gap-1">
                <span>Step C</span>
              </div>
              <p className="opacity-80">
                Executes <code className="font-mono text-base-content">kill -SIGHUP $(pidof telegraf)</code> for zero-downtime hot-reload.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

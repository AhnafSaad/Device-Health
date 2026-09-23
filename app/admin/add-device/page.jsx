'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Server as ServerIcon, 
  Cpu, 
  MapPin, 
  Layers, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  Building2,
  Plus,
  RotateCcw,
  Send,
  Database,
  ChevronDown,
  Check
} from 'lucide-react';

export default function AddDevicePage() {
  const [datacenters, setDatacenters] = useState([]);
  const [isLoadingDcs, setIsLoadingDcs] = useState(true);
  const [isDcDropdownOpen, setIsDcDropdownOpen] = useState(false);
  const dcDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dcDropdownRef.current && !dcDropdownRef.current.contains(e.target)) {
        setIsDcDropdownOpen(false);
      }
    };
    if (isDcDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDcDropdownOpen]);
  
  const [formData, setFormData] = useState({
    ip_address: '',
    device_type: 'Server',
    snmp_community: 'public',
    datacenter_id: '',
    location: '',
    rack_number: 'Rack A-01 (U10)',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Fetch dynamic datacenters on mount
  useEffect(() => {
    async function loadDatacenters() {
      try {
        const res = await fetch('/api/datacenters');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.datacenters)) {
            setDatacenters(data.datacenters);
            if (data.datacenters.length > 0) {
              setFormData((prev) => ({
                ...prev,
                datacenter_id: data.datacenters[0].id,
                location: data.datacenters[0].location,
              }));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load datacenters:', err);
      } finally {
        setIsLoadingDcs(false);
      }
    }
    loadDatacenters();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'datacenter_id') {
      const selectedDc = datacenters.find((d) => String(d.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        datacenter_id: value,
        location: selectedDc ? selectedDc.location : prev.location,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setAlert({ type: 'error', message: data.message || 'Registration failed' });
        return;
      }

      setAlert({
        type: 'success',
        message: 'Device Node Registered',
        submessage: `Successfully provisioned ${formData.ip_address} into datacenter ${formData.location}.`,
      });

      setFormData((prev) => ({
        ...prev,
        ip_address: '',
      }));
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Network error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-300 text-base-content p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link href="/" className="btn btn-ghost btn-sm gap-2 text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-base-content/60 font-mono">
            <Database className="w-3.5 h-3.5 text-primary" />
            <span>Active Registry: servers_info (DC-linked)</span>
          </div>
        </div>

        {/* Card */}
        <div className="card bg-base-100 shadow-xl border border-base-content/10">
          <div className="card-body">
            <div className="flex items-center gap-3 border-b border-base-content/10 pb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <ServerIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="card-title text-xl font-bold">Register Hardware Node</h2>
                <p className="text-xs text-base-content/60">
                  Provision SNMP/ICMP monitoring with dynamic Data Center association.
                </p>
              </div>
            </div>

            {alert && (
              <div className={`alert ${alert.type === 'success' ? 'alert-success' : 'alert-error'} text-xs mt-4`}>
                {alert.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <div>
                  <span className="font-bold">{alert.message}</span>
                  {alert.submessage && <p className="text-[11px] mt-0.5">{alert.submessage}</p>}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              
              {/* Row 1: IP & Device Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label text-xs font-bold">
                    <span className="label-text flex items-center gap-1.5">
                      <ServerIcon className="w-3.5 h-3.5 text-primary" /> IP Address *
                    </span>
                  </label>
                  <input
                    type="text"
                    name="ip_address"
                    required
                    value={formData.ip_address}
                    onChange={handleChange}
                    placeholder="192.168.1.100"
                    className="input input-bordered input-sm font-mono"
                  />
                </div>

                <div className="form-control">
                  <label className="label text-xs font-bold">
                    <span className="label-text flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-secondary" /> Device Type *
                    </span>
                  </label>
                  <select
                    name="device_type"
                    value={formData.device_type}
                    onChange={handleChange}
                    className="select select-bordered select-sm font-semibold"
                  >
                    <option value="Server">Server</option>
                    <option value="MikroTik">MikroTik Router</option>
                    <option value="Switch">Switch (Spine/Leaf)</option>
                    <option value="OLT">OLT Fiber Chassis</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Dynamic Data Center Dropdown & Rack */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control relative z-20">
                  <label className="label text-xs font-bold flex justify-between">
                    <span className="label-text flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary" /> Data Center (Dynamic) *
                    </span>
                  </label>

                  {/* Solid Opaque Dropdown Container */}
                  <div ref={dcDropdownRef} className="relative w-full">
                    <button
                      type="button"
                      onClick={() => !isLoadingDcs && setIsDcDropdownOpen(!isDcDropdownOpen)}
                      className={`w-full px-3 py-2 rounded-lg border border-base-content/20 bg-base-200/80 hover:bg-base-200 text-left text-xs font-medium flex items-center justify-between text-base-content transition-all ${
                        isDcDropdownOpen ? 'border-primary ring-2 ring-primary/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        {isLoadingDcs ? (
                          <span className="text-base-content/50">Loading Data Centers...</span>
                        ) : datacenters.length === 0 ? (
                          <span className="text-base-content/50">No Data Centers registered</span>
                        ) : (
                          <span className="truncate">
                            <span className="font-bold">
                              {datacenters.find((d) => String(d.id) === String(formData.datacenter_id))?.name || 'Select DC'}
                            </span>
                            <span className="text-base-content/50 ml-1.5 hidden sm:inline">
                              — {datacenters.find((d) => String(d.id) === String(formData.datacenter_id))?.location}
                            </span>
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-base-content/50 transition-transform duration-200 ${
                          isDcDropdownOpen ? 'rotate-180 text-primary' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu Popup: Solid Opaque Theme-Adaptive, z-50, shadow-2xl */}
                    {isDcDropdownOpen && (
                      <div
                        className="absolute left-0 top-full mt-1.5 w-full z-50 rounded-xl bg-base-100 border border-base-content/15 shadow-2xl text-base-content overflow-hidden"
                      >
                        <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                          {datacenters.map((dc) => {
                            const isSelected = String(formData.datacenter_id) === String(dc.id);
                            return (
                              <button
                                key={dc.id}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    datacenter_id: String(dc.id),
                                    location: dc.location,
                                  }));
                                  setIsDcDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between text-left transition-colors ${
                                  isSelected
                                    ? 'bg-primary text-primary-content font-bold shadow-xs'
                                    : 'text-base-content hover:bg-base-200/80'
                                }`}
                              >
                                <div className="truncate pr-2">
                                  <div className="font-mono font-bold">{dc.name}</div>
                                  <div className={`text-[11px] truncate flex items-center gap-1 ${
                                    isSelected ? 'text-primary-content/80' : 'text-base-content/60'
                                  }`}>
                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                    <span>{dc.location}</span>
                                  </div>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="label text-[10px] text-base-content/50">
                    <span className="label-text-alt flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary" />
                      Facility: {formData.location || 'Selected DC'}
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label text-xs font-bold">
                    <span className="label-text flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-warning" /> Rack Unit *
                    </span>
                  </label>
                  <input
                    type="text"
                    name="rack_number"
                    required
                    value={formData.rack_number}
                    onChange={handleChange}
                    placeholder="Rack A-01 (U12)"
                    className="input input-bordered input-sm font-mono"
                  />
                </div>
              </div>

              {/* Row 3: SNMP Community */}
              <div className="form-control">
                <label className="label text-xs font-bold">
                  <span className="label-text flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-accent" /> SNMP Community
                  </span>
                  <span className="label-text-alt font-mono text-[10px]">Default: public</span>
                </label>
                <input
                  type="text"
                  name="snmp_community"
                  value={formData.snmp_community}
                  onChange={handleChange}
                  placeholder="public"
                  className="input input-bordered input-sm font-mono"
                />
              </div>

              {/* Submit Button */}
              <div className="card-actions justify-end pt-4 border-t border-base-content/10">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary btn-sm gap-2"
                >
                  {isLoading ? <span className="loading loading-spinner loading-xs" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Register Node</span>
                </button>
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

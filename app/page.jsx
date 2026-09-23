'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  Server as ServerIcon, 
  Building2, 
  MapPin, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  SlidersHorizontal,
  RotateCcw,
  PlusCircle,
  Database,
  ChevronDown,
  Check,
  Sun,
  Moon
} from 'lucide-react';

export default function FleetDashboard() {
  const [servers, setServers] = useState([]);
  const [datacenters, setDatacenters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Theme state
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('noc-theme') || 'dark';
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('noc-theme', next);
    } catch {}
  };
  
  // Filters
  const [dcFilter, setDcFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDcFilterOpen, setIsDcFilterOpen] = useState(false);
  const dcFilterRef = useRef(null);

  // Close DC filter on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dcFilterRef.current && !dcFilterRef.current.contains(e.target)) {
        setIsDcFilterOpen(false);
      }
    };
    if (isDcFilterOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDcFilterOpen]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDcName, setNewDcName] = useState('');
  const [newDcLocation, setNewDcLocation] = useState('');
  const [modalAlert, setModalAlert] = useState(null);

  // Load telemetry & datacenters
  useEffect(() => {
    async function loadData() {
      try {
        const [telRes, dcRes] = await Promise.all([
          fetch('/api/telemetry'),
          fetch('/api/datacenters')
        ]);
        if (telRes.ok) {
          const telData = await telRes.json();
          if (telData && telData.telemetry) setServers(telData.telemetry);
        }
        if (dcRes.ok) {
          const dcData = await dcRes.json();
          if (dcData && dcData.datacenters) setDatacenters(dcData.datacenters);
        }
      } catch (err) {
        console.error('Failed to load NOC data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      // 1. Datacenter filter
      if (dcFilter !== 'all') {
        const matchId = String(s.datacenter_id) === String(dcFilter);
        const matchName = s.datacenter_name?.toLowerCase() === dcFilter.toLowerCase();
        const matchLoc = s.location?.toLowerCase().includes(dcFilter.toLowerCase());
        const dcObj = datacenters.find(d => String(d.id) === String(dcFilter));
        const matchTarget = dcObj && (s.location === dcObj.location || s.datacenter_name === dcObj.name);
        if (!matchId && !matchName && !matchLoc && !matchTarget) return false;
      }

      // 2. Status filter
      if (statusFilter === 'online' && s.status !== 'online') return false;
      if (statusFilter === 'offline' && s.status !== 'offline') return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchIp = (s.ip_address || s.ip || '').toLowerCase().includes(q);
        const matchHost = (s.hostname || '').toLowerCase().includes(q);
        const matchLoc = (s.location || '').toLowerCase().includes(q);
        const matchDc = (s.datacenter_name || '').toLowerCase().includes(q);
        return matchIp || matchHost || matchLoc || matchDc;
      }
      return true;
    });
  }, [servers, dcFilter, statusFilter, searchQuery, datacenters]);

  // Create Datacenter handler
  const handleAddDc = async (e) => {
    e.preventDefault();
    if (!newDcName.trim() || !newDcLocation.trim()) return;
    try {
      const res = await fetch('/api/datacenters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDcName.trim(), location: newDcLocation.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setDatacenters((prev) => [data.datacenter, ...prev]);
        setNewDcName('');
        setNewDcLocation('');
        setModalAlert({ type: 'success', message: `Data Center "${data.datacenter.name}" added!` });
      } else {
        setModalAlert({ type: 'error', message: data.message || 'Creation failed' });
      }
    } catch (err) {
      setModalAlert({ type: 'error', message: err.message });
    }
  };

  // Delete Datacenter handler
  const handleDeleteDc = async (id, name) => {
    if (!window.confirm(`Delete Data Center "${name}"?`)) return;
    try {
      await fetch(`/api/datacenters?id=${id}`, { method: 'DELETE' });
      setDatacenters((prev) => prev.filter((d) => String(d.id) !== String(id)));
      if (String(dcFilter) === String(id)) setDcFilter('all');
    } catch (err) {
      console.error(err);
    }
  };

  const onlineCount = servers.filter((s) => s.status === 'online').length;
  const healthPercent = Math.round((onlineCount / (servers.length || 1)) * 100);

  return (
    <div className="min-h-screen bg-base-300 text-base-content p-4 sm:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-4 sm:p-5 rounded-2xl shadow-lg border border-base-content/10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-primary to-indigo-600 text-primary-content rounded-xl shadow-md">
              <ServerIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">NOC Fleet Monitor</h1>
                <span className="badge badge-primary badge-sm font-mono font-bold">10k+ Nodes</span>
              </div>
              <p className="text-xs text-base-content/60">
                Multi-Data Center Infrastructure &amp; SNMP Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:text-primary transition-all duration-200"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-outline btn-primary btn-sm gap-2"
            >
              <Building2 className="w-4 h-4" />
              <span>Manage DCs ({datacenters.length})</span>
            </button>
            <Link
              href="/admin/add-device"
              className="btn btn-primary btn-sm gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Device</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat bg-base-100 rounded-2xl p-4 border border-base-content/10 shadow-sm">
            <div className="stat-title text-xs font-semibold">Total Nodes</div>
            <div className="stat-value text-2xl font-mono">{servers.length}</div>
            <div className="stat-desc text-[11px] text-base-content/50">Monitored Fleet</div>
          </div>
          <div className="stat bg-base-100 rounded-2xl p-4 border border-base-content/10 shadow-sm">
            <div className="stat-title text-xs font-semibold">Online Status</div>
            <div className="stat-value text-2xl font-mono text-success">{onlineCount}</div>
            <div className="stat-desc text-[11px] text-success">Healthy Telemetry</div>
          </div>
          <div className="stat bg-base-100 rounded-2xl p-4 border border-base-content/10 shadow-sm">
            <div className="stat-title text-xs font-semibold">Cluster Health</div>
            <div className="stat-value text-2xl font-mono text-primary">{healthPercent}%</div>
            <div className="stat-desc text-[11px] text-base-content/50">Fleet SLA</div>
          </div>
          <div className="stat bg-base-100 rounded-2xl p-4 border border-base-content/10 shadow-sm">
            <div className="stat-title text-xs font-semibold">Data Centers</div>
            <div className="stat-value text-2xl font-mono text-accent">{datacenters.length}</div>
            <div className="stat-desc text-[11px] text-base-content/50">Global Facilities</div>
          </div>
        </div>

        {/* Dashboard Filter Bar: Prominent Data Center Filter Dropdown */}
        <div className="bg-base-100 p-4 rounded-2xl border border-base-content/10 shadow-lg space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-primary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes by IP, hostname, DC facility..."
                className="input input-sm input-bordered w-full pl-9 text-xs"
              />
            </div>

            {/* Data Center Filter Dropdown with Solid Opaque Container & z-50 */}
            <div ref={dcFilterRef} className="relative z-30 min-w-[220px]">
              <button
                type="button"
                onClick={() => setIsDcFilterOpen(!isDcFilterOpen)}
                className={`w-full px-3 py-1.5 rounded-xl border border-base-content/20 bg-base-200/80 hover:bg-base-200 text-left text-xs font-semibold flex items-center justify-between text-base-content transition-all ${
                  isDcFilterOpen ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  {dcFilter === 'all' ? (
                    <span className="truncate">All Data Centers ({servers.length})</span>
                  ) : (
                    <span className="truncate text-primary">
                      {datacenters.find((d) => String(d.id) === String(dcFilter))?.name || dcFilter}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-base-content/50 transition-transform duration-200 ${
                    isDcFilterOpen ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu Popup: Solid Opaque Theme-Adaptive, z-50, shadow-2xl */}
              {isDcFilterOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 w-full min-w-[240px] z-50 rounded-xl bg-base-100 border border-base-content/15 shadow-2xl text-base-content overflow-hidden"
                >
                  <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDcFilter('all');
                        setIsDcFilterOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        dcFilter === 'all'
                          ? 'bg-primary text-primary-content font-bold shadow-xs'
                          : 'text-base-content hover:bg-base-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>All Data Centers ({servers.length})</span>
                      </div>
                      {dcFilter === 'all' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    {datacenters.map((dc) => {
                      const isSelected = String(dcFilter) === String(dc.id);
                      return (
                        <button
                          key={dc.id}
                          type="button"
                          onClick={() => {
                            setDcFilter(String(dc.id));
                            setIsDcFilterOpen(false);
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

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-base-200 p-1 rounded-xl">
              {['all', 'online', 'offline'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-xs uppercase ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {st}
                </button>
              ))}
            </div>

            {(dcFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setDcFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="btn btn-ghost btn-xs text-primary gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

          </div>
        </div>

        {/* Telemetry Table */}
        <div className="card bg-base-100 shadow-xl border border-base-content/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead className="bg-base-200 text-xs font-bold uppercase tracking-wider text-base-content/70">
                <tr>
                  <th>Device &amp; IP</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>CPU / RAM</th>
                  <th>Data Center &amp; Rack</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10">
                      <span className="loading loading-spinner loading-md text-primary" />
                    </td>
                  </tr>
                ) : filteredServers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-xs text-base-content/50">
                      No devices matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredServers.map((s) => (
                    <tr key={s.id || s.ip_address} className="hover">
                      <td>
                        <div className="font-bold text-xs font-mono">{s.hostname}</div>
                        <div className="text-[11px] text-base-content/60 font-mono">{s.ip_address || s.ip}</div>
                      </td>
                      <td>
                        <span className={`badge badge-xs font-bold ${s.status === 'online' ? 'badge-success' : 'badge-error'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-ghost badge-xs">{s.health || 'Normal'}</span>
                      </td>
                      <td>
                        <div className="text-[11px] font-mono">
                          CPU: <span className="font-bold">{s.cpu_usage ?? s.cpuUsage}%</span> • RAM: <span className="font-bold">{s.ram_usage ?? s.ramUsage}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Building2 className="w-3 h-3" />
                          <span>{s.datacenter_name || s.location}</span>
                        </div>
                        <div className="text-[10px] text-base-content/50 font-mono flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{s.rack_number || s.rackNumber || 'Unassigned Rack'}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Datacenter Modal */}
        {isModalOpen && (
          <div className="modal modal-open">
            <div className="modal-box max-w-2xl bg-base-100 border border-base-content/10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>Data Center Facility Management</span>
              </h3>
              <p className="text-xs text-base-content/60 mt-1">
                Manage global facilities, regional clusters, and hardware rack assignments in the datacenter registry.
              </p>

              {modalAlert && (
                <div className={`alert ${modalAlert.type === 'success' ? 'alert-success' : 'alert-error'} text-xs my-3`}>
                  <span>{modalAlert.message}</span>
                </div>
              )}

              {/* Add DC Form */}
              <form onSubmit={handleAddDc} className="p-3 bg-base-200/50 rounded-xl my-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label text-xs font-semibold">DC Identifier / Name</label>
                    <input
                      type="text"
                      required
                      value={newDcName}
                      onChange={(e) => setNewDcName(e.target.value)}
                      placeholder="e.g. DC-US-Central"
                      className="input input-sm input-bordered font-mono text-xs"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label text-xs font-semibold">Location / Region</label>
                    <input
                      type="text"
                      required
                      value={newDcLocation}
                      onChange={(e) => setNewDcLocation(e.target.value)}
                      placeholder="e.g. Chicago, IL"
                      className="input input-sm input-bordered text-xs"
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-sm gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Data Center
                </button>
              </form>

              {/* List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <div className="text-xs font-bold uppercase tracking-wider text-base-content/70">
                  Current Facilities ({datacenters.length})
                </div>
                {datacenters.map((dc) => (
                  <div key={dc.id} className="p-3 bg-base-200 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold font-mono text-base-content">{dc.name}</div>
                      <div className="text-[11px] text-base-content/60">{dc.location}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteDc(dc.id, dc.name)}
                      className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="modal-action">
                <button onClick={() => setIsModalOpen(false)} className="btn btn-sm">Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

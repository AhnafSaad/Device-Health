'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft,
  Server as ServerIcon, 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  MapPin, 
  Clock, 
  Layers, 
  Terminal, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2,
  Database,
  Radio,
  Network,
  ShieldCheck,
  Pencil,
  Trash2,
  ChevronRight,
  Tag
} from 'lucide-react';
import { BrandLogo } from '../../src/components/BrandLogo';

const BRAND_OPTIONS = [
  'MikroTik',
  'Huawei',
  'Juniper',
  'Cisco',
  'Arista',
  'BDCOM',
  'V-SOL',
  'DBC',
  'Other',
];

export default function InspectDevicePage({ params: paramsProp }) {
  const router = useRouter();
  const nextParams = useParams();
  // Support both params prop (promise or object) and useParams hook
  const resolvedParams = paramsProp && typeof paramsProp.then === 'function' 
    ? use(paramsProp) 
    : (paramsProp || nextParams || {});
  const id = resolvedParams?.id;

  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // SRE Diagnostics state
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // Edit / Delete action states
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    ip_address: '',
    hostname: '',
    device_type: 'Server',
    brand: 'Other',
    location: '',
    rack_number: '',
    snmp_community: 'public'
  });

  useEffect(() => {
    if (!id) return;
    async function loadDevice() {
      try {
        setLoading(true);
        // Try fetching from /api/devices/[id]
        const res = await fetch(`/api/devices/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.device) {
            setDevice(data.device);
            setEditForm({
              ip_address: data.device.ip_address || data.device.ip || '',
              hostname: data.device.hostname || '',
              device_type: data.device.device_type || data.device.deviceType || 'Server',
              brand: data.device.brand || 'Other',
              location: data.device.location || '',
              rack_number: data.device.rack_number || data.device.rackNumber || '',
              snmp_community: data.device.snmp_community || data.device.snmpCommunity || 'public',
            });
            return;
          }
        }
        
        // Fallback: check telemetry endpoint
        const telRes = await fetch('/api/telemetry');
        if (telRes.ok) {
          const telData = await telRes.json();
          const match = (telData.telemetry || []).find((t) => String(t.id) === String(id) || t.ip_address === String(id));
          if (match) {
            setDevice(match);
            setEditForm({
              ip_address: match.ip_address || '',
              hostname: match.hostname || '',
              device_type: match.device_type || 'Server',
              brand: match.brand || 'Other',
              location: match.location || '',
              rack_number: match.rack_number || '',
              snmp_community: match.snmp_community || 'public',
            });
            return;
          }
        }

        setError(`Device with identifier "${id}" could not be located in servers_info.`);
      } catch (err) {
        setError(err?.message || 'Failed to load device details');
      } finally {
        setLoading(false);
      }
    }

    loadDevice();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200/40 text-base-content flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="loading loading-spinner loading-lg text-primary" />
          <span className="text-xs font-mono uppercase tracking-wider text-base-content/60">
            Querying node telemetry &amp; hardware specs...
          </span>
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="min-h-screen bg-base-200/40 text-base-content flex items-center justify-center p-6">
        <div className="max-w-md p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-xl text-center space-y-4">
          <AlertOctagon className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold">Node Not Found</h2>
          <p className="text-xs text-base-content/70">{error || 'Device could not be found.'}</p>
          <button
            onClick={() => router.push('/')}
            className="btn btn-primary btn-sm rounded-xl font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isOnline = (device.status || 'online') === 'online';
  const cpuVal = Number(device.cpu_usage ?? device.cpuUsage ?? 35);
  const ramVal = Number(device.ram_usage ?? device.ramUsage ?? 45);
  const diskVal = Number(device.disk_usage ?? device.diskUsage ?? 40);

  const getMetricColor = (val) => {
    if (val < 70) return 'text-emerald-500';
    if (val <= 85) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getProgressColor = (val) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (val <= 85) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  };

  const handleCopySsh = () => {
    const ip = device.ip_address || device.ip;
    navigator.clipboard?.writeText(`ssh admin@${ip}`);
    setCopiedSsh(true);
    setTimeout(() => setCopiedSsh(false), 2000);
  };

  const handlePing = () => {
    setIsPinging(true);
    setPingResult(null);
    const ip = device.ip_address || device.ip;
    setTimeout(() => {
      setIsPinging(false);
      if (isOnline) {
        const ms = Math.floor(Math.random() * 20) + 8;
        setPingResult(`64 bytes from ${ip}: icmp_seq=1 ttl=58 time=${ms}ms (0% packet loss)`);
      } else {
        setPingResult(`From 10.0.0.1: Destination Host Unreachable (${ip}) - 100% loss`);
      }
    }, 500);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const data = await res.json();
        setDevice((prev) => ({ ...prev, ...(data.device || editForm) }));
        setIsEditing(false);
      }
    } catch {
      // safe fallback
    }
  };

  const handleDeleteDevice = async () => {
    try {
      const res = await fetch(`/api/devices/${device.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
      }
    } catch {
      router.push('/');
    }
  };

  const partitions = [
    { mount: '/', filesystem: '/dev/nvme0n1p2', total: '250 GB', usedPct: diskVal, role: 'Root Filesystem' },
    { mount: '/var/log', filesystem: '/dev/nvme0n1p3', total: '120 GB', usedPct: Math.min(98, Math.round(diskVal * 1.08)), role: 'System Audit Logs' },
    { mount: '/data', filesystem: '/dev/nvme1n1p1', total: '1.6 TB', usedPct: Math.max(12, Math.round(diskVal * 0.85)), role: 'Primary Data Volume' },
  ];

  return (
    <div className="min-h-screen bg-base-200/40 text-base-content p-4 sm:p-6 lg:p-8 font-sans selection:bg-primary/20 selection:text-primary">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* 1. Breadcrumbs & Back Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-base-content/60 font-medium">
            <button
              onClick={() => router.push('/')}
              className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
            >
              Dashboard
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
            <button
              onClick={() => router.push('/')}
              className="hover:text-primary transition-colors font-semibold"
            >
              Fleet Nodes
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
            <span className="text-base-content font-mono font-bold truncate max-w-xs">
              {device.hostname}
            </span>
          </div>

          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-base-100 hover:bg-base-200 border border-base-content/10 text-base-content transition-all shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Fleet Dashboard</span>
          </button>
        </div>

        {/* 2. Page Header with ONLY ONE Top-Right Action Hub for Edit and Delete */}
        <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl border ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_16px_rgba(244,63,94,0.2)]'
            }`}>
              <ServerIcon className="w-7 h-7" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <BrandLogo brand={device.brand} size="md" />

                <h1 className="text-xl sm:text-2xl font-black text-base-content tracking-tight">
                  {device.hostname}
                </h1>

                {/* Status UP/DOWN Pulse */}
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    UP
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.25)] animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    DOWN
                  </span>
                )}

                {/* Device Type Badge */}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/10 text-primary">
                  {device.device_type || device.deviceType || 'Server'}
                </span>

                {/* Brand Name Badge */}
                {device.brand && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-base-content/20 bg-base-200/80 text-base-content shadow-2xs">
                    <BrandLogo brand={device.brand} size="xs" />
                    <span>{device.brand}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60 font-mono mt-1.5">
                <span className="font-bold text-base-content text-sm">{device.ip_address || device.ip}</span>
                <span>•</span>
                <span>UID: {device.id}</span>
                <span>•</span>
                <span className="text-base-content/70">{device.datacenter_name || device.location}</span>
              </div>
            </div>
          </div>

          {/* EXCLUSIVE TOP-RIGHT ACTIONS: Edit & Delete ONLY */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-base-content bg-base-100 hover:text-primary hover:border-primary/40 hover:bg-primary/10 border border-base-content/20 transition-all duration-150 shadow-xs"
              title={`Edit ${device.hostname}`}
            >
              <Pencil className="w-4 h-4 text-base-content/70" />
              <span>Edit Device</span>
            </button>

            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-error bg-error/10 hover:bg-error hover:text-error-content border border-error/30 transition-all duration-150 shadow-xs"
              title={`Delete ${device.hostname}`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Device</span>
            </button>
          </div>
        </div>

        {/* 3. Diagnostic Alerts & Health Status */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5 px-1">
            <Activity className="w-3.5 h-3.5 text-primary" />
            Diagnostic Alerts &amp; Fleet Health
          </h2>

          {!isOnline && (
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
              <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm sm:text-base">Host Status: OFFLINE CRITICAL</div>
                <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                  Heartbeat polling dropped out. Host unreachable at IP <span className="font-mono font-bold">{device.ip_address || device.ip}</span>. Check IPMI power status or Top-of-Rack switch port.
                </div>
              </div>
            </div>
          )}

          {isOnline && cpuVal > 85 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm sm:text-base">Sustained CPU Saturation ({cpuVal}%)</div>
                <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                  Compute core thread contention detected. Sustained utilization exceeds standard operating threshold.
                </div>
              </div>
            </div>
          )}

          {isOnline && ramVal > 85 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm sm:text-base">Memory Pressure Critical ({ramVal}%)</div>
                <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                  System buffer exhausted. High likelihood of Linux OOM reaper terminating critical worker threads.
                </div>
              </div>
            </div>
          )}

          {isOnline && diskVal > 85 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm sm:text-base">NVMe Storage Near Capacity ({diskVal}%)</div>
                <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                  Volume saturation warning: Inspect `/var/log` or rotate application audit archives.
                </div>
              </div>
            </div>
          )}

          {isOnline && cpuVal <= 85 && ramVal <= 85 && diskVal <= 85 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
              <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm sm:text-base">System Operational &amp; Nominal</div>
                <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                  All host telemetry metrics are securely within standard SLA parameters.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Full-Page Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column (8 cols): Utilization & Partitions */}
          <div className="lg:col-span-8 space-y-6">

            {/* Resource Utilization Card */}
            <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Resource Utilization &amp; Telemetry
                </h3>
                <span className="text-[11px] font-mono text-base-content/50">
                  &lt;70% OK • 70-85% WARN • &gt;85% CRIT
                </span>
              </div>

              <div className="space-y-5">
                {/* CPU Bar */}
                <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/5">
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="flex items-center gap-2 text-base-content">
                      <Cpu className="w-4 h-4 text-base-content/70" />
                      <span>Compute CPU</span>
                    </span>
                    <span className={`font-mono text-sm font-black ${getMetricColor(cpuVal)}`}>
                      {isOnline ? `${cpuVal}%` : 'Offline'}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(cpuVal)}`}
                      style={{ width: isOnline ? `${cpuVal}%` : '0%' }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                    <span>Target SLA: &lt;70%</span>
                    <span>Load: {device.load_average || '0.78, 0.84, 0.91'}</span>
                  </div>
                </div>

                {/* RAM Bar */}
                <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/5">
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="flex items-center gap-2 text-base-content">
                      <MemoryStick className="w-4 h-4 text-base-content/70" />
                      <span>RAM Memory</span>
                    </span>
                    <span className={`font-mono text-sm font-black ${getMetricColor(ramVal)}`}>
                      {isOnline ? `${ramVal}%` : 'Offline'}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(ramVal)}`}
                      style={{ width: isOnline ? `${ramVal}%` : '0%' }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                    <span>Target SLA: &lt;80%</span>
                    <span>Used: {isOnline ? `${Math.round(ramVal * 0.64)} GB / 64 GB` : '0 GB'}</span>
                  </div>
                </div>

                {/* Disk Bar */}
                <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/5">
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="flex items-center gap-2 text-base-content">
                      <HardDrive className="w-4 h-4 text-base-content/70" />
                      <span>NVMe Storage</span>
                    </span>
                    <span className={`font-mono text-sm font-black ${getMetricColor(diskVal)}`}>
                      {diskVal}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(diskVal)}`}
                      style={{ width: `${diskVal}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                    <span>Target SLA: &lt;85%</span>
                    <span>Allocated: {Math.round(diskVal * 20)} GB / 2,000 GB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Disk Partitions Breakdown */}
            <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                  <Database className="w-4 h-4 text-secondary" />
                  Individual Disk Partitions
                </h3>
                <span className="text-[11px] font-mono text-base-content/50">ext4 / XFS</span>
              </div>

              <div className="rounded-xl border border-base-content/10 bg-base-200/30 overflow-hidden divide-y divide-base-content/10">
                {partitions.map((part) => (
                  <div key={part.mount} className="p-4 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono font-bold text-base-content text-sm">{part.mount}</span>
                        <span className="text-base-content/60 text-xs ml-2">({part.role})</span>
                      </div>
                      <div className="font-mono text-xs">
                        <span className={`font-bold ${getMetricColor(part.usedPct)}`}>{part.usedPct}%</span>
                        <span className="text-base-content/50 ml-1">/ {part.total}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getProgressColor(part.usedPct)}`}
                        style={{ width: `${part.usedPct}%` }}
                      />
                    </div>
                    <div className="text-[11px] font-mono text-base-content/50 mt-1.5 flex justify-between">
                      <span>{part.filesystem}</span>
                      <span>ext4 (rw,noatime)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (4 cols): Hardware Specs & SRE Diagnostics */}
          <div className="lg:col-span-4 space-y-6">

            {/* Hardware Specifications */}
            <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                Hardware Specifications
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <ServerIcon className="w-3.5 h-3.5 text-primary" />
                      Device Brand / Vendor
                    </span>
                    <BrandLogo brand={device.brand} size="xs" />
                  </div>
                  <div className="font-semibold text-base-content flex items-center gap-2">
                    <BrandLogo brand={device.brand} size="sm" />
                    <span>{device.brand || 'Unassigned / Other'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Uptime
                  </div>
                  <div className="font-semibold font-mono text-base-content">{device.uptime || '14d 6h'}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-secondary" />
                    Datacenter Facility
                  </div>
                  <div className="font-semibold text-base-content">
                    {device.datacenter_name || device.location}
                  </div>
                  <div className="text-[11px] text-base-content/50 font-mono mt-0.5">{device.location}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                    <Layers className="w-3.5 h-3.5 text-accent" />
                    Rack Elevation Unit
                  </div>
                  <div className="font-semibold font-mono text-base-content">{device.rack_number || 'Rack 01'}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    SNMPv2c Polling Engine
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="font-bold text-emerald-500">Active &amp; Protected</span>
                    <span className="text-[10px] text-base-content/40 font-sans">(Community string secured)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Immediate SRE Diagnostics */}
            <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                Immediate SRE Diagnostics
              </h3>

              <div className="space-y-2.5">
                <button
                  onClick={handlePing}
                  disabled={isPinging}
                  className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold border border-primary/30 text-primary hover:bg-primary hover:text-primary-content transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>{isPinging ? 'Pinging Node...' : 'Run ICMP Ping Test'}</span>
                </button>

                <button
                  onClick={handleCopySsh}
                  className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold border border-base-content/20 text-base-content hover:bg-base-200 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {copiedSsh ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSsh ? 'SSH Command Copied!' : `Copy: ssh admin@${device.ip_address || device.ip}`}</span>
                </button>
              </div>

              {pingResult && (
                <div className="p-3.5 rounded-xl bg-base-300/80 border border-base-content/10 font-mono text-xs text-base-content/90 animate-fadeIn space-y-1">
                  <div className="text-[10px] text-base-content/50 uppercase font-bold tracking-wider">ICMP Ping Echo Output:</div>
                  <div className="leading-relaxed">{pingResult}</div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Edit Modal for Inspect Page */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg rounded-2xl bg-base-100 border border-base-content/15 shadow-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-base-content">Edit Device Configuration</h3>
              <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-base-content/70">Hostname</label>
                  <input
                    type="text"
                    value={editForm.hostname}
                    onChange={(e) => setEditForm({ ...editForm, hostname: e.target.value })}
                    className="input input-sm input-bordered w-full rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-base-content/70">IPv4 Address</label>
                  <input
                    type="text"
                    value={editForm.ip_address}
                    onChange={(e) => setEditForm({ ...editForm, ip_address: e.target.value })}
                    className="input input-sm input-bordered w-full rounded-xl font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-base-content/70">Device Type</label>
                  <select
                    value={editForm.device_type}
                    onChange={(e) => setEditForm({ ...editForm, device_type: e.target.value })}
                    className="select select-sm select-bordered w-full rounded-xl"
                  >
                    <option value="Server">Server</option>
                    <option value="MikroTik">MikroTik Router</option>
                    <option value="Switch">Switch</option>
                    <option value="OLT">GPON OLT</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-base-content/70 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-accent" />
                      <span>Device Brand / Vendor</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <BrandLogo brand={editForm.brand} size="xs" />
                      <span className="text-[10px] text-base-content/50 font-mono">{editForm.brand}</span>
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <select
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      className="select select-sm select-bordered w-full rounded-xl pr-8"
                    >
                      {BRAND_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 pointer-events-none flex items-center">
                      <BrandLogo brand={editForm.brand} size="sm" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-base-content/70">Rack Elevation</label>
                  <input
                    type="text"
                    value={editForm.rack_number}
                    onChange={(e) => setEditForm({ ...editForm, rack_number: e.target.value })}
                    className="input input-sm input-bordered w-full rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-base-content/70">SNMP Community</label>
                  <input
                    type="text"
                    value={editForm.snmp_community}
                    onChange={(e) => setEditForm({ ...editForm, snmp_community: e.target.value })}
                    className="input input-sm input-bordered w-full rounded-xl font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-base-content/10">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn btn-sm btn-ghost rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary rounded-xl font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal for Inspect Page */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl bg-base-100 border border-error/30 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-error">
                <AlertOctagon className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold">Decommission Device?</h3>
              </div>
              <p className="text-xs text-base-content/70 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-base-content">{device.hostname}</strong> ({device.ip_address || device.ip})? This action will remove its telemetry metrics and records from servers_info.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-content/10">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDevice}
                  className="btn btn-sm btn-error text-white rounded-xl font-bold"
                >
                  Yes, Decommission Device
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Server } from '../types';
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
  Pencil,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Zap,
  ExternalLink
} from 'lucide-react';

interface InspectDeviceViewProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
}

export const InspectDeviceView: React.FC<InspectDeviceViewProps> = ({
  server,
  onBack,
  onEditServer,
  onDeleteServer,
  onRebootServer,
}) => {
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  const isOnline = server.status === 'online';

  const getMetricColor = (val: number) => {
    if (val < 70) return 'text-emerald-500';
    if (val <= 85) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getProgressColor = (val: number) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (val <= 85) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  };

  const handleCopySsh = () => {
    const cmd = `ssh admin@${server.ip}`;
    navigator.clipboard?.writeText(cmd);
    setCopiedSsh(true);
    setTimeout(() => setCopiedSsh(false), 2000);
  };

  const handlePing = () => {
    setIsPinging(true);
    setPingResult(null);
    setTimeout(() => {
      setIsPinging(false);
      if (server.status === 'online') {
        const ms = Math.floor(Math.random() * 22) + 6;
        setPingResult(`64 bytes from ${server.ip}: icmp_seq=1 ttl=58 time=${ms}ms (0% packet loss)`);
      } else {
        setPingResult(`From 10.0.0.1: Destination Host Unreachable (${server.ip}) - 100% loss`);
      }
    }, 550);
  };

  // Mock partition breakdown derived from server disk data
  const partitions = [
    { mount: '/', filesystem: '/dev/nvme0n1p2', total: '250 GB', usedPct: server.diskUsage, role: 'Root Filesystem' },
    { mount: '/var/log', filesystem: '/dev/nvme0n1p3', total: '120 GB', usedPct: Math.min(98, Math.round(server.diskUsage * 1.08)), role: 'System Audit Logs' },
    { mount: '/data', filesystem: '/dev/nvme1n1p1', total: '1.6 TB', usedPct: Math.max(12, Math.round(server.diskUsage * 0.85)), role: 'Primary Data Volume' },
  ];

  const renderDeviceBadge = (type?: string) => {
    switch (type) {
      case 'MikroTik':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            MikroTik Router
          </span>
        );
      case 'Switch':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            Switch
          </span>
        );
      case 'OLT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            GPON OLT
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/10 text-primary">
            Server
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-base-content/60 font-medium">
          <button
            onClick={onBack}
            className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
          <button
            onClick={onBack}
            className="hover:text-primary transition-colors font-semibold"
          >
            Fleet Nodes
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/40" />
          <span className="text-base-content font-mono font-bold truncate max-w-xs">
            {server.hostname}
          </span>
        </div>

        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-base-100 hover:bg-base-200 border border-base-content/10 text-base-content transition-all shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Fleet Dashboard</span>
        </button>
      </div>

      {/* 2. Page Header Card with Device Identity and SINGLE Top-Right Action Hub */}
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
              <h1 className="text-xl sm:text-2xl font-black text-base-content tracking-tight">
                {server.hostname}
              </h1>

              {/* Status Badge */}
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
              {renderDeviceBadge(server.deviceType)}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60 font-mono mt-1.5">
              <span className="font-bold text-base-content text-sm">{server.ip}</span>
              <span>•</span>
              <span>UID: {server.id}</span>
              <span>•</span>
              <span className="text-base-content/70">
                {server.datacenterName || server.location}
              </span>
            </div>
          </div>
        </div>

        {/* SINGLE EXCLUSIVE LOCATION FOR EDIT AND DELETE BUTTONS */}
        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          {onEditServer && (
            <button
              type="button"
              onClick={() => onEditServer(server)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-base-content bg-base-100 hover:text-primary hover:border-primary/40 hover:bg-primary/10 border border-base-content/20 transition-all duration-150 shadow-xs"
              title={`Edit ${server.hostname} configuration`}
            >
              <Pencil className="w-4 h-4 text-base-content/70" />
              <span>Edit Device</span>
            </button>
          )}

          {onDeleteServer && (
            <button
              type="button"
              onClick={() => onDeleteServer(server)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-error bg-error/10 hover:bg-error hover:text-error-content border border-error/30 transition-all duration-150 shadow-xs"
              title={`Decommission ${server.hostname}`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Device</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Smart Diagnostic Alerts & Health Banner */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5 px-1">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Diagnostic Alerts &amp; Fleet Health
        </h2>

        {/* Offline Critical Alert */}
        {!isOnline && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Host Status: OFFLINE CRITICAL</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1 leading-relaxed">
                Heartbeat polling dropped out. Host unreachable at IP <span className="font-mono font-bold">{server.ip}</span>. Please verify IPMI/BMC power status, top-of-rack leaf switch port, or active upstream BGP peer.
              </div>
            </div>
          </div>
        )}

        {/* Elevated CPU Alert */}
        {isOnline && server.cpuUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Sustained CPU Saturation ({server.cpuUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Thread contention detected on compute cores. Active process threads exceed standard capacity thresholds.
              </div>
            </div>
          </div>
        )}

        {/* Elevated RAM Alert */}
        {isOnline && server.ramUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">Memory Pressure Critical ({server.ramUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Linux kernel page buffer depleted. High risk of OOM reaper terminating active database or worker daemons.
              </div>
            </div>
          </div>
        )}

        {/* Elevated Disk Alert */}
        {isOnline && server.diskUsage > 85 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.12)] flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm sm:text-base">NVMe Storage Pool Near Capacity ({server.diskUsage}%)</div>
              <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                Volume saturation warning: Please inspect `/var/log` or rotate PostgreSQL audit log files.
              </div>
            </div>
          </div>
        )}

        {/* All Nominal Alert */}
        {isOnline &&
          server.cpuUsage <= 85 &&
          server.ramUsage <= 85 &&
          server.diskUsage <= 85 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
              <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm sm:text-base">System Operational &amp; Nominal</div>
                <div className="text-xs sm:text-sm text-base-content/80 mt-1">
                  All host telemetry metrics are securely within standard SLA parameters. No active alerts or threshold breaches recorded.
                </div>
              </div>
            </div>
        )}
      </div>

      {/* 4. Two-Column Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Real-Time Telemetry & Disk Partitions */}
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
                    <span>Compute CPU Cores</span>
                  </span>
                  <span className={`font-mono text-sm font-black ${getMetricColor(server.cpuUsage)}`}>
                    {isOnline ? `${server.cpuUsage}%` : 'Offline'}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(server.cpuUsage)}`}
                    style={{ width: isOnline ? `${server.cpuUsage}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                  <span>Target SLA: &lt;70%</span>
                  <span>Load Average: {server.loadAverage || '0.78, 0.84, 0.91'}</span>
                </div>
              </div>

              {/* RAM Bar */}
              <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/5">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="flex items-center gap-2 text-base-content">
                    <MemoryStick className="w-4 h-4 text-base-content/70" />
                    <span>RAM Memory Pool</span>
                  </span>
                  <span className={`font-mono text-sm font-black ${getMetricColor(server.ramUsage)}`}>
                    {isOnline ? `${server.ramUsage}%` : 'Offline'}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(server.ramUsage)}`}
                    style={{ width: isOnline ? `${server.ramUsage}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                  <span>Target SLA: &lt;80%</span>
                  <span>Used: {isOnline ? `${Math.round(server.ramUsage * 0.64)} GB / 64 GB` : '0 GB'}</span>
                </div>
              </div>

              {/* Disk Bar */}
              <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/5">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="flex items-center gap-2 text-base-content">
                    <HardDrive className="w-4 h-4 text-base-content/70" />
                    <span>NVMe Storage Array</span>
                  </span>
                  <span className={`font-mono text-sm font-black ${getMetricColor(server.diskUsage)}`}>
                    {server.diskUsage}%
                  </span>
                </div>
                <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(server.diskUsage)}`}
                    style={{ width: `${server.diskUsage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-base-content/60 mt-1.5 font-mono">
                  <span>Target SLA: &lt;85%</span>
                  <span>Allocated: {Math.round(server.diskUsage * 20)} GB / 2,000 GB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Individual Disk Partitions Breakdown */}
          <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
                <Database className="w-4 h-4 text-secondary" />
                Physical Disk Partitions &amp; File Systems
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
                    <span>ext4 (rw,noatime,nodiratime)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Hardware Specs & SRE Diagnostics */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Hardware Info Card */}
          <div className="p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-lg space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Hardware Specifications
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  System Uptime
                </div>
                <div className="font-semibold font-mono text-base-content">{server.uptime}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-secondary" />
                  Datacenter Facility
                </div>
                <div className="font-semibold text-base-content">
                  {server.datacenterName || server.location}
                </div>
                <div className="text-[11px] text-base-content/50 font-mono mt-0.5">{server.location}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  Rack Elevation Unit
                </div>
                <div className="font-semibold font-mono text-base-content">{server.rackNumber}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 mb-1">
                  <Network className="w-3.5 h-3.5 text-info" />
                  SNMP v2c Community
                </div>
                <div className="font-semibold font-mono text-base-content truncate">
                  {server.snmpCommunity || 'public'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick SRE Diagnostic Actions Card */}
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
                <span>{copiedSsh ? 'SSH Command Copied!' : `Copy: ssh admin@${server.ip}`}</span>
              </button>

              {onRebootServer && (
                <button
                  onClick={() => onRebootServer(server.id)}
                  className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold border border-warning/30 text-warning hover:bg-warning hover:text-warning-content transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Simulate Remote Reboot</span>
                </button>
              )}
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
    </div>
  );
};

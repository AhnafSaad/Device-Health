import React, { useState } from 'react';
import { Server } from '../types';
import { 
  X, 
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
  Network
} from 'lucide-react';

interface ServerDrawerProps {
  server: Server | null;
  isOpen: boolean;
  onClose: () => void;
  onRebootServer?: (serverId: string) => void;
}

export const ServerDrawer: React.FC<ServerDrawerProps> = ({
  server,
  isOpen,
  onClose,
  onRebootServer,
}) => {
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  if (!isOpen || !server) return null;

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
    }, 500);
  };

  // Mock partition breakdown derived from server disk data
  const partitions = [
    { mount: '/', filesystem: '/dev/nvme0n1p2', total: '250 GB', usedPct: server.diskUsage, role: 'Root Filesystem' },
    { mount: '/var/log', filesystem: '/dev/nvme0n1p3', total: '120 GB', usedPct: Math.min(98, Math.round(server.diskUsage * 1.08)), role: 'System Audit Logs' },
    { mount: '/data', filesystem: '/dev/nvme1n1p1', total: '1.6 TB', usedPct: Math.max(12, Math.round(server.diskUsage * 0.85)), role: 'PostgreSQL Datadir' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-xl bg-base-100 shadow-2xl flex flex-col border-l border-base-content/10 transition-transform duration-300">
          
          {/* Header */}
          <div className="p-5 border-b border-base-content/10 bg-base-100/90 backdrop-blur-md flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-xl border ${
                isOnline 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
              }`}>
                <ServerIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-base-content tracking-tight">
                    {server.hostname}
                  </h2>
                  {isOnline ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                      UP
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/25 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                      DOWN
                    </span>
                  )}
                </div>
                <div className="text-xs text-base-content/50 font-mono flex items-center gap-2 mt-0.5">
                  <span className="font-semibold text-base-content/80">{server.ip}</span>
                  <span>•</span>
                  <span>{server.id}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-base-content/50 hover:text-base-content hover:bg-base-200 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

            {/* Smart Problem Detection Alerts */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  Diagnostic Alerts &amp; Health
                </h3>
              </div>

              {/* Offline Critical Alert */}
              {!isOnline && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)] flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Node Status: OFFLINE</div>
                    <div className="text-xs opacity-90 mt-0.5 leading-relaxed text-base-content/80">
                      Heartbeat dropped out. Host unreachable at IP {server.ip}. Check IPMI power status or Top-of-Rack switch port.
                    </div>
                  </div>
                </div>
              )}

              {/* Elevated CPU Alert */}
              {isOnline && server.cpuUsage > 85 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Problem: CPU Usage Critical ({server.cpuUsage}%)</div>
                    <div className="text-xs opacity-90 mt-0.5 text-base-content/80">
                      Thread contention detected. Sustained utilization exceeds standard threshold.
                    </div>
                  </div>
                </div>
              )}

              {/* Elevated RAM Alert */}
              {isOnline && server.ramUsage > 85 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Problem: Memory Pressure Critical ({server.ramUsage}%)</div>
                    <div className="text-xs opacity-90 mt-0.5 text-base-content/80">
                      System buffer exhausted. High likelihood of Linux OOM reaper triggering.
                    </div>
                  </div>
                </div>
              )}

              {/* Elevated Disk Alert */}
              {isOnline && server.diskUsage > 85 && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)] flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Problem: Disk Partition Near Capacity ({server.diskUsage}%)</div>
                    <div className="text-xs opacity-90 mt-0.5 text-base-content/80">
                      Volume saturation warning: Please inspect `/var/log` or rotate archive tables.
                    </div>
                  </div>
                </div>
              )}

              {/* All Nominal Alert */}
              {isOnline &&
                server.cpuUsage <= 85 &&
                server.ramUsage <= 85 &&
                server.diskUsage <= 85 && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">System Healthy &amp; Nominal</div>
                      <div className="text-xs opacity-90 mt-0.5 text-base-content/80">
                        All host telemetry metrics are safely within operating SLA thresholds.
                      </div>
                    </div>
                  </div>
              )}
            </div>

            {/* Real-Time Telemetry Gauges */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                  Resource Utilization
                </h3>
                <span className="text-[10px] font-mono text-base-content/40">
                  &lt;70% OK • 70-85% WARN • &gt;85% CRIT
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-base-200/40 border border-base-content/10 space-y-4">
                {/* CPU Bar */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="flex items-center gap-1.5 text-base-content">
                      <Cpu className="w-3.5 h-3.5 text-base-content/60" />
                      Compute CPU
                    </span>
                    <span className={`font-mono font-bold ${getMetricColor(server.cpuUsage)}`}>
                      {isOnline ? `${server.cpuUsage}%` : 'Offline'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(server.cpuUsage)}`}
                      style={{ width: isOnline ? `${server.cpuUsage}%` : '0%' }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-base-content/50 mt-1 font-mono">
                    <span>Target: &lt;70%</span>
                    <span>Load: {server.loadAverage || '0.78, 0.84, 0.91'}</span>
                  </div>
                </div>

                {/* RAM Bar */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="flex items-center gap-1.5 text-base-content">
                      <MemoryStick className="w-3.5 h-3.5 text-base-content/60" />
                      RAM Memory
                    </span>
                    <span className={`font-mono font-bold ${getMetricColor(server.ramUsage)}`}>
                      {isOnline ? `${server.ramUsage}%` : 'Offline'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(server.ramUsage)}`}
                      style={{ width: isOnline ? `${server.ramUsage}%` : '0%' }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-base-content/50 mt-1 font-mono">
                    <span>Target: &lt;80%</span>
                    <span>Used: {isOnline ? `${Math.round(server.ramUsage * 0.64)} GB / 64 GB` : '0 GB'}</span>
                  </div>
                </div>

                {/* Disk Bar */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="flex items-center gap-1.5 text-base-content">
                      <HardDrive className="w-3.5 h-3.5 text-base-content/60" />
                      NVMe Storage Pool
                    </span>
                    <span className={`font-mono font-bold ${getMetricColor(server.diskUsage)}`}>
                      {server.diskUsage}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(server.diskUsage)}`}
                      style={{ width: `${server.diskUsage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-base-content/50 mt-1 font-mono">
                    <span>Target: &lt;85%</span>
                    <span>Allocated: {Math.round(server.diskUsage * 20)} GB / 2,000 GB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Disk Partitions Breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-secondary" />
                Individual Disk Partitions
              </h3>

              <div className="rounded-2xl border border-base-content/10 bg-base-200/30 overflow-hidden divide-y divide-base-content/10">
                {partitions.map((part) => (
                  <div key={part.mount} className="p-3.5 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="font-mono font-bold text-base-content">{part.mount}</span>
                        <span className="text-base-content/50 text-[11px] ml-2">({part.role})</span>
                      </div>
                      <div className="font-mono text-xs">
                        <span className={`font-bold ${getMetricColor(part.usedPct)}`}>{part.usedPct}%</span>
                        <span className="text-base-content/50 ml-1">/ {part.total}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getProgressColor(part.usedPct)}`}
                        style={{ width: `${part.usedPct}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-base-content/40 mt-1 flex justify-between">
                      <span>{part.filesystem}</span>
                      <span>ext4 (rw,noatime)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hardware Info Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-primary" />
                Hardware Specifications &amp; Provisioning
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-primary" />
                    Uptime
                  </div>
                  <div className="font-semibold text-base-content">{server.uptime}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3 text-secondary" />
                    Datacenter
                  </div>
                  <div className="font-semibold text-base-content truncate">{server.location}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1 mb-1">
                    <Layers className="w-3 h-3 text-accent" />
                    Rack Unit
                  </div>
                  <div className="font-semibold font-mono text-base-content">{server.rackNumber}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-base-200/40 border border-base-content/10">
                  <div className="text-[11px] text-base-content/50 flex items-center gap-1 mb-1">
                    <Network className="w-3 h-3 text-info" />
                    SNMP Community
                  </div>
                  <div className="font-semibold font-mono text-base-content truncate">
                    {server.snmpCommunity || 'noc_secure_v2'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick SRE Diagnostic Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" />
                Immediate SRE Diagnostics
              </h3>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePing}
                  disabled={isPinging}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-primary/30 text-primary hover:bg-primary hover:text-primary-content transition-all flex items-center gap-1.5"
                >
                  <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                  {isPinging ? 'Pinging Node...' : 'ICMP Ping'}
                </button>

                <button
                  onClick={handleCopySsh}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-base-content/20 text-base-content hover:bg-base-200 transition-all flex items-center gap-1.5"
                >
                  {copiedSsh ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSsh ? 'Copied SSH!' : 'Copy SSH Command'}
                </button>

                {onRebootServer && (
                  <button
                    onClick={() => onRebootServer(server.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-warning/30 text-warning hover:bg-warning hover:text-warning-content transition-all flex items-center gap-1.5 ml-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Simulate Reboot
                  </button>
                )}
              </div>

              {pingResult && (
                <div className="p-3 rounded-xl bg-base-300/80 border border-base-content/10 font-mono text-xs text-base-content/90 animate-fadeIn">
                  {pingResult}
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 sm:px-6 border-t border-base-content/10 bg-base-100/90 flex items-center justify-between">
            <span className="text-xs text-base-content/40 font-mono">
              UID: {server.id}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-content hover:opacity-90 shadow-md shadow-primary/20 transition-all"
            >
              Close Drawer
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

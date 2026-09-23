'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { 
  Server as ServerIcon, 
  RefreshCw, 
  PlusCircle, 
  LayoutDashboard, 
  Search, 
  ChevronRight, 
  HardDrive, 
  Cpu, 
  MemoryStick,
  MapPin, 
  AlertTriangle, 
  AlertOctagon,
  CheckCircle2, 
  Layers, 
  X,
  Database,
  Radio,
  Clock,
  Terminal,
  Copy,
  Check,
  SlidersHorizontal,
  RotateCcw,
  ShieldCheck,
  ArrowUpRight,
  Command,
  Activity
} from 'lucide-react';

const telemetryFetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Telemetry HTTP error ${res.status}`);
  }
  return res.json();
};

const LOCATIONS = [
  { loc: 'Frankfurt DC-1', racks: ['Rack B-12 (U22)', 'Rack B-14 (U10)', 'Rack C-01 (U34)'] },
  { loc: 'Amsterdam Teleport', racks: ['Rack A-04 (U10)', 'Rack A-08 (U20)'] },
  { loc: 'London Slough LD4', racks: ['Rack F-09 (U14)', 'Rack F-12 (U28)'] },
  { loc: 'New York NY9 (Equinix)', racks: ['Rack R-22 (U42)', 'Rack R-18 (U08)'] },
  { loc: 'Singapore SG1', racks: ['Rack S-05 (U18)', 'Rack S-11 (U30)'] },
  { loc: 'Tokyo TY2', racks: ['Rack T-02 (U16)', 'Rack T-07 (U24)'] },
];

const ROLES = [
  'edge-gw', 'core-router', 'pg-cluster-db', 'kafka-broker', 'border-bgp-transit',
  'k8s-ingress', 'redis-cache', 'api-gateway', 'auth-service', 'worker-pool',
  'telemetry-collector', 'dns-recursor'
];

const INITIAL_SERVERS = Array.from({ length: 60 }, (_, i) => {
  const index = i + 1;
  const deviceType = index % 4 === 0 ? 'OLT' : index % 3 === 0 ? 'Switch' : index % 2 === 0 ? 'MikroTik' : 'Server';
  const isOffline = index === 5 || index === 19 || index === 33 || index === 48;
  const isHighCpu = !isOffline && (index % 6 === 0);
  const isCritical = !isOffline && (index % 11 === 0);

  const locObj = LOCATIONS[index % LOCATIONS.length];
  const rack = locObj.racks[index % locObj.racks.length];
  const role = ROLES[index % ROLES.length];

  const cpu = isOffline ? 0 : isHighCpu ? 86 + (index % 12) : isCritical ? 92 + (index % 7) : 18 + (index % 48);
  const ram = isOffline ? 0 : isCritical ? 88 + (index % 10) : 32 + (index % 52);
  const disk = isOffline ? 0 : isCritical ? 85 + (index % 12) : 22 + (index % 60);

  const prefix = deviceType === 'Server' ? '10.0' : deviceType === 'MikroTik' ? '192.168' : deviceType === 'Switch' ? '172.16' : '10.200';
  const ip = `${prefix}.${(index * 3) % 250 + 1}.${(index * 7) % 250 + 2}`;

  return {
    id: `dev-${1000 + index}`,
    ip,
    hostname: `${deviceType.toLowerCase()}-${role}-${index.toString().padStart(2, '0')}`,
    status: isOffline ? 'offline' : 'online',
    health: isOffline ? 'Critical' : isCritical ? 'Critical' : isHighCpu ? 'Warning' : 'Normal',
    cpuUsage: cpu,
    ramUsage: ram,
    diskUsage: disk,
    uptime: isOffline ? 'Unreachable (Host Down)' : `${(index * 17) % 360 + 5}d ${(index * 3) % 24}h`,
    location: locObj.loc,
    rackNumber: rack,
    deviceType,
    loadAverage: isOffline ? 'N/A' : `${(cpu / 50).toFixed(2)}, ${((cpu - 4) / 50).toFixed(2)}, ${((cpu - 8) / 50).toFixed(2)}`,
  };
});

export default function FleetDashboardPage() {
  const [servers, setServers] = useState(INITIAL_SERVERS);
  const [selectedServer, setSelectedServer] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Diagnostic drawer state
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // SWR Live Telemetry Polling (every 10s from /api/telemetry)
  const { 
    data: telemetryData, 
    error: telemetryError, 
    isValidating: isTelemetryValidating, 
    mutate: revalidateTelemetry 
  } = useSWR(
    '/api/telemetry',
    telemetryFetcher,
    {
      refreshInterval: isAutoRefresh ? 10000 : 0,
      revalidateOnFocus: true,
      dedupingInterval: 4000,
    }
  );

  // Synchronize incoming live telemetry from PostgreSQL / Telegraf into table state
  useEffect(() => {
    if (telemetryData && Array.isArray(telemetryData.telemetry) && telemetryData.telemetry.length > 0) {
      const liveList = telemetryData.telemetry;

      setServers((prev) => {
        // Update existing nodes with live metrics
        const updated = prev.map((srv) => {
          const matched = liveList.find(
            (t) => (t.ip_address || t.ip) === (srv.ip || srv.ip_address)
          );
          if (!matched) return srv;

          return {
            ...srv,
            hostname: matched.hostname || srv.hostname,
            deviceType: matched.device_type || matched.deviceType || srv.deviceType,
            location: matched.location || srv.location,
            rackNumber: matched.rack_number || matched.rackNumber || srv.rackNumber,
            cpuUsage: Number(matched.cpu_usage ?? matched.cpuUsage ?? srv.cpuUsage),
            ramUsage: Number(matched.ram_usage ?? matched.ramUsage ?? srv.ramUsage),
            diskUsage: Number(matched.disk_usage ?? matched.diskUsage ?? srv.diskUsage),
            uptime: matched.uptime || srv.uptime,
            status: matched.status || srv.status,
            health: matched.health || srv.health,
            loadAverage: matched.load_average || srv.loadAverage,
          };
        });

        // Prepend any newly added devices from PostgreSQL
        const existingIps = new Set(prev.map((p) => p.ip || p.ip_address));
        const newNodes = liveList
          .filter((t) => !existingIps.has(t.ip_address || t.ip))
          .map((item) => ({
            id: item.id ? String(item.id) : `dev-${Math.floor(Math.random() * 9000) + 1000}`,
            ip: item.ip_address || item.ip,
            hostname: item.hostname || `node-${item.ip_address}`,
            deviceType: item.device_type || item.deviceType || 'Server',
            location: item.location || 'Local Datacenter',
            rackNumber: item.rack_number || item.rackNumber || 'Unassigned',
            cpuUsage: Number(item.cpu_usage ?? 15),
            ramUsage: Number(item.ram_usage ?? 32),
            diskUsage: Number(item.disk_usage ?? 25),
            uptime: item.uptime || '0d 1h',
            status: item.status || 'online',
            health: item.health || 'Normal',
            loadAverage: item.load_average || '0.15, 0.12, 0.08',
          }));

        return [...newNodes, ...updated];
      });
    }
  }, [telemetryData]);

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      if (statusFilter !== 'all' && server.status !== statusFilter) return false;
      if (deviceFilter !== 'all' && (server.deviceType || '').toLowerCase() !== deviceFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesIp = server.ip.toLowerCase().includes(query);
        const matchesHost = server.hostname.toLowerCase().includes(query);
        const matchesLoc = server.location?.toLowerCase().includes(query);
        const matchesRack = server.rackNumber?.toLowerCase().includes(query);
        const matchesType = server.deviceType?.toLowerCase().includes(query);
        if (!matchesIp && !matchesHost && !matchesLoc && !matchesRack && !matchesType) return false;
      }
      return true;
    });
  }, [servers, statusFilter, deviceFilter, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredServers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedServers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredServers.slice(start, start + pageSize);
  }, [filteredServers, safeCurrentPage, pageSize]);

  // Overall metrics
  const onlineCount = useMemo(() => servers.filter((s) => s.status === 'online').length, [servers]);
  const offlineCount = useMemo(() => servers.filter((s) => s.status === 'offline').length, [servers]);
  const onlinePercent = Math.round((onlineCount / (servers.length || 1)) * 100);

  const handleSelectServer = (server) => {
    setSelectedServer(server);
    setIsDrawerOpen(true);
    setPingResult(null);
  };

  const handlePing = () => {
    if (!selectedServer) return;
    setIsPinging(true);
    setPingResult(null);
    setTimeout(() => {
      setIsPinging(false);
      if (selectedServer.status === 'online') {
        const ms = Math.floor(Math.random() * 20) + 8;
        setPingResult(`64 bytes from ${selectedServer.ip}: icmp_seq=1 ttl=58 time=${ms}ms (0% loss)`);
      } else {
        setPingResult(`Destination Host Unreachable (${selectedServer.ip}) - 100% loss`);
      }
    }, 500);
  };

  const handleCopySsh = () => {
    if (!selectedServer) return;
    navigator.clipboard?.writeText(`ssh admin@${selectedServer.ip}`);
    setCopiedSsh(true);
    setTimeout(() => setCopiedSsh(false), 2000);
  };

  const getResourceBarColor = (val) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
    if (val <= 85) return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]';
  };

  const getMetricColor = (val) => {
    if (val < 70) return 'text-emerald-500';
    if (val <= 85) return 'text-amber-500';
    return 'text-rose-500';
  };

  const renderDeviceBadge = (type) => {
    const raw = (type || 'Server').toLowerCase();
    if (raw === 'mikrotik') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0">
          MikroTik
        </span>
      );
    }
    if (raw === 'switch') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shrink-0">
          Switch
        </span>
      );
    }
    if (raw === 'olt') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
          OLT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shrink-0">
        Server
      </span>
    );
  };

  const hasAnyFilterActive = statusFilter !== 'all' || deviceFilter !== 'all' || !!searchQuery;

  const handleResetAllFilters = () => {
    setStatusFilter('all');
    setDeviceFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-base-200/40 text-base-content flex flex-col font-sans">
      
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-base-content/10 bg-base-100/80 backdrop-blur-md shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-primary-content shadow-lg shadow-primary/20">
              <ServerIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight">NOC Fleet Monitor</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                  PROD-CLUSTER
                </span>
              </div>
              <p className="text-xs text-base-content/50 hidden sm:block">
                Distributed SNMP &amp; ICMP Health Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live Telemetry Status & Manual Polling Trigger */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-base-200/60 border border-base-content/10 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                {isAutoRefresh ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                )}
              </span>
              <span className="text-base-content/70 text-[11px]">
                {isAutoRefresh ? 'SWR Polling (10s)' : 'Polling Paused'}
              </span>
              {telemetryData?.source && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                  {telemetryData.source === 'postgresql' ? 'pg:noc_db' : 'telegraf'}
                </span>
              )}
            </div>

            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              title={isAutoRefresh ? 'Pause 10s telemetry polling' : 'Resume 10s telemetry polling'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isAutoRefresh 
                  ? 'bg-success/10 border-success/30 text-success' 
                  : 'bg-base-200 border-base-content/10 text-base-content/60'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTelemetryValidating ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">{isAutoRefresh ? 'Auto (10s)' : 'Paused'}</span>
            </button>

            <button
              onClick={() => revalidateTelemetry()}
              title="Poll telemetry now"
              className="p-1.5 rounded-xl text-xs font-semibold border border-base-content/15 bg-base-100 hover:bg-base-200 text-base-content/70 hover:text-base-content transition-all"
            >
              <Activity className="w-4 h-4 text-primary" />
            </button>

            <Link
              href="/admin/add-device"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-content shadow-md shadow-primary/25 hover:shadow-lg transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Device</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content: Desktop Flex/Grid with Fixed Sidebar & Internal Scroll Table */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-4 sm:pb-6 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch lg:h-[calc(100vh-7.5rem)] min-w-0">
          
          {/* Left Sidebar / Column: Compact Stats Cards Stacked Vertically + Quick Filters */}
          <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:h-full lg:overflow-y-auto pr-1 pt-1 pb-1 space-y-2.5">
            
            {/* 3 Summary / Stats Cards Stacked Vertically (Compact & Slim) */}
            <div className="flex flex-col gap-2">
              
              {/* Total Fleet Capacity Card */}
              <div
                onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                className={`group relative overflow-hidden rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                  statusFilter === 'all'
                    ? 'bg-gradient-to-b from-primary/[0.08] to-base-100 border-primary shadow-md shadow-primary/10 ring-1 ring-primary/40 -translate-y-0.5'
                    : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-primary/40 hover:shadow-xs hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${statusFilter === 'all' ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/70'}`}>
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 truncate">Fleet Capacity</div>
                      <div className="text-xs font-bold text-base-content truncate">Total (10k+)</div>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full border shrink-0 transition-colors ${
                    statusFilter === 'all' ? 'bg-primary/15 border-primary/30 text-primary font-bold' : 'bg-base-200/80 border-base-content/10 text-base-content/60'
                  }`}>
                    {statusFilter === 'all' ? 'Active' : 'All'}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-xl font-black font-mono tracking-tight text-base-content">10,482</div>
                    <p className="text-[10px] text-base-content/50 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">{servers.length} telemetry nodes</span>
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-primary flex items-center gap-0.5 shrink-0">
                    <span>Inspect</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>

                <div className="mt-2 h-1 w-full bg-base-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-full opacity-80" />
                </div>
              </div>

              {/* Online SLA Card */}
              <div
                onClick={() => { setStatusFilter('online'); setCurrentPage(1); }}
                className={`group relative overflow-hidden rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                  statusFilter === 'online'
                    ? 'bg-gradient-to-b from-success/[0.08] to-base-100 border-success shadow-md shadow-success/15 ring-1 ring-success/40 -translate-y-0.5'
                    : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-success/40 hover:shadow-xs hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${statusFilter === 'online' ? 'bg-success text-success-content' : 'bg-base-200 text-base-content/70'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 truncate">Operational SLA</div>
                      <div className="text-xs font-bold text-success flex items-center gap-1 truncate">
                        <span>Online Nodes</span>
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full border shrink-0 transition-colors ${
                    statusFilter === 'online' ? 'bg-success/15 border-success/30 text-success font-bold' : 'bg-base-200/80 border-base-content/10 text-base-content/60'
                  }`}>
                    {onlinePercent}% Nominal
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-xl font-black font-mono tracking-tight text-success">{onlineCount}</div>
                    <p className="text-[10px] text-base-content/50 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                      <span className="truncate">Active ICMP heartbeats</span>
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-success flex items-center gap-0.5 shrink-0">
                    <span>Filter UP</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>

                <div className="mt-2 h-1 w-full bg-base-200 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full shadow-[0_0_6px_rgba(34,197,94,0.6)]" style={{ width: `${onlinePercent}%` }} />
                </div>
              </div>

              {/* Offline Incidents Card */}
              <div
                onClick={() => { setStatusFilter('offline'); setCurrentPage(1); }}
                className={`group relative overflow-hidden rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                  statusFilter === 'offline'
                    ? 'bg-gradient-to-b from-error/[0.08] to-base-100 border-error shadow-md shadow-error/15 ring-1 ring-error/40 -translate-y-0.5'
                    : 'bg-base-100/90 hover:bg-base-100 border-base-content/10 hover:border-error/40 hover:shadow-xs hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${statusFilter === 'offline' ? 'bg-error text-error-content' : 'bg-base-200 text-base-content/70'}`}>
                      <AlertOctagon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 truncate">Incident Response</div>
                      <div className="text-xs font-bold text-error flex items-center gap-1 truncate">
                        <span>Offline Outages</span>
                        {offlineCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse shrink-0" />}
                      </div>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full border shrink-0 transition-colors ${
                    statusFilter === 'offline' ? 'bg-error/15 border-error/30 text-error font-bold' : 'bg-base-200/80 border-base-content/10 text-base-content/60'
                  }`}>
                    {offlineCount} Out
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-xl font-black font-mono tracking-tight text-error">{offlineCount}</div>
                    <p className="text-[10px] text-base-content/50 mt-0.5 flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${offlineCount > 0 ? 'bg-error' : 'bg-base-content/30'}`} />
                      <span className="truncate">SRE triage needed</span>
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-error flex items-center gap-0.5 shrink-0">
                    <span>Filter DOWN</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>

                <div className="mt-2 h-1 w-full bg-base-200 rounded-full overflow-hidden">
                  <div className="h-full bg-error rounded-full shadow-[0_0_6px_rgba(239,68,68,0.6)]" style={{ width: `${Math.max(offlineCount > 0 ? 15 : 0, Math.round((offlineCount / (servers.length || 1)) * 100))}%` }} />
                </div>
              </div>

            </div>

            {/* Quick Filters Panel (Compact) */}
            <div className="rounded-xl border border-base-content/10 bg-base-100/90 shadow-xs p-3 space-y-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-base-content/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/80">Quick Filters</span>
                </div>
                {hasAnyFilterActive && (
                  <button
                    onClick={handleResetAllFilters}
                    className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-base-content/60">Node Status</label>
                <div className="grid grid-cols-3 gap-1 bg-base-200/60 p-0.5 rounded-lg border border-base-content/10">
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                    className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      statusFilter === 'all' ? 'bg-base-100 text-primary shadow-xs font-bold' : 'text-base-content/60 hover:text-base-content'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('online'); setCurrentPage(1); }}
                    className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${
                      statusFilter === 'online' ? 'bg-success/15 text-success shadow-xs font-bold' : 'text-base-content/60 hover:text-success'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                    <span>UP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('offline'); setCurrentPage(1); }}
                    className={`px-1.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${
                      statusFilter === 'offline' ? 'bg-error/15 text-error shadow-xs font-bold' : 'text-base-content/60 hover:text-error'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                    <span>DOWN</span>
                  </button>
                </div>
              </div>

              {/* Device Type Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-base-content/60">Device Type</label>
                <div className="flex flex-wrap gap-1 bg-base-200/60 p-1 rounded-lg border border-base-content/10">
                  {['all', 'Server', 'MikroTik', 'Switch', 'OLT'].map((dtype) => {
                    const isSelected = (deviceFilter || 'all').toLowerCase() === dtype.toLowerCase();
                    return (
                      <button
                        key={dtype}
                        type="button"
                        onClick={() => { setDeviceFilter(dtype); setCurrentPage(1); }}
                        className={`flex-1 min-w-[42px] px-1.5 py-1 text-[10px] font-semibold rounded-md text-center transition-all ${
                          isSelected ? 'bg-base-100 text-primary shadow-xs font-bold' : 'text-base-content/60 hover:text-base-content hover:bg-base-100/50'
                        }`}
                      >
                        {dtype === 'all' ? 'All' : dtype}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SLA Guarantee Widget */}
              <div className="pt-2 border-t border-base-content/10 flex items-center justify-between text-[10px] text-base-content/60 font-mono">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-success" />
                  <span>Tier-3 SLA Guarantee</span>
                </span>
                <span className="font-bold text-success">{onlinePercent}%</span>
              </div>
            </div>

          </aside>

          {/* Main Right Content Area: Prominently displays Search Bar at Top, Data Table with Internal Scroll, Pagination */}
          <section className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden">
            <div className="rounded-2xl border border-base-content/10 bg-base-100/95 shadow-xl overflow-hidden backdrop-blur-md flex flex-col h-full min-h-[460px] lg:max-h-[calc(100vh-6rem)]">
          
              {/* Prominent Search Bar & Telemetry Controls Header (Pinned at Top) */}
              <div className="shrink-0 p-3.5 sm:p-4 border-b border-base-content/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-base-100/80">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-primary" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Search 10,482 nodes by IP address (e.g. 10.0.12), hostname, location, rack..."
                    className="w-full pl-10 pr-24 py-2 text-xs sm:text-sm rounded-xl border border-base-content/15 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/25 text-base-content placeholder:text-base-content/40 outline-none transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1.5">
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="p-1 rounded-md text-base-content/40 hover:text-base-content"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-base-content/40 bg-base-200 border border-base-content/10 rounded">
                      <Command className="w-2.5 h-2.5" /> K
                    </kbd>
                  </div>
                </div>

                <div className="text-xs text-base-content/70 font-mono flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-base-200 border border-base-content/10">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span>Telemetry:</span>
                    <b className="text-base-content">{paginatedServers.length}</b>
                    <span className="text-base-content/40">/</span>
                    <b className="text-primary">{filteredServers.length}</b>
                    <span className="text-base-content/50">nodes</span>
                  </span>
                </div>
              </div>

              {/* Modern High-Density Table with Internal Scrollbar */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead className="sticky top-0 z-10 bg-base-200/95 backdrop-blur-md shadow-xs">
                    <tr className="border-b border-base-content/10 text-[11px] font-bold uppercase tracking-wider text-base-content/60 select-none">
                      <th className="py-2.5 px-3.5">Node &amp; Identity</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                      <th className="py-2.5 px-3.5">Health Telemetry</th>
                      <th className="py-2.5 px-3.5 hidden md:table-cell">Core Resources</th>
                      <th className="py-2.5 px-3.5 hidden lg:table-cell">Location &amp; Rack</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-content/5">
                    {paginatedServers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-16 px-4">
                          <div className="max-w-xs mx-auto flex flex-col items-center justify-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning shadow-md shadow-warning/5">
                              <AlertTriangle className="w-6 h-6" />
                            </div>
                            <p className="font-bold text-base-content text-sm">No devices match criteria</p>
                            <p className="text-xs text-base-content/60 text-center">
                              Try adjusting or clearing your search query to inspect other nodes in the fleet.
                            </p>
                            {hasAnyFilterActive && (
                              <button
                                onClick={handleResetAllFilters}
                                className="btn btn-sm btn-primary rounded-xl mt-1 text-xs"
                              >
                                Reset All Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedServers.map((server) => {
                        const isOnline = server.status === 'online';
                        return (
                          <tr
                            key={server.id}
                            onClick={() => handleSelectServer(server)}
                            className="group cursor-pointer hover:bg-base-200/60 transition-colors"
                          >
                            {/* 1. Node & Identity: IP, Hostname, and sleek Device Type Badge */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2 shrink-0">
                                  {isOnline ? (
                                    <>
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                                    </>
                                  ) : (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                                  )}
                                </span>
                                <span className="font-mono text-xs font-bold text-base-content group-hover:text-primary transition-colors tracking-tight">
                                  {server.ip}
                                </span>
                                {renderDeviceBadge(server.deviceType)}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-base-content/70">
                                <span className="font-semibold truncate max-w-[180px] group-hover:text-primary transition-colors">
                                  {server.hostname}
                                </span>
                                <span className="text-[10px] text-base-content/40 font-mono">
                                  • {server.id}
                                </span>
                              </div>
                            </td>

                            {/* 2. Status: Glowing UP/DOWN badge */}
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border transition-all ${
                                  isOnline
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                    : 'bg-rose-500/10 text-rose-500 border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.2)] animate-pulse'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span>{isOnline ? 'UP' : 'DOWN'}</span>
                              </span>
                            </td>

                            {/* 3. Health Telemetry: Normal / Warning / Critical */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <div>
                                {server.health === 'Normal' && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                    Normal
                                  </span>
                                )}
                                {(server.health === 'Warning' || server.health === 'High CPU') && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
                                    Warning
                                  </span>
                                )}
                                {server.health === 'Critical' && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                                    Critical
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-base-content/40 font-mono mt-0.5">
                                {isOnline ? `Up: ${server.uptime}` : 'Host Unreachable'}
                              </div>
                            </td>

                            {/* 4. Core Resources: CPU Usage (%) and RAM Usage (%) only (Disk removed) */}
                            <td className="py-2.5 px-3.5 hidden md:table-cell whitespace-nowrap">
                              {isOnline ? (
                                <div className="space-y-1.5 w-36 sm:w-44">
                                  {/* CPU Meter */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] font-mono leading-none mb-0.5">
                                      <span className="text-base-content/50">CPU</span>
                                      <span className={`font-bold ${getMetricColor(server.cpuUsage)}`}>
                                        {server.cpuUsage}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${getResourceBarColor(server.cpuUsage)}`}
                                        style={{ width: `${server.cpuUsage}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* RAM Meter */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] font-mono leading-none mb-0.5">
                                      <span className="text-base-content/50">RAM</span>
                                      <span className={`font-bold ${getMetricColor(server.ramUsage)}`}>
                                        {server.ramUsage}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${getResourceBarColor(server.ramUsage)}`}
                                        style={{ width: `${server.ramUsage}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-rose-500 font-mono">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Telemetry Unreachable</span>
                                </div>
                              )}
                            </td>

                            {/* 5. Location & Rack */}
                            <td className="py-2.5 px-3.5 hidden lg:table-cell text-xs text-base-content/70 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
                                <span className="truncate max-w-[130px] font-medium">{server.location}</span>
                              </div>
                              <div className="text-[10px] font-mono text-base-content/50 ml-5">
                                {server.rackNumber}
                              </div>
                            </td>

                            {/* 6. Action: Inspect button */}
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectServer(server);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/5 hover:bg-primary hover:text-primary-content transition-all shadow-xs group/btn"
                                aria-label={`Inspect ${server.hostname}`}
                              >
                                <span>Inspect</span>
                                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer Slot (Pinned at Bottom) */}
              <div className="shrink-0 p-3 sm:px-5 border-t border-base-content/10 bg-base-100/95 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-base-content/70">
                <div className="flex items-center gap-2 font-mono">
                  <span>Showing <b className="text-base-content">{filteredServers.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}</b>–<b className="text-base-content">{Math.min(safeCurrentPage * pageSize, filteredServers.length)}</b> of <b className="text-primary">{filteredServers.length}</b> nodes</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Page size selector */}
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-base-content/50">Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded-lg border border-base-content/15 bg-base-200/60 text-xs font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value={5}>5 / page</option>
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>

                  {/* Pagination Buttons */}
                  <div className="flex items-center gap-1 bg-base-200/50 p-1 rounded-xl border border-base-content/10">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-30"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-bold ${safeCurrentPage === p ? 'bg-primary text-primary-content shadow-xs' : 'hover:bg-base-100'}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage >= totalPages}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </section>

        </div>
      </main>

      {/* Slide-over Inspection Drawer */}
      {isDrawerOpen && selectedServer && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
            <div className="w-screen max-w-xl bg-base-100 shadow-2xl flex flex-col border-l border-base-content/10">
              
              <div className="p-5 border-b border-base-content/10 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-xl border ${selectedServer.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                    <ServerIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">{selectedServer.hostname}</h2>
                    <div className="text-xs text-base-content/50 font-mono">{selectedServer.ip} • {selectedServer.id}</div>
                  </div>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-xl text-base-content/50 hover:bg-base-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* Diagnostics Alert */}
                {selectedServer.status === 'offline' ? (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-3">
                    <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">Node Status: OFFLINE</div>
                      <div className="text-xs opacity-80 mt-0.5">Host unreachable at {selectedServer.ip}. No response to ICMP probe.</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">System Healthy &amp; Nominal</div>
                      <div className="text-xs opacity-80 mt-0.5">Metrics safely within SLA parameters.</div>
                    </div>
                  </div>
                )}

                {/* Resource Bars */}
                <div className="p-4 rounded-2xl bg-base-200/40 border border-base-content/10 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Compute CPU</span>
                      <span className={getMetricColor(selectedServer.cpuUsage)}>{selectedServer.cpuUsage}%</span>
                    </div>
                    <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                      <div className={`h-full ${getResourceBarColor(selectedServer.cpuUsage)}`} style={{ width: `${selectedServer.cpuUsage}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>RAM Memory</span>
                      <span className={getMetricColor(selectedServer.ramUsage)}>{selectedServer.ramUsage}%</span>
                    </div>
                    <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                      <div className={`h-full ${getResourceBarColor(selectedServer.ramUsage)}`} style={{ width: `${selectedServer.ramUsage}%` }} />
                    </div>
                  </div>
                </div>

                {/* Partitions */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60">Disk Partitions</h3>
                  <div className="rounded-2xl border border-base-content/10 bg-base-200/30 divide-y divide-base-content/10">
                    <div className="p-3 text-xs">
                      <div className="flex justify-between font-mono"><span>/ (root)</span><span>{selectedServer.diskUsage}% used</span></div>
                      <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden mt-1">
                        <div className={`h-full ${getResourceBarColor(selectedServer.diskUsage)}`} style={{ width: `${selectedServer.diskUsage}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SRE Actions */}
                <div className="flex gap-2">
                  <button onClick={handlePing} disabled={isPinging} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-primary/30 text-primary hover:bg-primary hover:text-primary-content">
                    {isPinging ? 'Pinging...' : 'ICMP Ping'}
                  </button>
                  <button onClick={handleCopySsh} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-base-content/20 hover:bg-base-200">
                    {copiedSsh ? 'Copied SSH' : 'Copy SSH Command'}
                  </button>
                </div>
                {pingResult && <div className="p-3 rounded-xl bg-base-300 font-mono text-xs">{pingResult}</div>}
              </div>

              <div className="p-4 border-t border-base-content/10 flex justify-end">
                <button onClick={() => setIsDrawerOpen(false)} className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-content">
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

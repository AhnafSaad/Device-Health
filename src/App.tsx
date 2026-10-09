import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Server, StatusFilter, Datacenter } from './types';
import { INITIAL_SERVERS, INITIAL_DATACENTERS } from './data/mockServers';
import { TopBar } from './components/TopBar';
import { FilterCards } from './components/FilterCards';
import { ServerTable } from './components/ServerTable';
import { Pagination } from './components/Pagination';
import { AddServerView } from './components/AddServerView';
import { DatacenterModal } from './components/DatacenterModal';
import { DatacenterPageView } from './components/DatacenterPageView';
import { EditDeviceModal } from './components/EditDeviceModal';
import { DeleteDeviceModal } from './components/DeleteDeviceModal';
import { InspectDeviceView } from './components/InspectDeviceView';
import { LoginView } from './components/LoginView';
import { ManageUsersPageView } from './components/ManageUsersPageView';
import { ThresholdsView } from './components/ThresholdsView';
import { fetchWithAuth, clearAuth } from './utils/auth';
import { CheckCircle2, AlertCircle, X as CloseIcon } from 'lucide-react';

function cronToMs(cron: string): number {
  if (!cron || typeof cron !== 'string') return 60000;
  const trimmed = cron.trim();
  if (trimmed === '* * * * *' || trimmed === '*/1 * * * *') return 60000;
  if (trimmed === '0 * * * *' || trimmed === '0 */1 * * *') return 60 * 60000;
  if (trimmed === '0 0 * * *') return 1440 * 60000;

  const minMatch = trimmed.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60000;

  const hourMatch = trimmed.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60 * 60000;

  return 60000;
}

export default function App() {
  // Main data state
  const [servers, setServers] = useState<Server[]>(INITIAL_SERVERS);
  const [datacenters, setDatacenters] = useState<Datacenter[]>(INITIAL_DATACENTERS);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isDcModalOpen, setIsDcModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'add-device' | 'inspect' | 'data-centers' | 'admin-users' | 'thresholds'>('dashboard');
  const [inspectDeviceId, setInspectDeviceId] = useState<string | null>(null);

  // Three-state authentication lifecycle: 'checking' | 'authenticated' | 'unauthenticated'
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [currentUsername, setCurrentUsername] = useState<string>('admin');
  const [currentUserId, setCurrentUserId] = useState<string | number>('');

  const checkAuth = useCallback(async () => {
    setAuthStatus('checking');
    try {
      const res = await fetchWithAuth('/api/auth/me');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setAuthStatus('authenticated');
        if (data.username) setCurrentUsername(data.username);
        if (data.userId) setCurrentUserId(data.userId);
      } else {
        setAuthStatus('unauthenticated');
      }
    } catch {
      setAuthStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLoginSuccess = (username: string, userId?: string | number) => {
    setAuthStatus('authenticated');
    setCurrentUsername(username);
    if (userId) setCurrentUserId(userId);
    setToast({ type: 'success', message: `Authenticated as ${username}` });
  };

  const handleLogout = async () => {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    clearAuth();
    setAuthStatus('unauthenticated');
    setToast({ type: 'info', message: 'Logged out of session.' });
  };

  const handleUnauthorized = useCallback(() => {
    clearAuth();
    setAuthStatus('unauthenticated');
  }, []);

  // Synchronize route with browser URL for App Router and direct links
  const syncRouteFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path.startsWith('/inspect/')) {
      const id = path.replace('/inspect/', '').trim();
      if (id) {
        setInspectDeviceId(id);
        setCurrentView('inspect');
        return;
      }
    }
    if (path === '/add-device' || path === '/add-server') {
      setCurrentView('add-device');
      setInspectDeviceId(null);
      return;
    }
    if (path === '/admin/data-centers' || path === '/data-centers') {
      setCurrentView('data-centers');
      setInspectDeviceId(null);
      return;
    }
    if (path === '/admin/users' || path === '/users') {
      setCurrentView('admin-users');
      setInspectDeviceId(null);
      return;
    }
    if (
      path === '/admin/thresholds' ||
      path === '/thresholds' ||
      path === '/admin/polling' ||
      path === '/polling' ||
      path === '/settings' ||
      path === '/admin/settings'
    ) {
      setCurrentView('thresholds');
      setInspectDeviceId(null);
      return;
    }
    setCurrentView('dashboard');
    setInspectDeviceId(null);
  }, []);

  useEffect(() => {
    syncRouteFromUrl();
    window.addEventListener('popstate', syncRouteFromUrl);
    return () => window.removeEventListener('popstate', syncRouteFromUrl);
  }, [syncRouteFromUrl]);

  // App Router navigation object
  const router = useMemo(() => ({
    push: (url: string) => {
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', url);
        syncRouteFromUrl();
      }
    },
    back: () => {
      if (typeof window !== 'undefined') {
        window.history.back();
      }
    }
  }), [syncRouteFromUrl]);

  // Device Edit and Delete state
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingServer, setDeletingServer] = useState<Server | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'normal' | 'critical'>('all');
  const [datacenterFilter, setDatacenterFilter] = useState<string>('all');

  // Light / Dark mode state with persistence
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('noc-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });

  // Sync theme with document element and localStorage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      try {
        localStorage.setItem('noc-theme', theme);
      } catch {
        // ignore localStorage errors
      }
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Live simulation telemetry state
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(5000);

  // Fetch initial datacenters from API
  useEffect(() => {
    async function fetchDatacenters() {
      try {
        const res = await fetch('/api/datacenters', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.datacenters) && data.datacenters.length > 0) {
            setDatacenters(data.datacenters);
          }
        }
      } catch {
        // Fallback to initial seed
      }
    }
    fetchDatacenters();
  }, []);

  // Fetch initial devices from API
  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetchWithAuth('/api/devices', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.devices)) {
            const mapped: Server[] = data.devices.map((d: any) => ({
              id: String(d.id),
              ip: d.ip_address || d.ip || '',
              hostname: d.sys_name || d.hostname || '',
              sysName: d.sys_name ?? d.sysName ?? null,
              deviceType: d.device_type || d.deviceType || 'Server',
              brand: d.brand || 'Other',
              datacenterId: d.datacenter_id ?? d.datacenterId,
              datacenterName: d.datacenter_name ?? d.datacenterName,
              location: d.location || 'Local Datacenter',
              rackNumber: d.rack_number || d.rackNumber || 'Unassigned',
              snmpCommunity: d.snmp_community || d.snmpCommunity || 'public',
              cpuUsage: Number(d.cpu_usage ?? d.cpuUsage ?? 0),
              ramUsage: Number(d.ram_usage ?? d.ramUsage ?? 0),
              diskUsage: Number(d.disk_usage ?? d.diskUsage ?? 0),
              connectedUsers: d.connected_users !== undefined && d.connected_users !== null ? Number(d.connected_users) : (d.connectedUsers ?? null),
              temperature: d.temperature !== undefined && d.temperature !== null ? Number(d.temperature) : (d.temperature ?? null),
              powerSupplies: Array.isArray(d.power_supplies) ? d.power_supplies : (Array.isArray(d.powerSupplies) ? d.powerSupplies : null),
              fans: Array.isArray(d.fans) ? d.fans : null,
              deviceModel: d.device_model ?? d.deviceModel ?? null,
              deviceSerial: d.device_serial ?? d.deviceSerial ?? null,
              softwareId: d.software_id ?? d.softwareId ?? null,
              sysDescr: d.sys_descr ?? d.sysDescr ?? null,
              storage: Array.isArray(d.storage)
                ? d.storage
                : typeof d.storage === 'string'
                ? (() => {
                    try {
                      const parsed = JSON.parse(d.storage);
                      return Array.isArray(parsed) ? parsed : null;
                    } catch {
                      return null;
                    }
                  })()
                : null,
              diskIo: typeof d.disk_io === 'string'
                ? (() => {
                    try {
                      return JSON.parse(d.disk_io);
                    } catch {
                      return null;
                    }
                  })()
                : (d.disk_io ?? d.diskIo ?? null),
              opticalTx: d.optical_tx !== undefined && d.optical_tx !== null ? Number(d.optical_tx) : (d.opticalTx ?? null),
              opticalRx: d.optical_rx !== undefined && d.optical_rx !== null ? Number(d.optical_rx) : (d.opticalRx ?? null),
              diskPercentageUsed: d.disk_percentage_used !== undefined && d.disk_percentage_used !== null ? Number(d.disk_percentage_used) : (d.diskPercentageUsed ?? null),
              diskPowerOnHours: d.disk_power_on_hours !== undefined && d.disk_power_on_hours !== null ? Number(d.disk_power_on_hours) : (d.diskPowerOnHours ?? null),
              diskLifetimeBytesRead: d.disk_lifetime_bytes_read !== undefined && d.disk_lifetime_bytes_read !== null ? Number(d.disk_lifetime_bytes_read) : (d.diskLifetimeBytesRead ?? null),
              diskLifetimeBytesWritten: d.disk_lifetime_bytes_written !== undefined && d.disk_lifetime_bytes_written !== null ? Number(d.disk_lifetime_bytes_written) : (d.diskLifetimeBytesWritten ?? null),
              diskEstimatedEolDays: d.disk_estimated_eol_days !== undefined && d.disk_estimated_eol_days !== null ? Number(d.disk_estimated_eol_days) : (d.diskEstimatedEolDays ?? null),
              ramEccCorrected: d.ram_ecc_corrected !== undefined && d.ram_ecc_corrected !== null ? Number(d.ram_ecc_corrected) : (d.ramEccCorrected ?? null),
              ramEccUncorrected: d.ram_ecc_uncorrected !== undefined && d.ram_ecc_uncorrected !== null ? Number(d.ram_ecc_uncorrected) : (d.ramEccUncorrected ?? null),
              ramEccControllers: Array.isArray(d.ram_ecc_controllers)
                ? d.ram_ecc_controllers
                : typeof d.ram_ecc_controllers === 'string'
                ? (() => {
                    try {
                      const parsed = JSON.parse(d.ram_ecc_controllers);
                      return Array.isArray(parsed) ? parsed : null;
                    } catch {
                      return null;
                    }
                  })()
                : (d.ramEccControllers ?? null),
              disks: Array.isArray(d.disks)
                ? d.disks
                : typeof d.disks === 'string'
                ? (() => {
                    try {
                      const parsed = JSON.parse(d.disks);
                      return Array.isArray(parsed) ? parsed : null;
                    } catch {
                      return null;
                    }
                  })()
                : (d.disks ?? null),
              interfaces: Array.isArray(d.interfaces)
                ? d.interfaces
                : typeof d.interfaces === 'string'
                ? (() => {
                    try {
                      const parsed = JSON.parse(d.interfaces);
                      return Array.isArray(parsed) ? parsed : null;
                    } catch {
                      return null;
                    }
                  })()
                : (d.interfaces ?? null),
              metricsAvailable: d.metrics_available ?? d.metricsAvailable,
              lastPolledAt: d.recorded_at ?? d.lastPolledAt,
              status: (d.status as any) || 'offline',
              health: (d.health as any) || 'Critical',
              uptime: d.uptime || '0d 0h',
              loadAverage: d.load_average || d.loadAverage || '0.00, 0.00, 0.00',
            }));
            setServers(mapped);
          }
        }
      } catch {
        // Fallback to initial seed
      }
    }
    fetchDevices();
  }, []);

  // Fetch active SNMP polling interval and subscribe to changes
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    async function fetchPollInterval() {
      try {
        const res = await fetchWithAuth('/api/settings/snmp-poll-cron', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.cron) {
            setPollIntervalMs(cronToMs(data.cron));
          }
        }
      } catch {
        // Keep default interval
      }
    }
    fetchPollInterval();

    const handleIntervalChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ cron?: string }>;
      if (customEvent.detail?.cron) {
        setPollIntervalMs(cronToMs(customEvent.detail.cron));
      }
    };
    window.addEventListener('healthstream:poll-interval-changed', handleIntervalChange);
    return () => window.removeEventListener('healthstream:poll-interval-changed', handleIntervalChange);
  }, [authStatus]);

  // Compute node count dynamically for datacenters
  const enrichedDatacenters = useMemo(() => {
    return datacenters.map((dc) => {
      const count = servers.filter((s) => {
        if (s.datacenterId && String(s.datacenterId) === String(dc.id)) return true;
        if (s.datacenterName && s.datacenterName.toLowerCase() === dc.name.toLowerCase()) return true;
        if (s.location && s.location.toLowerCase() === dc.location.toLowerCase()) return true;
        return false;
      }).length;
      return {
        ...dc,
        nodeCount: count,
      };
    });
  }, [datacenters, servers]);

  // Filter and search computation
  const filteredServers = useMemo(() => {
    return servers.filter((srv) => {
      // 1. Status filter
      if (statusFilter === 'online' && srv.status !== 'online') return false;
      if (statusFilter === 'offline' && srv.status !== 'offline') return false;

      // 2. Device type filter
      if (deviceFilter !== 'all' && (srv.deviceType || '').toLowerCase() !== deviceFilter.toLowerCase()) return false;

      // 3. Health filter
      if (healthFilter === 'normal' && srv.health !== 'Normal') return false;
      if (healthFilter === 'critical' && srv.health === 'Normal') return false;

      // 4. Data Center filter
      if (datacenterFilter !== 'all') {
        const targetDc = enrichedDatacenters.find((d) => String(d.id) === String(datacenterFilter));
        const matchDcId = srv.datacenterId && String(srv.datacenterId) === String(datacenterFilter);
        const matchDcName = targetDc && srv.datacenterName && srv.datacenterName.toLowerCase() === targetDc.name.toLowerCase();
        const matchDcLoc = targetDc && srv.location && srv.location.toLowerCase() === targetDc.location.toLowerCase();
        if (!matchDcId && !matchDcName && !matchDcLoc) {
          return false;
        }
      }

      // 5. Search query (IP, Hostname, Location, Rack, DC Name, or Device Type)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchIp = srv.ip.toLowerCase().includes(query);
        const matchHost = srv.hostname.toLowerCase().includes(query);
        const matchLoc = srv.location?.toLowerCase().includes(query);
        const matchRack = srv.rackNumber?.toLowerCase().includes(query);
        const matchDc = srv.datacenterName?.toLowerCase().includes(query);
        const matchType = srv.deviceType?.toLowerCase().includes(query);
        return matchIp || matchHost || matchLoc || matchRack || matchDc || matchType;
      }
      return true;
    });
  }, [servers, statusFilter, deviceFilter, healthFilter, datacenterFilter, enrichedDatacenters, searchQuery]);

  // Pagination computation
  const totalPages = Math.max(1, Math.ceil(filteredServers.length / pageSize));
  
  // Safe clamped current page
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedServers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredServers.slice(start, start + pageSize);
  }, [filteredServers, safeCurrentPage, pageSize]);

  // Reset pagination when filter or search changes
  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const handleDeviceFilterChange = (device: string) => {
    setDeviceFilter(device);
    setCurrentPage(1);
  };

  const handleHealthFilterChange = (health: 'all' | 'normal' | 'critical') => {
    setHealthFilter(health);
    setCurrentPage(1);
  };

  const handleDatacenterFilterChange = (dcId: string) => {
    setDatacenterFilter(dcId);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleResetAllFilters = () => {
    setStatusFilter('all');
    setDeviceFilter('all');
    setHealthFilter('all');
    setDatacenterFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    statusFilter !== 'all' || 
    deviceFilter !== 'all' || 
    healthFilter !== 'all' || 
    datacenterFilter !== 'all' || 
    !!searchQuery;

  // Dedicated Inspect navigation and current inspected server
  const handleInspectServer = (server: Server) => {
    setSelectedServer(server);
    setInspectDeviceId(server.id);
    router.push(`/inspect/${server.id}`);
  };

  // Row selection handler redirects to dedicated inspect page
  const handleSelectServer = (server: Server) => {
    handleInspectServer(server);
  };

  const currentInspectServer = useMemo(() => {
    if (!inspectDeviceId) return selectedServer;
    return servers.find((s) => s.id === inspectDeviceId || s.ip === inspectDeviceId) || selectedServer;
  }, [inspectDeviceId, servers, selectedServer]);

  // Device Edit and Delete handlers
  const handleOpenEditModal = (server: Server) => {
    setEditingServer(server);
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (server: Server) => {
    setDeletingServer(server);
    setIsDeleteModalOpen(true);
  };

  const handleDeviceUpdated = (updatedServer: Server) => {
    setServers((prev) =>
      prev.map((s) => (s.id === updatedServer.id ? { ...s, ...updatedServer } : s))
    );
    if (selectedServer?.id === updatedServer.id) {
      setSelectedServer((prev) => (prev ? { ...prev, ...updatedServer } : updatedServer));
    }
    setToast({
      type: 'success',
      message: `Device "${updatedServer.hostname}" (${updatedServer.ip}) was successfully updated.`,
    });
  };

  const handleDeviceDeleted = (deviceId: string) => {
    const target = servers.find((s) => s.id === deviceId);
    setServers((prev) => prev.filter((s) => s.id !== deviceId));
    if (selectedServer?.id === deviceId) {
      setSelectedServer(null);
    }
    if (inspectDeviceId === deviceId || currentView === 'inspect') {
      router.push('/');
    }
    setToast({
      type: 'info',
      message: `Device "${target?.hostname || deviceId}" was successfully removed from HealthStream.`,
    });
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // When a new server is added through the admin form
  const handleServerAdded = (newServer: Server) => {
    setServers((prev) => [newServer, ...prev]);
    setSelectedServer(newServer);
  };

  // Datacenter modal handlers
  const handleAddDatacenter = (newDc: Datacenter) => {
    setDatacenters((prev) => [newDc, ...prev]);
  };

  const handleUpdateDatacenter = (updatedDc: Datacenter) => {
    setDatacenters((prev) =>
      prev.map((d) => (String(d.id) === String(updatedDc.id) ? { ...d, ...updatedDc } : d))
    );
    // Also sync datacenterName/location across loaded servers
    setServers((prev) =>
      prev.map((s) => {
        if (String(s.datacenterId) === String(updatedDc.id)) {
          return {
            ...s,
            datacenterName: updatedDc.name,
            location: updatedDc.location || s.location,
          };
        }
        return s;
      })
    );
  };

  const handleDeleteDatacenter = (id: string | number) => {
    setDatacenters((prev) => prev.filter((d) => String(d.id) !== String(id)));
    if (String(datacenterFilter) === String(id)) {
      setDatacenterFilter('all');
    }
  };

  // Live telemetry polling from /api/telemetry (with on-demand SNMP sweep when manual = true)
  const handleRefresh = useCallback(async (manual = false) => {
    const startTime = Date.now();
    let hadError = false;
    if (manual) {
      setIsRefreshing(true);
    } else {
      setIsAutoFetching(true);
    }
    try {
      const endpoint = manual ? '/api/telemetry?refresh=true' : '/api/telemetry';
      const [res, dcRes] = await Promise.all([
        fetchWithAuth(endpoint, { credentials: 'include' }),
        manual ? fetch('/api/datacenters', { credentials: 'include' }).catch(() => null) : Promise.resolve(null),
      ]);

      if (dcRes && dcRes.ok) {
        const dcData = await dcRes.json();
        if (dcData && Array.isArray(dcData.datacenters) && dcData.datacenters.length > 0) {
          setDatacenters(dcData.datacenters);
        }
      }

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.telemetry)) {
          const liveList = data.telemetry;
          setServers((prev) => {
            const prevByIp = new Map<string, Server>(prev.map((s) => [s.ip, s]));
            return liveList.map((live: any): Server => {
              const ip = live.ip_address || live.ip || '';
              const existing = prevByIp.get(ip);
              return {
                id: String(live.id ?? existing?.id ?? `dev-${ip.replace(/\./g, '-')}`),
                ip,
                hostname: live.sys_name || live.hostname || existing?.hostname || '',
                sysName: live.sys_name ?? live.sysName ?? existing?.sysName ?? null,
                deviceType: live.device_type || live.deviceType || existing?.deviceType || 'Server',
                brand: live.brand || existing?.brand || 'Other',
                datacenterId: live.datacenter_id ?? live.datacenterId ?? existing?.datacenterId,
                datacenterName: live.datacenter_name ?? live.datacenterName ?? existing?.datacenterName,
                location: live.location || existing?.location || 'Local Datacenter',
                rackNumber: live.rack_number || live.rackNumber || existing?.rackNumber || 'Unassigned',
                snmpCommunity: live.snmp_community || live.snmpCommunity || existing?.snmpCommunity || 'public',
                cpuUsage: Number(live.cpu_usage ?? live.cpuUsage ?? existing?.cpuUsage ?? 0),
                ramUsage: Number(live.ram_usage ?? live.ramUsage ?? existing?.ramUsage ?? 0),
                diskUsage: Number(live.disk_usage ?? live.diskUsage ?? existing?.diskUsage ?? 0),
                connectedUsers: live.connected_users !== undefined && live.connected_users !== null ? Number(live.connected_users) : (live.connectedUsers ?? existing?.connectedUsers ?? null),
                temperature: live.temperature !== undefined && live.temperature !== null ? Number(live.temperature) : (live.temperature ?? existing?.temperature ?? null),
                powerSupplies: Array.isArray(live.power_supplies) ? live.power_supplies : (Array.isArray(live.powerSupplies) ? live.powerSupplies : (existing?.powerSupplies ?? null)),
                fans: Array.isArray(live.fans) ? live.fans : (existing?.fans ?? null),
                deviceModel: live.device_model ?? live.deviceModel ?? existing?.deviceModel ?? null,
                deviceSerial: live.device_serial ?? live.deviceSerial ?? existing?.deviceSerial ?? null,
                softwareId: live.software_id ?? live.softwareId ?? existing?.softwareId ?? null,
                sysDescr: live.sys_descr ?? live.sysDescr ?? existing?.sysDescr ?? null,
                storage: Array.isArray(live.storage)
                  ? live.storage
                  : typeof live.storage === 'string'
                  ? (() => {
                      try {
                        const parsed = JSON.parse(live.storage);
                        return Array.isArray(parsed) ? parsed : (existing?.storage ?? null);
                      } catch {
                        return existing?.storage ?? null;
                      }
                    })()
                  : (existing?.storage ?? null),
                diskIo: typeof live.disk_io === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(live.disk_io);
                      } catch {
                        return existing?.diskIo ?? null;
                      }
                    })()
                  : (live.disk_io !== undefined ? live.disk_io : (existing?.diskIo ?? null)),
                opticalTx: live.optical_tx !== undefined && live.optical_tx !== null ? Number(live.optical_tx) : (live.opticalTx ?? existing?.opticalTx ?? null),
                opticalRx: live.optical_rx !== undefined && live.optical_rx !== null ? Number(live.optical_rx) : (live.opticalRx ?? existing?.opticalRx ?? null),
                diskPercentageUsed: live.disk_percentage_used !== undefined && live.disk_percentage_used !== null ? Number(live.disk_percentage_used) : (live.diskPercentageUsed ?? existing?.diskPercentageUsed ?? null),
                diskPowerOnHours: live.disk_power_on_hours !== undefined && live.disk_power_on_hours !== null ? Number(live.disk_power_on_hours) : (live.diskPowerOnHours ?? existing?.diskPowerOnHours ?? null),
                diskLifetimeBytesRead: live.disk_lifetime_bytes_read !== undefined && live.disk_lifetime_bytes_read !== null ? Number(live.disk_lifetime_bytes_read) : (live.diskLifetimeBytesRead ?? existing?.diskLifetimeBytesRead ?? null),
                diskLifetimeBytesWritten: live.disk_lifetime_bytes_written !== undefined && live.disk_lifetime_bytes_written !== null ? Number(live.disk_lifetime_bytes_written) : (live.diskLifetimeBytesWritten ?? existing?.diskLifetimeBytesWritten ?? null),
                diskEstimatedEolDays: live.disk_estimated_eol_days !== undefined && live.disk_estimated_eol_days !== null ? Number(live.disk_estimated_eol_days) : (live.diskEstimatedEolDays ?? existing?.diskEstimatedEolDays ?? null),
                ramEccCorrected: live.ram_ecc_corrected !== undefined && live.ram_ecc_corrected !== null ? Number(live.ram_ecc_corrected) : (live.ramEccCorrected ?? existing?.ramEccCorrected ?? null),
                ramEccUncorrected: live.ram_ecc_uncorrected !== undefined && live.ram_ecc_uncorrected !== null ? Number(live.ram_ecc_uncorrected) : (live.ramEccUncorrected ?? existing?.ramEccUncorrected ?? null),
                ramEccControllers: Array.isArray(live.ram_ecc_controllers)
                  ? live.ram_ecc_controllers
                  : typeof live.ram_ecc_controllers === 'string'
                  ? (() => {
                      try {
                        const parsed = JSON.parse(live.ram_ecc_controllers);
                        return Array.isArray(parsed) ? parsed : (existing?.ramEccControllers ?? null);
                      } catch {
                        return existing?.ramEccControllers ?? null;
                      }
                    })()
                  : (live.ram_ecc_controllers !== undefined ? live.ram_ecc_controllers : (existing?.ramEccControllers ?? null)),
                disks: Array.isArray(live.disks)
                  ? live.disks
                  : typeof live.disks === 'string'
                  ? (() => {
                      try {
                        const parsed = JSON.parse(live.disks);
                        return Array.isArray(parsed) ? parsed : (existing?.disks ?? null);
                      } catch {
                        return existing?.disks ?? null;
                      }
                    })()
                  : (live.disks !== undefined ? live.disks : (existing?.disks ?? null)),
                interfaces: Array.isArray(live.interfaces)
                  ? live.interfaces
                  : typeof live.interfaces === 'string'
                  ? (() => {
                      try {
                        const parsed = JSON.parse(live.interfaces);
                        return Array.isArray(parsed) ? parsed : (existing?.interfaces ?? null);
                      } catch {
                        return existing?.interfaces ?? null;
                      }
                    })()
                  : (live.interfaces !== undefined ? live.interfaces : (existing?.interfaces ?? null)),
                metricsAvailable: live.metrics_available ?? live.metricsAvailable ?? existing?.metricsAvailable,
                lastPolledAt: live.recorded_at ?? live.lastPolledAt ?? existing?.lastPolledAt,
                status: (live.status as any) || existing?.status || 'offline',
                health: (live.health as any) || existing?.health || 'Critical',
                uptime: live.uptime || existing?.uptime || '0d 0h',
                loadAverage: live.load_average || live.loadAverage || existing?.loadAverage || '0.00, 0.00, 0.00',
              };
            });
          });

          if (manual) {
            const upCount = liveList.filter((item: any) => item.status === 'online').length;
            setToast({
              type: 'success',
              message: `Telemetry refreshed — ${upCount} of ${liveList.length} devices online.`,
            });
          }
          return;
        }
      }
    } catch {
      hadError = true;
      if (manual) {
        setToast({
          type: 'error',
          message: 'Failed to refresh telemetry from server.',
        });
      } else {
        setIsAutoFetching(false);
      }
    } finally {
      if (manual) {
        setIsRefreshing(false);
      } else if (hadError) {
        setIsAutoFetching(false);
      } else {
        const elapsed = Date.now() - startTime;
        const remaining = 1200 - elapsed;
        if (remaining > 0) {
          setTimeout(() => setIsAutoFetching(false), remaining);
        } else {
          setIsAutoFetching(false);
        }
      }
    }
  }, []);

  // Sync selectedServer if metrics update in the background
  useEffect(() => {
    if (selectedServer) {
      const updated = servers.find((s) => s.id === selectedServer.id);
      if (updated) {
        setSelectedServer(updated);
      }
    }
  }, [servers, selectedServer]);

  // Immediate refresh when entering dashboard or inspect view
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    if (currentView === 'dashboard' || currentView === 'inspect') {
      handleRefresh();
    }
  }, [currentView, authStatus, handleRefresh]);

  // Real-time auto-refresh interval for dashboard and fleet telemetry
  useEffect(() => {
    if (!isAutoRefresh || (currentView !== 'dashboard' && currentView !== 'inspect')) return;
    const interval = setInterval(() => {
      handleRefresh();
    }, pollIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [isAutoRefresh, currentView, handleRefresh, pollIntervalMs]);

  // Keyboard shortcut: Pressing "/" or "Cmd+K" focuses the search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const searchInput = document.getElementById('server-search-input');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Simulate reboot
  const handleRebootServer = (serverId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const isOnline = s.status === 'online';
        return {
          ...s,
          status: isOnline ? 'offline' : 'online',
          health: isOnline ? 'Critical' : 'Normal',
          cpuUsage: isOnline ? 0 : 25,
          ramUsage: isOnline ? 0 : 35,
          uptime: isOnline ? '0 hrs (Rebooting)' : 'Just started (0 min)',
        };
      })
    );
  };

  // Online / Offline count calculations
  const onlineCount = useMemo(() => servers.filter((s) => s.status === 'online').length, [servers]);
  const offlineCount = useMemo(() => servers.filter((s) => s.status === 'offline').length, [servers]);
  const clusterHealthPercent = Math.round((onlineCount / (servers.length || 1)) * 100);

  // Existing IPs list for 409 conflict detection
  const existingIps = useMemo(() => servers.map((s) => s.ip), [servers]);

  // Neutral loading state while checking authentication session
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-base-100 gap-3">
        <span className="loading loading-spinner loading-lg text-primary" />
        <span className="text-xs font-semibold text-base-content/70">Connecting to HealthStream Telemetry...</span>
      </div>
    );
  }

  // Not authenticated: render Login page gate
  if (authStatus === 'unauthenticated') {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-base-200/40 text-base-content flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <TopBar
        onRefresh={() => handleRefresh(true)}
        isRefreshing={isRefreshing}
        isAutoFetching={isAutoFetching}
        isAutoRefresh={isAutoRefresh}
        setIsAutoRefresh={setIsAutoRefresh}
        pollIntervalMs={pollIntervalMs}
        setPollIntervalMs={setPollIntervalMs}
        clusterHealthPercent={clusterHealthPercent}
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'dashboard') router.push('/');
          else if (view === 'add-device') router.push('/add-device');
        }}
        onOpenDcModal={() => router.push('/admin/data-centers')}
        datacenterCount={enrichedDatacenters.length}
        deviceCount={servers.length}
        onOpenUsersModal={() => router.push('/admin/users')}
        onNavigateThresholds={() => router.push('/admin/thresholds')}
        currentUsername={currentUsername}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-4 sm:pb-6 flex flex-col min-h-0">
        
        {currentView === 'inspect' ? (
          currentInspectServer ? (
            <InspectDeviceView
              server={currentInspectServer}
              onBack={() => router.push('/')}
              onEditServer={handleOpenEditModal}
              onDeleteServer={handleOpenDeleteModal}
              onRebootServer={handleRebootServer}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md p-6 rounded-2xl bg-base-100 border border-base-content/10 shadow-xl text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <h2 className="text-lg font-bold">Device Not Found</h2>
                <p className="text-xs text-base-content/70">
                  The specified device ({inspectDeviceId}) could not be located in fleet inventory.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="btn btn-primary btn-sm rounded-xl font-bold"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )
        ) : currentView === 'add-device' ? (
          <AddServerView
            onBack={() => router.push('/')}
            onServerAdded={handleServerAdded}
            existingIps={existingIps}
            datacenters={enrichedDatacenters}
            onOpenDcModal={() => router.push('/admin/data-centers')}
            onNavigateToDatacenters={() => router.push('/admin/data-centers')}
          />
        ) : currentView === 'data-centers' ? (
          <DatacenterPageView
            datacenters={enrichedDatacenters}
            onBack={() => router.push('/')}
            onAddDatacenter={handleAddDatacenter}
            onDeleteDatacenter={handleDeleteDatacenter}
            onUpdateDatacenter={handleUpdateDatacenter}
            onUnauthorized={handleUnauthorized}
          />
        ) : currentView === 'admin-users' ? (
          <ManageUsersPageView
            onBack={() => router.push('/')}
            currentUsername={currentUsername}
            currentUserId={currentUserId}
            authStatus={authStatus}
            onUnauthorized={handleUnauthorized}
          />
        ) : currentView === 'thresholds' ? (
          <ThresholdsView
            onBack={() => router.push('/')}
            fetchWithAuth={fetchWithAuth}
            onUnauthorized={handleUnauthorized}
          />
        ) : (
          /* Two-Column Dashboard Layout: Desktop Flex/Grid with Fixed Sidebar & Internal Scroll Table */
          <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch lg:h-[calc(100vh-7.5rem)] min-w-0">
            
            {/* Left Sidebar / Column: Compact Stats Cards Stacked Vertically + Quick Filters */}
            <aside 
              aria-label="Fleet status metrics and quick filters"
              className="w-full lg:w-64 xl:w-72 shrink-0 lg:h-full lg:overflow-y-auto pr-1 pt-1 pb-1 space-y-2.5"
            >
              <FilterCards
                currentFilter={statusFilter}
                onSelectFilter={handleFilterChange}
                totalCount={servers.length}
                onlineCount={onlineCount}
                offlineCount={offlineCount}
                mockEstimatedTotal={servers.length.toLocaleString()}
                deviceFilter={deviceFilter}
                onSelectDeviceFilter={handleDeviceFilterChange}
                healthFilter={healthFilter}
                onSelectHealthFilter={handleHealthFilterChange}
                datacenters={enrichedDatacenters}
                datacenterFilter={datacenterFilter}
                onSelectDatacenterFilter={handleDatacenterFilterChange}
                onOpenDcModal={() => router.push('/admin/data-centers')}
                onResetFilters={handleResetAllFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </aside>

            {/* Main Right Content Area: Prominently displays Search at top, Data Table with Internal Scroll, Pagination */}
            <section 
              aria-label="Server fleet telemetry and controls" 
              className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden"
            >
              {/* High-Density Server Telemetry Table with Prominent Search Bar & Internal Scroll */}
              <ServerTable
                servers={paginatedServers}
                selectedServer={selectedServer}
                onSelectServer={handleSelectServer}
                onInspectServer={handleInspectServer}
                onEditServer={handleOpenEditModal}
                onDeleteServer={handleOpenDeleteModal}
                searchQuery={searchQuery}
                setSearchQuery={handleSearchChange}
                totalFilteredCount={filteredServers.length}
                statusFilter={statusFilter}
                deviceFilter={deviceFilter}
                healthFilter={healthFilter}
                datacenters={enrichedDatacenters}
                datacenterFilter={datacenterFilter}
                onSelectDatacenterFilter={handleDatacenterFilterChange}
                onClearSearch={() => handleSearchChange('')}
                onClearAllFilters={handleResetAllFilters}
              >
                {/* Pagination Controls at Bottom of Table Card */}
                <Pagination
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  totalItems={filteredServers.length}
                  virtualTotalEstimate={servers.length}
                />
              </ServerTable>
            </section>
          </div>
        )}
      </main>

      {/* Production Enterprise Footer */}
      <footer className="footer footer-center py-3.5 px-4 bg-base-100 border-t border-base-content/10 text-xs text-base-content/60 backdrop-blur-md mt-auto">
        <aside className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            HealthStream Platform • Infrastructure Telemetry Engine v4.8
          </span>
          <span className="hidden sm:inline text-base-content/30">•</span>
          <span>High-Availability Tier IV • SLA 99.999%</span>
          <span className="hidden sm:inline text-base-content/30">•</span>
          <span>Global Fleet Management Active</span>
        </aside>
      </footer>

      {/* Datacenter Fleet Management Modal */}
      <DatacenterModal
        isOpen={isDcModalOpen}
        onClose={() => setIsDcModalOpen(false)}
        datacenters={enrichedDatacenters}
        onAddDatacenter={handleAddDatacenter}
        onDeleteDatacenter={handleDeleteDatacenter}
        onUpdateDatacenter={handleUpdateDatacenter}
      />

      {/* Edit Device Modal */}
      <EditDeviceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingServer(null);
        }}
        device={editingServer}
        datacenters={enrichedDatacenters}
        onDeviceUpdated={handleDeviceUpdated}
        existingIps={existingIps}
      />

      {/* Delete Device Warning Modal */}
      <DeleteDeviceModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingServer(null);
        }}
        device={deletingServer}
        onDeviceDeleted={handleDeviceDeleted}
      />

      {/* Sleek Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-auto transition-all animate-bounce-short">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-base-100 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/10'
              : toast.type === 'error'
              ? 'bg-base-100 border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-rose-500/10'
              : 'bg-base-100 border-primary/30 text-primary shadow-primary/10'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-base-content/10 transition-colors ml-1 text-base-content/50 hover:text-base-content"
              aria-label="Dismiss notification"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

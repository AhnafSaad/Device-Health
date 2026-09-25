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
import { CheckCircle2, AlertCircle, X as CloseIcon } from 'lucide-react';

export default function App() {
  // Main data state
  const [servers, setServers] = useState<Server[]>(INITIAL_SERVERS);
  const [datacenters, setDatacenters] = useState<Datacenter[]>(INITIAL_DATACENTERS);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isDcModalOpen, setIsDcModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'add-device' | 'inspect' | 'data-centers'>('dashboard');
  const [inspectDeviceId, setInspectDeviceId] = useState<string | null>(null);

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

  // Fetch initial datacenters from API
  useEffect(() => {
    async function fetchDatacenters() {
      try {
        const res = await fetch('/api/datacenters');
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

  // Live telemetry polling (every 10s from /api/telemetry or simulated fallback)
  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.telemetry) && data.telemetry.length > 0) {
          const liveList = data.telemetry;
          setServers((prev) =>
            prev.map((s) => {
              const live = liveList.find((item: any) => (item.ip_address || item.ip) === s.ip);
              if (!live) return s;
              return {
                ...s,
                cpuUsage: Number(live.cpu_usage ?? live.cpuUsage ?? s.cpuUsage),
                ramUsage: Number(live.ram_usage ?? live.ramUsage ?? s.ramUsage),
                status: (live.status as any) || s.status,
                health: (live.health as any) || s.health,
                uptime: live.uptime || s.uptime,
                datacenterId: live.datacenter_id ?? s.datacenterId,
                datacenterName: live.datacenter_name ?? s.datacenterName,
              };
            })
          );
          return;
        }
      }
    } catch {
      // Local development or simulated fallback
    }

    setServers((prev) =>
      prev.map((s) => {
        if (s.status === 'offline') return s;
        // Apply slight realistic delta to CPU, RAM, Disk
        const cpuDelta = Math.floor(Math.random() * 9) - 4;
        const ramDelta = Math.floor(Math.random() * 5) - 2;
        const newCpu = Math.min(99, Math.max(10, s.cpuUsage + cpuDelta));
        const newRam = Math.min(99, Math.max(20, s.ramUsage + ramDelta));
        
        let newHealth = s.health;
        if (newCpu > 85) newHealth = 'High CPU';
        else if (s.diskUsage > 85 || newRam > 90) newHealth = 'Critical';
        else newHealth = 'Normal';

        return {
          ...s,
          cpuUsage: newCpu,
          ramUsage: newRam,
          health: newHealth,
        };
      })
    );
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

  // Auto-refresh interval (every 10 seconds)
  useEffect(() => {
    if (!isAutoRefresh || currentView !== 'dashboard') return;
    const interval = setInterval(() => {
      handleRefresh();
    }, 10000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, currentView, handleRefresh]);

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

  return (
    <div className="min-h-screen bg-base-200/40 text-base-content flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <TopBar
        onRefresh={handleRefresh}
        isAutoRefresh={isAutoRefresh}
        setIsAutoRefresh={setIsAutoRefresh}
        clusterHealthPercent={clusterHealthPercent}
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'dashboard') router.push('/');
          else if (view === 'add-device') router.push('/add-device');
        }}
        onOpenDcModal={() => router.push('/admin/data-centers')}
        datacenterCount={enrichedDatacenters.length}
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
                <h2 className="text-lg font-bold">Node Not Found</h2>
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
                mockEstimatedTotal="10,482"
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
                  virtualTotalEstimate={10482}
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
            Enterprise NOC Platform • Telemetry Engine v4.8
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

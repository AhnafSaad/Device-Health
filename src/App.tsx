import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Server, StatusFilter } from './types';
import { INITIAL_SERVERS } from './data/mockServers';
import { TopBar } from './components/TopBar';
import { FilterCards } from './components/FilterCards';
import { ServerTable } from './components/ServerTable';
import { Pagination } from './components/Pagination';
import { ServerDrawer } from './components/ServerDrawer';
import { AddServerView } from './components/AddServerView';

export default function App() {
  // Main data state
  const [servers, setServers] = useState<Server[]>(INITIAL_SERVERS);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'add-device'>('dashboard');

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'normal' | 'critical'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Live simulation telemetry state
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

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

      // 4. Search query (IP, Hostname, Location, Rack, or Device Type)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchIp = srv.ip.toLowerCase().includes(query);
        const matchHost = srv.hostname.toLowerCase().includes(query);
        const matchLoc = srv.location?.toLowerCase().includes(query);
        const matchRack = srv.rackNumber?.toLowerCase().includes(query);
        const matchType = srv.deviceType?.toLowerCase().includes(query);
        return matchIp || matchHost || matchLoc || matchRack || matchType;
      }
      return true;
    });
  }, [servers, statusFilter, deviceFilter, healthFilter, searchQuery]);

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

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleResetAllFilters = () => {
    setStatusFilter('all');
    setDeviceFilter('all');
    setHealthFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || deviceFilter !== 'all' || healthFilter !== 'all' || !!searchQuery;

  // Row selection handler
  const handleSelectServer = (server: Server) => {
    setSelectedServer(server);
    setIsDrawerOpen(true);
  };

  // When a new server is added through the admin form
  const handleServerAdded = (newServer: Server) => {
    setServers((prev) => [newServer, ...prev]);
    setSelectedServer(newServer);
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
        onNavigate={setCurrentView}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-4 sm:pb-6 flex flex-col min-h-0">
        
        {currentView === 'add-device' ? (
          <AddServerView
            onBack={() => setCurrentView('dashboard')}
            onServerAdded={handleServerAdded}
            existingIps={existingIps}
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
                searchQuery={searchQuery}
                setSearchQuery={handleSearchChange}
                totalFilteredCount={filteredServers.length}
                statusFilter={statusFilter}
                deviceFilter={deviceFilter}
                healthFilter={healthFilter}
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

      {/* Footer */}
      <footer className="footer footer-center p-4 bg-base-100/80 border-t border-base-content/10 text-xs text-base-content/50 backdrop-blur-md mt-auto">
        <aside className="flex items-center gap-2">
          <span>NOC Fleet Monitor • Mission-Critical Global Telemetry</span>
          <span>•</span>
          <span className="font-mono font-semibold text-primary">PostgreSQL Backend Live</span>
        </aside>
      </footer>

      {/* Server Details Slide-over Drawer */}
      <ServerDrawer
        server={selectedServer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRebootServer={handleRebootServer}
      />
    </div>
  );
}

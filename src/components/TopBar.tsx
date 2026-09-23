import React from 'react';
import { 
  Server as ServerIcon, 
  RefreshCw, 
  PlusCircle, 
  LayoutDashboard, 
  ShieldCheck, 
  UserCheck, 
  Activity, 
  Building2,
  Sun,
  Moon
} from 'lucide-react';

interface TopBarProps {
  onRefresh: () => void;
  isAutoRefresh: boolean;
  setIsAutoRefresh: (val: boolean) => void;
  clusterHealthPercent: number;
  currentView: 'dashboard' | 'add-device' | 'add-server';
  onNavigate: (view: 'dashboard' | 'add-device') => void;
  onOpenDcModal?: () => void;
  datacenterCount?: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onRefresh,
  isAutoRefresh,
  setIsAutoRefresh,
  clusterHealthPercent,
  currentView,
  onNavigate,
  onOpenDcModal,
  datacenterCount,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-base-content/10 bg-base-100/80 backdrop-blur-md transition-all">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3.5">
          <div 
            onClick={() => onNavigate('dashboard')}
            className="group relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-content shadow-lg shadow-primary/25 cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95"
            title="NOC Fleet Monitor"
          >
            <ServerIcon className="w-5 h-5 transition-transform duration-300 group-hover:rotate-6" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-base-100" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span 
                onClick={() => onNavigate('dashboard')}
                className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-base-content via-base-content/90 to-base-content/70 bg-clip-text text-transparent cursor-pointer"
              >
                NOC Fleet Monitor
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase rounded-full bg-base-200 border border-base-content/10 text-base-content/80">
                10k+ Nodes
              </span>
            </div>
            <p className="text-[11px] text-base-content/50 font-medium hidden sm:block">
              Mission-Critical Infrastructure Telemetry &amp; SRE Control
            </p>
          </div>
        </div>

        {/* Center/Switch: Segmented View Navigation */}
        <div className="flex items-center bg-base-200/80 p-1 rounded-xl border border-base-content/10 shadow-inner">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              currentView === 'dashboard'
                ? 'bg-base-100 text-primary shadow-sm shadow-base-content/5 font-bold'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-100/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onNavigate('add-device')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              currentView === 'add-device' || currentView === 'add-server'
                ? 'bg-base-100 text-primary shadow-sm shadow-base-content/5 font-bold'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-100/50'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Device</span>
          </button>

          {onOpenDcModal && (
            <button
              onClick={onOpenDcModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-base-content/70 hover:text-primary hover:bg-base-100/60 transition-all duration-200 cursor-pointer"
              title="Manage Data Centers"
            >
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Data Centers</span>
              {datacenterCount !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-mono text-[10px] font-bold">
                  {datacenterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Right Section: Telemetry Pulse, Cluster Health & Operator Status */}
        <div className="flex items-center gap-3">
          
          {/* Live Telemetry Glowing Beacon */}
          <div 
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`cursor-pointer select-none flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${
              isAutoRefresh
                ? 'bg-success/10 border-success/30 text-success shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                : 'bg-base-200/60 border-base-content/10 text-base-content/50'
            }`}
            title="Toggle 3s live polling"
          >
            <span className="relative flex h-2 w-2">
              {isAutoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-80" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isAutoRefresh ? 'bg-success' : 'bg-base-content/30'}`} />
            </span>
            <span className="text-[11px] font-semibold tracking-wide hidden md:inline">
              {isAutoRefresh ? 'Live Telemetry' : 'Stream Paused'}
            </span>
          </div>

          {/* Quick Telemetry Poll Button */}
          <button
            onClick={onRefresh}
            className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:text-primary transition-colors"
            title="Poll telemetry snapshot now"
            aria-label="Refresh telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Light / Dark Mode Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:text-primary hover:bg-base-200 transition-all duration-200"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>
          )}

          {/* Operator Profile / Status Indicator */}
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-base-content/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shadow-xs">
              SRE
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold leading-tight flex items-center gap-1">
                <span>NOC Ops</span>
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
              </div>
              <div className="text-[10px] text-base-content/50 font-mono leading-tight">
                {clusterHealthPercent}% SLA
              </div>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
};

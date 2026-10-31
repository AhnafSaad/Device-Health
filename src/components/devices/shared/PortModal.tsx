import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Network, X } from 'lucide-react';
import { NetworkInterface } from '../../../types';

export interface PortModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostname?: string | null;
  ip: string;
  deviceType: string;
  ports: NetworkInterface[];
  isRouter?: boolean;
  virtualPorts?: NetworkInterface[];
  pppSessions?: NetworkInterface[];
  formatPortSpeed: (speedBps?: any) => string;
}

export const PortModal: React.FC<PortModalProps> = ({
  isOpen,
  onClose,
  hostname,
  ip,
  deviceType,
  ports,
  isRouter = false,
  virtualPorts = [],
  pppSessions = [],
  formatPortSpeed,
}) => {
  const [portFilter, setPortFilter] = useState<'all' | 'up' | 'down'>('all');
  const [routerInterfaceTab, setRouterInterfaceTab] = useState<'physical' | 'virtual' | 'ppp'>('physical');
  const [virtualPortFilter, setVirtualPortFilter] = useState<'all' | 'up' | 'down'>('all');
  const [pppSessionFilter, setPppSessionFilter] = useState<'all' | 'up' | 'down'>('all');

  // Prevent background page scrolling and lock viewport while modal is active
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset tab and filter on open
  useEffect(() => {
    if (isOpen) {
      setPortFilter('all');
      setVirtualPortFilter('all');
      setPppSessionFilter('all');
      setRouterInterfaceTab('physical');
    }
  }, [isOpen]);

  const totalPorts = ports.length;
  const upCount = useMemo(() => ports.filter((p) => p.oper_status === 'up').length, [ports]);
  const downCount = totalPorts - upCount;
  const upRatio = totalPorts > 0 ? Math.round((upCount / totalPorts) * 100) : 0;

  // Filtered physical ports (maintaining sort with highest CRC on top)
  const filteredPorts = useMemo(() => {
    if (portFilter === 'all') return ports;
    return ports.filter((p) => p.oper_status === portFilter);
  }, [ports, portFilter]);

  // Virtual ports
  const virtualUpCount = useMemo(() => virtualPorts.filter((p) => p.oper_status === 'up').length, [virtualPorts]);
  const virtualDownCount = virtualPorts.length - virtualUpCount;
  const filteredVirtualPorts = useMemo(() => {
    if (virtualPortFilter === 'all') return virtualPorts;
    return virtualPorts.filter((p) => p.oper_status === virtualPortFilter);
  }, [virtualPorts, virtualPortFilter]);

  // PPP sessions
  const pppUpCount = useMemo(() => pppSessions.filter((p) => p.oper_status === 'up').length, [pppSessions]);
  const pppDownCount = pppSessions.length - pppUpCount;
  const filteredPppSessions = useMemo(() => {
    if (pppSessionFilter === 'all') return pppSessions;
    return pppSessions.filter((p) => p.oper_status === pppSessionFilter);
  }, [pppSessions, pppSessionFilter]);

  const getVirtualTypeLabel = (type?: string | null, name?: string | null) => {
    const n = (name || '').toLowerCase();
    const t = (type || '').toLowerCase();
    if (n.startsWith('vlan') || t.includes('vlan')) return 'VLAN';
    if (n.startsWith('br') || n.startsWith('bridge') || t.includes('bridge')) return 'Bridge';
    if (n.startsWith('lo') || t.includes('loopback')) return 'Loopback';
    if (n.startsWith('gre') || t.includes('gre')) return 'GRE';
    if (n.startsWith('tun') || n.startsWith('tap') || t.includes('tunnel')) return 'Tunnel';
    if (n.startsWith('eoip') || t.includes('eoip')) return 'EoIP';
    if (n.startsWith('bond') || t.includes('bond') || t.includes('aggregate')) return 'Bond';
    if (n.startsWith('wg') || t.includes('wireguard')) return 'WireGuard';
    if (n.startsWith('vxlan') || t.includes('vxlan')) return 'VXLAN';
    return 'Virtual';
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="port-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-base-100 border border-base-content/15 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-scaleIn my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-base-content/10 flex items-center justify-between gap-3 bg-base-200/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Network className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="port-modal-title" className="text-base sm:text-lg font-bold text-base-content truncate flex items-center gap-2">
                <span>Network Ports &amp; Interfaces</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-base-300 font-mono text-base-content/70 font-normal">
                  {hostname || ip}
                </span>
              </h3>
              <p className="text-xs text-base-content/50 truncate">
                IP: {ip} • Type: {deviceType} • {isRouter ? `${totalPorts} physical ports, ${virtualPorts.length} virtual interfaces${pppSessions.length > 0 ? `, ${pppSessions.length} dial-in sessions` : ''}` : `${totalPorts} ports detected`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls: Availability & Filter Tabs */}
        <div className="p-4 sm:p-5 border-b border-base-content/10 space-y-3 bg-base-200/10 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-base-200 border border-base-content/10 font-bold text-base-content">
                Total: {totalPorts} Ports
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {upCount} Up
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {downCount} Down
              </span>
            </div>
            <div className="text-xs font-mono text-base-content/70">
              <span>Port Link Availability: </span>
              <span className="font-bold text-emerald-500">{upRatio}%</span> ({upCount}/{totalPorts} online)
            </div>
          </div>

          <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${upRatio}%` }} />
            <div className="h-full bg-rose-500/60 transition-all duration-300" style={{ width: `${100 - upRatio}%` }} />
          </div>

          {/* Router Sub-Tabs */}
          {isRouter && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-base-content/10">
              <div className="flex flex-wrap items-center gap-1.5 bg-base-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRouterInterfaceTab('physical')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    routerInterfaceTab === 'physical'
                      ? 'bg-primary text-primary-content shadow-xs'
                      : 'hover:bg-base-300 text-base-content/70'
                  }`}
                >
                  <span>Physical Ports</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      routerInterfaceTab === 'physical'
                        ? 'bg-primary-content/20 text-primary-content'
                        : 'bg-base-300 text-base-content/60'
                    }`}
                  >
                    {totalPorts}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRouterInterfaceTab('virtual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    routerInterfaceTab === 'virtual'
                      ? 'bg-primary text-primary-content shadow-xs'
                      : 'hover:bg-base-300 text-base-content/70'
                  }`}
                >
                  <span>Virtual / VLAN</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      routerInterfaceTab === 'virtual'
                        ? 'bg-primary-content/20 text-primary-content'
                        : 'bg-base-300 text-base-content/60'
                    }`}
                  >
                    {virtualPorts.length}
                  </span>
                </button>
                {pppSessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRouterInterfaceTab('ppp')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      routerInterfaceTab === 'ppp'
                        ? 'bg-primary text-primary-content shadow-xs'
                        : 'hover:bg-base-300 text-base-content/70'
                    }`}
                  >
                    <span>Dial-in Sessions (PPP)</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        routerInterfaceTab === 'ppp'
                          ? 'bg-primary-content/20 text-primary-content'
                          : 'bg-base-300 text-base-content/60'
                      }`}
                    >
                      {pppSessions.length}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Filter Status Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {(!isRouter || routerInterfaceTab === 'physical') && (
              <>
                <button
                  type="button"
                  onClick={() => setPortFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    portFilter === 'all'
                      ? 'bg-primary text-primary-content shadow-xs'
                      : 'bg-base-200/70 hover:bg-base-200 text-base-content/70'
                  }`}
                >
                  All Ports ({totalPorts})
                </button>
                <button
                  type="button"
                  onClick={() => setPortFilter('up')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    portFilter === 'up'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-base-200/70 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active Up ({upCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPortFilter('down')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    portFilter === 'down'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-base-200/70 hover:bg-rose-500/10 text-rose-500'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Down ({downCount})
                </button>
              </>
            )}

            {isRouter && routerInterfaceTab === 'virtual' && (
              <>
                <button
                  type="button"
                  onClick={() => setVirtualPortFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    virtualPortFilter === 'all'
                      ? 'bg-primary text-primary-content shadow-xs'
                      : 'bg-base-200/70 hover:bg-base-200 text-base-content/70'
                  }`}
                >
                  All ({virtualPorts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVirtualPortFilter('up')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    virtualPortFilter === 'up'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-base-200/70 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active Up ({virtualUpCount})
                </button>
                <button
                  type="button"
                  onClick={() => setVirtualPortFilter('down')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    virtualPortFilter === 'down'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-base-200/70 hover:bg-rose-500/10 text-rose-500'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Down ({virtualDownCount})
                </button>
              </>
            )}

            {isRouter && routerInterfaceTab === 'ppp' && (
              <>
                <button
                  type="button"
                  onClick={() => setPppSessionFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    pppSessionFilter === 'all'
                      ? 'bg-primary text-primary-content shadow-xs'
                      : 'bg-base-200/70 hover:bg-base-200 text-base-content/70'
                  }`}
                >
                  All ({pppSessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPppSessionFilter('up')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    pppSessionFilter === 'up'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-base-200/70 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active Up ({pppUpCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPppSessionFilter('down')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    pppSessionFilter === 'down'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-base-200/70 hover:bg-rose-500/10 text-rose-500'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Down ({pppDownCount})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Modal Body: Scrollable Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-3">
          {(!isRouter || routerInterfaceTab === 'physical') && (
            filteredPorts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredPorts.map((port) => {
                  const isUp = port.oper_status === 'up';
                  return (
                    <div
                      key={`modal-${port.name}-${port.index}`}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isUp
                          ? 'bg-emerald-500/[0.04] border-emerald-500/25 hover:border-emerald-500/40 shadow-2xs'
                          : 'bg-base-200/40 border-base-content/10 hover:border-base-content/20'
                      }`}
                      title={port.name}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isUp
                                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                                  : 'bg-rose-500/70'
                              }`}
                            />
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                                isUp
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {isUp ? 'UP' : 'DOWN'}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 bg-base-300/80 text-base-content/70 border border-base-content/10">
                            {(port.type || 'ethernet').toLowerCase() === 'sfp' ? 'SFP' : (port.type || 'ethernet').toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div
                            className="font-mono font-bold text-xs sm:text-sm text-base-content truncate leading-tight"
                            title={port.name}
                          >
                            {port.name}
                          </div>
                          {port.crc_errors !== null && port.crc_errors !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${
                                port.crc_errors > 0
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  : 'bg-base-200/80 text-base-content/60 border-base-content/10'
                              }`}
                              title={`CRC Errors: ${port.crc_errors.toLocaleString()}`}
                            >
                              CRC: {port.crc_errors.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-base-content/5">
                        <span className="text-base-content/50 uppercase text-[10px]">
                          {port.type || 'Ethernet'}
                        </span>
                        <span className={isUp ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-base-content/40'}>
                          {isUp ? formatPortSpeed(port.speed) : 'No Link'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-base-200/40 border border-base-content/10 text-center text-xs font-mono text-base-content/50">
                No ports match the selected filter.
              </div>
            )
          )}

          {isRouter && routerInterfaceTab === 'virtual' && (
            filteredVirtualPorts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredVirtualPorts.map((port) => {
                  const isUp = port.oper_status === 'up';
                  const typeLabel = getVirtualTypeLabel(port.type, port.name);
                  return (
                    <div
                      key={`modal-virt-${port.name}-${port.index}`}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isUp
                          ? 'bg-emerald-500/[0.04] border-emerald-500/25 hover:border-emerald-500/40 shadow-2xs'
                          : 'bg-base-200/40 border-base-content/10 hover:border-base-content/20'
                      }`}
                      title={port.name}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isUp
                                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                                  : 'bg-rose-500/70'
                              }`}
                            />
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                                isUp
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {isUp ? 'UP' : 'DOWN'}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 bg-base-300/80 text-base-content/70 border border-base-content/10">
                            {typeLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div
                            className="font-mono font-bold text-xs sm:text-sm text-base-content truncate leading-tight"
                            title={port.name}
                          >
                            {port.name}
                          </div>
                          {port.crc_errors !== null && port.crc_errors !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${
                                port.crc_errors > 0
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  : 'bg-base-200/80 text-base-content/60 border-base-content/10'
                              }`}
                              title={`CRC Errors: ${port.crc_errors.toLocaleString()}`}
                            >
                              CRC: {port.crc_errors.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-base-content/5">
                        <span className="text-base-content/50 uppercase text-[10px] font-medium">
                          {typeLabel}
                        </span>
                        <span className={isUp ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-base-content/40'}>
                          {isUp ? formatPortSpeed(port.speed) : 'No Link'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-base-200/40 border border-base-content/10 text-center text-xs font-mono text-base-content/50">
                No virtual interfaces match the selected filter.
              </div>
            )
          )}

          {isRouter && routerInterfaceTab === 'ppp' && (
            filteredPppSessions.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredPppSessions.map((port) => {
                  const isUp = port.oper_status === 'up';
                  return (
                    <div
                      key={`modal-ppp-${port.name}-${port.index}`}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isUp
                          ? 'bg-emerald-500/[0.04] border-emerald-500/25 hover:border-emerald-500/40 shadow-2xs'
                          : 'bg-base-200/40 border-base-content/10 hover:border-base-content/20'
                      }`}
                      title={port.name}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isUp
                                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                                  : 'bg-rose-500/70'
                              }`}
                            />
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                                isUp
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {isUp ? 'UP' : 'DOWN'}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 bg-sky-500/15 text-sky-500 border border-sky-500/30">
                            PPP
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div
                            className="font-mono font-bold text-xs sm:text-sm text-base-content truncate leading-tight"
                            title={port.name}
                          >
                            {port.name}
                          </div>
                          {port.crc_errors !== null && port.crc_errors !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${
                                port.crc_errors > 0
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  : 'bg-base-200/80 text-base-content/60 border-base-content/10'
                              }`}
                              title={`CRC Errors: ${port.crc_errors.toLocaleString()}`}
                            >
                              CRC: {port.crc_errors.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-base-content/5">
                        <span className="text-base-content/50 uppercase text-[10px] font-medium">
                          PPP Session
                        </span>
                        <span className={isUp ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-base-content/40'}>
                          {isUp ? formatPortSpeed(port.speed) : 'No Link'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-base-200/40 border border-base-content/10 text-center text-xs font-mono text-base-content/50">
                {pppSessions.length === 0
                  ? 'No active PPP/PPPoE dial-in sessions detected on this router.'
                  : 'No dial-in sessions match the selected filter.'}
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-base-content/10 flex items-center justify-between bg-base-200/30 shrink-0">
          <span className="text-xs font-mono text-base-content/50">
            Showing {
              (!isRouter || routerInterfaceTab === 'physical') 
                ? `${filteredPorts.length} of ${totalPorts} ports` 
                : routerInterfaceTab === 'virtual' 
                ? `${filteredVirtualPorts.length} of ${virtualPorts.length} virtual interfaces` 
                : `${filteredPppSessions.length} of ${pppSessions.length} PPP sessions`
            }
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-base-200 hover:bg-base-300 text-xs font-bold text-base-content transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

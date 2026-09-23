import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Plus, MapPin, Search } from 'lucide-react';
import { Datacenter } from '../types';

interface DatacenterDropdownProps {
  datacenters: Datacenter[];
  selectedId: string | number;
  onSelect: (dcId: string) => void;
  onOpenDcModal?: () => void;
  allowAll?: boolean;
  totalCount?: number;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const DatacenterDropdown: React.FC<DatacenterDropdownProps> = ({
  datacenters,
  selectedId,
  onSelect,
  onOpenDcModal,
  allowAll = false,
  totalCount,
  placeholder = 'Select Data Center',
  className = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedDc = datacenters.find((d) => String(d.id) === String(selectedId));

  const filteredDcs = datacenters.filter((dc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return dc.name.toLowerCase().includes(q) || dc.location.toLowerCase().includes(q);
  });

  return (
    <div ref={dropdownRef} className={`relative inline-block w-full ${className}`}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full rounded-xl border border-base-content/15 bg-base-200/80 hover:bg-base-200 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content font-medium flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-left ${
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm'
        } ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <Building2 className={`text-primary shrink-0 ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          {allowAll && (selectedId === 'all' || !selectedId) ? (
            <span className="font-semibold truncate">
              All Data Centers {totalCount !== undefined ? `(${totalCount})` : ''}
            </span>
          ) : selectedDc ? (
            <span className="truncate flex items-center gap-1.5">
              <span className="font-bold text-base-content">{selectedDc.name}</span>
              <span className="text-base-content/50 text-xs hidden sm:inline truncate">
                — {selectedDc.location}
              </span>
            </span>
          ) : (
            <span className="text-base-content/50 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`shrink-0 text-base-content/50 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : ''
          } ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
        />
      </button>

      {/* Solid Opaque Dropdown Container: Theme-Adaptive, z-50, shadow-2xl */}
      {isOpen && (
        <div 
          className="absolute left-0 top-full mt-1.5 w-full min-w-[260px] z-50 rounded-2xl bg-base-100 border border-base-content/15 shadow-2xl text-base-content overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Quick Filter inside Dropdown if multiple DCs */}
          {datacenters.length > 5 && (
            <div className="p-2 border-b border-base-content/10 bg-base-200/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter data centers..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-base-100 border border-base-content/20 text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-primary"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5" role="listbox">
            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onSelect('all');
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                  selectedId === 'all' || !selectedId
                    ? 'bg-primary text-primary-content font-bold shadow-xs'
                    : 'text-base-content hover:bg-base-200/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>All Data Centers {totalCount !== undefined ? `(${totalCount})` : ''}</span>
                </div>
                {(selectedId === 'all' || !selectedId) && <Check className="w-3.5 h-3.5" />}
              </button>
            )}

            {filteredDcs.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-base-content/50">
                No matching data centers found
              </div>
            ) : (
              filteredDcs.map((dc) => {
                const isSelected = String(selectedId) === String(dc.id);
                return (
                  <button
                    key={dc.id}
                    type="button"
                    onClick={() => {
                      onSelect(String(dc.id));
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors text-left ${
                      isSelected
                        ? 'bg-primary text-primary-content font-bold shadow-xs'
                        : 'text-base-content hover:bg-base-200/80'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-bold font-mono">
                        <span>{dc.name}</span>
                        {dc.nodeCount !== undefined && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? 'bg-primary-content/20 text-primary-content' : 'bg-base-200 text-base-content/60'
                          }`}>
                            {dc.nodeCount} nodes
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 text-[11px] mt-0.5 truncate ${
                        isSelected ? 'text-primary-content/80' : 'text-base-content/60'
                      }`}>
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dc.location}</span>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 shrink-0 text-primary-content ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Action: + Add New DC */}
          {onOpenDcModal && (
            <div className="p-2 border-t border-base-content/10 bg-base-200/50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenDcModal();
                }}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Data Center</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

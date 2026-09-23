import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Trash2, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Server,
  Layers,
  Search
} from 'lucide-react';
import { Datacenter } from '../types';

interface DatacenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  datacenters: Datacenter[];
  onAddDatacenter: (dc: Datacenter) => void;
  onDeleteDatacenter: (id: string | number) => void;
}

export const DatacenterModal: React.FC<DatacenterModalProps> = ({
  isOpen,
  onClose,
  datacenters,
  onAddDatacenter,
  onDeleteDatacenter,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      setAlert({ type: 'error', message: 'Both Data Center Name and Location are required.' });
      return;
    }

    const cleanName = name.trim();
    const cleanLoc = location.trim();

    // Check duplicate
    if (datacenters.some((dc) => dc.name.toLowerCase() === cleanName.toLowerCase())) {
      setAlert({ type: 'error', message: `A Data Center named "${cleanName}" already exists.` });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const res = await fetch('/api/datacenters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, location: cleanLoc }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdDc: Datacenter = data.datacenter || {
          id: `dc-${Date.now()}`,
          name: cleanName,
          location: cleanLoc,
          nodeCount: 0,
        };
        onAddDatacenter(createdDc);
        setName('');
        setLocation('');
        setAlert({ type: 'success', message: `Data Center "${cleanName}" created successfully!` });
      } else {
        const err = await res.json();
        setAlert({ type: 'error', message: err.message || 'Failed to create Data Center.' });
      }
    } catch {
      // Local fallback
      const fallbackDc: Datacenter = {
        id: `dc-${Date.now()}`,
        name: cleanName,
        location: cleanLoc,
        nodeCount: 0,
      };
      onAddDatacenter(fallbackDc);
      setName('');
      setLocation('');
      setAlert({ type: 'success', message: `Data Center "${cleanName}" added successfully!` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string | number, dcName: string) => {
    if (!window.confirm(`Are you sure you want to delete Data Center "${dcName}"? Nodes assigned to this DC will be unassigned.`)) {
      return;
    }

    setDeletingId(id);
    setAlert(null);

    try {
      await fetch(`/api/datacenters/${id}`, { method: 'DELETE' });
      onDeleteDatacenter(id);
      setAlert({ type: 'success', message: `Data Center "${dcName}" deleted successfully.` });
    } catch {
      onDeleteDatacenter(id);
      setAlert({ type: 'success', message: `Data Center "${dcName}" deleted.` });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDcs = datacenters.filter((dc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return dc.name.toLowerCase().includes(q) || dc.location.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-base-100 rounded-2xl shadow-2xl border border-base-content/10 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-content/10 flex items-center justify-between bg-base-200/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                <span>Data Center Fleet Management</span>
                <span className="badge badge-primary badge-sm font-mono font-bold">
                  {datacenters.length} Active
                </span>
              </h3>
              <p className="text-xs text-base-content/60">
                Manage data center clusters, regional zones, and hardware rack assignments.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-base-content"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alert message if any */}
        {alert && (
          <div className="px-6 pt-3">
            <div className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
              alert.type === 'success' 
                ? 'bg-success/15 border border-success/30 text-success' 
                : 'bg-error/15 border border-error/30 text-error'
            }`}>
              {alert.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{alert.message}</span>
            </div>
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Add Data Center Form */}
          <div className="p-4 rounded-xl bg-base-200/40 border border-base-content/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/70 mb-3 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Register New Data Center</span>
            </h4>

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-base-content/70 mb-1 block">
                  DC Identifier / Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. DC-US-Central"
                    className="input input-sm input-bordered w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-base-content/70 mb-1 block">
                  Geographic Location *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Chicago, IL (ORD-1)"
                    className="input input-sm input-bordered w-full text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary btn-sm w-full gap-1 text-xs"
                >
                  {isLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add DC</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Data Centers List */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Active Facilities ({filteredDcs.length})</span>
              </h4>

              {/* Search Bar */}
              <div className="relative w-48 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter DC or region..."
                  className="input input-xs input-bordered w-full pl-8 text-[11px]"
                />
              </div>
            </div>

            <div className="border border-base-content/10 rounded-xl overflow-hidden divide-y divide-base-content/10 bg-base-100">
              {filteredDcs.length === 0 ? (
                <div className="p-8 text-center text-xs text-base-content/50">
                  No data centers matching your search.
                </div>
              ) : (
                filteredDcs.map((dc) => (
                  <div
                    key={dc.id}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-base-200/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-base-200 border border-base-content/10 flex items-center justify-center text-base-content/70 shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-base-content truncate">
                            {dc.name}
                          </span>
                          <span className="badge badge-ghost badge-xs font-mono">
                            ID: {dc.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-base-content/60 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-base-content/40 shrink-0" />
                          <span className="truncate">{dc.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-base-content/70 bg-base-200/80 px-2 py-1 rounded-md border border-base-content/10">
                        <Server className="w-3 h-3 text-primary" />
                        <span className="font-semibold">{dc.nodeCount ?? 0}</span>
                        <span className="text-[10px] text-base-content/50">nodes</span>
                      </div>

                      <button
                        onClick={() => handleDelete(dc.id, dc.name)}
                        disabled={deletingId === dc.id}
                        className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
                        title="Delete Data Center"
                      >
                        {deletingId === dc.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-base-content/10 bg-base-200/40 flex items-center justify-between text-xs text-base-content/60">
          <span>SQL table: <code className="font-mono text-primary font-semibold">datacenters</code> (FK: <code className="font-mono">servers_info.datacenter_id</code>)</span>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

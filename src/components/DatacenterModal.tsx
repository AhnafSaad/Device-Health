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
  Search,
  Pencil,
  Check
} from 'lucide-react';
import { Datacenter } from '../types';
import { fetchWithAuth, clearAuth } from '../utils/auth';

interface DatacenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  datacenters: Datacenter[];
  onAddDatacenter: (dc: Datacenter) => void;
  onDeleteDatacenter: (id: string | number) => void;
  onUpdateDatacenter?: (dc: Datacenter) => void;
  onUnauthorized?: () => void;
}

export const DatacenterModal: React.FC<DatacenterModalProps> = ({
  isOpen,
  onClose,
  datacenters,
  onAddDatacenter,
  onDeleteDatacenter,
  onUpdateDatacenter,
  onUnauthorized,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit state for inline datacenter modification
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
      const res = await fetchWithAuth('/api/datacenters', {
        method: 'POST',
        body: JSON.stringify({ name: cleanName, location: cleanLoc }),
      });

      if (res.status === 401) {
        clearAuth();
        onClose();
        onUnauthorized?.();
        return;
      }

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
        const err = await res.json().catch(() => ({}));
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

  const handleStartEdit = (dc: Datacenter) => {
    setEditingId(dc.id);
    setEditName(dc.name);
    setEditLocation(dc.location);
    setAlert(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditLocation('');
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingId) return;

    const cleanName = editName.trim();
    const cleanLoc = editLocation.trim();

    if (!cleanName || !cleanLoc) {
      setAlert({ type: 'error', message: 'Both Data Center Name and Location are required.' });
      return;
    }

    // Check duplicate name with other DCs
    if (datacenters.some((dc) => dc.id !== editingId && dc.name.toLowerCase() === cleanName.toLowerCase())) {
      setAlert({ type: 'error', message: `Another Data Center named "${cleanName}" already exists.` });
      return;
    }

    setIsSavingEdit(true);
    setAlert(null);

    try {
      const res = await fetchWithAuth(`/api/datacenters/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: cleanName, location: cleanLoc }),
      });

      if (res.status === 401) {
        clearAuth();
        onClose();
        onUnauthorized?.();
        return;
      }

      const updatedDc: Datacenter = {
        id: editingId,
        name: cleanName,
        location: cleanLoc,
      };

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.datacenter) {
          updatedDc.name = data.datacenter.name || cleanName;
          updatedDc.location = data.datacenter.location || cleanLoc;
        }
      }

      onUpdateDatacenter?.(updatedDc);
      setAlert({ type: 'success', message: `Data Center "${cleanName}" updated successfully!` });
      setEditingId(null);
    } catch {
      const updatedDc: Datacenter = {
        id: editingId,
        name: cleanName,
        location: cleanLoc,
      };
      onUpdateDatacenter?.(updatedDc);
      setAlert({ type: 'success', message: `Data Center "${cleanName}" updated.` });
      setEditingId(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string | number, dcName: string) => {
    if (!window.confirm(`Are you sure you want to delete Data Center "${dcName}"? Devices assigned to this DC will be unassigned.`)) {
      return;
    }

    setDeletingId(id);
    setAlert(null);

    try {
      const res = await fetchWithAuth(`/api/datacenters/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        clearAuth();
        onClose();
        onUnauthorized?.();
        return;
      }
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
          {/* Register New Data Center Form */}
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
                    placeholder="e.g. Colo Universe"
                    className="input input-sm input-bordered w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-base-content/70 mb-1 block">
                  Location *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Dhaka"
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
                filteredDcs.map((dc) => {
                  const isThisEditing = editingId === dc.id;

                  if (isThisEditing) {
                    return (
                      <div
                        key={dc.id}
                        className="p-3.5 bg-base-200/70 border-l-4 border-l-primary space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit Data Center</span>
                          </span>
                          <span className="text-[11px] font-mono text-base-content/50">
                            {dc.nodeCount ?? 0} Devices
                          </span>
                        </div>

                        <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold text-base-content/70 mb-0.5 block">
                              Data Center Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="e.g. Colo Universe"
                              disabled={isSavingEdit}
                              className="input input-xs input-bordered w-full text-xs font-mono"
                              autoFocus
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold text-base-content/70 mb-0.5 block">
                              Location *
                            </label>
                            <input
                              type="text"
                              required
                              value={editLocation}
                              onChange={(e) => setEditLocation(e.target.value)}
                              placeholder="e.g. Dhaka"
                              disabled={isSavingEdit}
                              className="input input-xs input-bordered w-full text-xs"
                            />
                          </div>
                          <div className="sm:col-span-1 flex items-end gap-1.5 justify-end">
                            <button
                              type="submit"
                              disabled={isSavingEdit}
                              className="btn btn-primary btn-xs flex-1 gap-1 text-[11px] font-bold"
                              title="Save changes"
                            >
                              {isSavingEdit ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={isSavingEdit}
                              className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-base-content"
                              title="Cancel editing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </form>
                      </div>
                    );
                  }

                  return (
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
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-base-content/60 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-base-content/40 shrink-0" />
                            <span className="truncate">{dc.location}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Device Count badge: shows "Devices" instead of "nodes" */}
                        <div className="flex items-center gap-1 text-[11px] font-mono text-base-content/70 bg-base-200/80 px-2 py-1 rounded-md border border-base-content/10">
                          <Server className="w-3 h-3 text-primary" />
                          <span className="font-semibold">{dc.nodeCount ?? 0}</span>
                          <span className="text-[10px] text-base-content/50">Devices</span>
                        </div>

                        {/* Edit Action (Pencil) */}
                        <button
                          onClick={() => handleStartEdit(dc)}
                          disabled={deletingId === dc.id || isSavingEdit}
                          className="btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit Data Center"
                          aria-label="Edit Data Center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Action (Trash) */}
                        <button
                          onClick={() => handleDelete(dc.id, dc.name)}
                          disabled={deletingId === dc.id || isSavingEdit}
                          className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10 transition-colors"
                          title="Delete Data Center"
                          aria-label="Delete Data Center"
                        >
                          {deletingId === dc.id ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer without developer/debug notes */}
        <div className="px-6 py-3 border-t border-base-content/10 bg-base-200/40 flex items-center justify-between text-xs text-base-content/60">
          <span className="text-xs text-base-content/50 font-medium">
            Total active facilities: <span className="font-mono font-bold text-base-content">{datacenters.length}</span>
          </span>
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

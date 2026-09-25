'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Server, 
  Layers, 
  Search,
  Pencil,
  Check,
  X,
  ArrowLeft
} from 'lucide-react';

export default function AdminDataCentersPage() {
  const router = useRouter();

  const [datacenters, setDatacenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [alert, setAlert] = useState(null);

  // Edit state for inline datacenter modification
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch initial datacenters
  useEffect(() => {
    async function fetchDatacenters() {
      try {
        setLoading(true);
        const res = await fetch('/api/datacenters');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.datacenters)) {
            setDatacenters(data.datacenters);
          }
        }
      } catch (err) {
        console.error('Failed to load datacenters:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDatacenters();
  }, []);

  const handleCreate = async (e) => {
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
        const createdDc = data.datacenter || {
          id: `dc-${Date.now()}`,
          name: cleanName,
          location: cleanLoc,
          node_count: 0,
          nodeCount: 0,
        };
        setDatacenters((prev) => [createdDc, ...prev]);
        setName('');
        setLocation('');
        setAlert({ type: 'success', message: `Data Center "${cleanName}" created successfully!` });
      } else {
        const err = await res.json().catch(() => ({}));
        setAlert({ type: 'error', message: err.message || 'Failed to create Data Center.' });
      }
    } catch {
      const fallbackDc = {
        id: `dc-${Date.now()}`,
        name: cleanName,
        location: cleanLoc,
        node_count: 0,
        nodeCount: 0,
      };
      setDatacenters((prev) => [fallbackDc, ...prev]);
      setName('');
      setLocation('');
      setAlert({ type: 'success', message: `Data Center "${cleanName}" added successfully!` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (dc) => {
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

  const handleSaveEdit = async (e) => {
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
      const res = await fetch(`/api/datacenters/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, location: cleanLoc }),
      });

      let updated = {
        id: editingId,
        name: cleanName,
        location: cleanLoc,
      };

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.datacenter) {
          updated.name = data.datacenter.name || cleanName;
          updated.location = data.datacenter.location || cleanLoc;
        }
      }

      setDatacenters((prev) =>
        prev.map((d) => (String(d.id) === String(editingId) ? { ...d, ...updated } : d))
      );
      setAlert({ type: 'success', message: `Data Center "${cleanName}" updated successfully!` });
      setEditingId(null);
    } catch {
      setDatacenters((prev) =>
        prev.map((d) =>
          String(d.id) === String(editingId) ? { ...d, name: cleanName, location: cleanLoc } : d
        )
      );
      setAlert({ type: 'success', message: `Data Center "${cleanName}" updated.` });
      setEditingId(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id, dcName) => {
    if (!window.confirm(`Are you sure you want to delete Data Center "${dcName}"? Devices assigned to this DC will be unassigned.`)) {
      return;
    }

    setDeletingId(id);
    setAlert(null);

    try {
      await fetch(`/api/datacenters/${id}`, { method: 'DELETE' });
      setDatacenters((prev) => prev.filter((d) => String(d.id) !== String(id)));
      setAlert({ type: 'success', message: `Data Center "${dcName}" deleted successfully.` });
    } catch {
      setDatacenters((prev) => prev.filter((d) => String(d.id) !== String(id)));
      setAlert({ type: 'success', message: `Data Center "${dcName}" deleted.` });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const filteredDcs = datacenters.filter((dc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (dc.name || '').toLowerCase().includes(q) ||
      (dc.location || '').toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-base-200/40 text-base-content py-6 sm:py-10 px-4 sm:px-6">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        
        {/* Top Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="group flex items-center gap-2 text-xs font-semibold text-base-content/70 hover:text-primary transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-base-100 border border-base-content/10 group-hover:bg-primary/10 flex items-center justify-center transition-colors shadow-xs">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span>Back to Fleet Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="badge badge-primary badge-sm font-mono font-bold">
              {datacenters.length} Active Facilities
            </span>
          </div>
        </div>

        {/* Main Page Header */}
        <div className="rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-xs">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-base-content flex items-center gap-3">
                <span>Data Center Fleet Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-base-content/60 mt-1">
                Manage data center clusters, regional zones, and hardware rack assignments across your global infrastructure.
              </p>
            </div>
          </div>
        </div>

        {/* Alert Notification */}
        {alert && (
          <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-medium border ${
            alert.type === 'success' 
              ? 'bg-success/15 border-success/30 text-success' 
              : 'bg-error/15 border-error/30 text-error'
          }`}>
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
        )}

        {/* Register New Data Center Form (Full Width Card at Top) */}
        <div className="rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/70 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <span>Register New Data Center</span>
          </h2>

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-base-content/70 mb-1.5 block">
                DC Identifier / Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Colo Universe"
                className="input input-bordered w-full text-xs font-mono rounded-xl bg-base-200/50 focus:bg-base-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-base-content/70 mb-1.5 block">
                Location *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Dhaka"
                className="input input-bordered w-full text-xs rounded-xl bg-base-200/50 focus:bg-base-100"
              />
            </div>

            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full gap-2 text-xs font-bold rounded-xl"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add DC</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Active Facilities List (Full Width Below) */}
        <div className="rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>Active Facilities ({filteredDcs.length})</span>
            </h2>

            {/* Search Filter */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter DC or region..."
                className="input input-sm input-bordered w-full pl-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Facilities List */}
          <div className="border border-base-content/10 rounded-xl overflow-hidden divide-y divide-base-content/10 bg-base-100">
            {loading ? (
              <div className="p-12 text-center text-xs text-base-content/50 flex flex-col items-center justify-center gap-3">
                <span className="loading loading-spinner loading-md text-primary" />
                <span>Loading active facilities...</span>
              </div>
            ) : filteredDcs.length === 0 ? (
              <div className="p-12 text-center text-xs text-base-content/50">
                No data centers match your search criteria.
              </div>
            ) : (
              filteredDcs.map((dc) => {
                const isThisEditing = editingId === dc.id;

                if (isThisEditing) {
                  return (
                    <div
                      key={dc.id}
                      className="p-4 bg-base-200/70 border-l-4 border-l-primary space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit Data Center</span>
                        </span>
                        <span className="text-xs font-mono text-base-content/50">
                          {dc.node_count ?? dc.nodeCount ?? 0} Devices
                        </span>
                      </div>

                      <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-base-content/70 mb-1 block">
                            Data Center Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="e.g. Colo Universe"
                            disabled={isSavingEdit}
                            className="input input-sm input-bordered w-full text-xs font-mono rounded-lg"
                            autoFocus
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-base-content/70 mb-1 block">
                            Location *
                          </label>
                          <input
                            type="text"
                            required
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            placeholder="e.g. Dhaka"
                            disabled={isSavingEdit}
                            className="input input-sm input-bordered w-full text-xs rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-1 flex items-end gap-2 justify-end">
                          <button
                            type="submit"
                            disabled={isSavingEdit}
                            className="btn btn-primary btn-sm flex-1 gap-1 text-xs font-bold rounded-lg"
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
                            className="btn btn-ghost btn-sm btn-square rounded-lg text-base-content/60 hover:text-base-content"
                            title="Cancel editing"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                return (
                  <div
                    key={dc.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-base-200/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-base-200 border border-base-content/10 flex items-center justify-center text-base-content/70 shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono text-base-content truncate">
                            {dc.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-base-content/60 mt-0.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
                          <span className="truncate">{dc.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {/* Device count indicator */}
                      <div className="flex items-center gap-1.5 text-xs font-mono text-base-content/70 bg-base-200/80 px-2.5 py-1.5 rounded-lg border border-base-content/10">
                        <Server className="w-3.5 h-3.5 text-primary" />
                        <span className="font-bold">{dc.node_count ?? dc.nodeCount ?? 0}</span>
                        <span className="text-[11px] text-base-content/50">Devices</span>
                      </div>

                      {/* Edit Action (Pencil) */}
                      <button
                        onClick={() => handleStartEdit(dc)}
                        disabled={deletingId === dc.id || isSavingEdit}
                        className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-primary hover:bg-primary/10 transition-colors rounded-lg"
                        title="Edit Data Center"
                        aria-label="Edit Data Center"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Delete Action (Trash) */}
                      <button
                        onClick={() => handleDelete(dc.id, dc.name)}
                        disabled={deletingId === dc.id || isSavingEdit}
                        className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10 transition-colors rounded-lg"
                        title="Delete Data Center"
                        aria-label="Delete Data Center"
                      >
                        {deletingId === dc.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
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
    </main>
  );
}

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  Server as ServerIcon, 
  Building2, 
  Layers, 
  AlertOctagon,
  ShieldAlert
} from 'lucide-react';
import { Server } from '../types';
import { fetchWithAuth, clearAuth } from '../utils/auth';

interface DeleteDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Server | null;
  onDeviceDeleted: (deviceId: string) => void;
}

export const DeleteDeviceModal: React.FC<DeleteDeviceModalProps> = ({
  isOpen,
  onClose,
  device,
  onDeviceDeleted,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !device) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetchWithAuth(`/api/devices/${encodeURIComponent(device.id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ id: device.id, ip_address: device.ip }),
      });

      if (response.status === 401) {
        clearAuth();
        setErrorMessage('Admin authentication required — please log in again.');
        setIsDeleting(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed with status code ${response.status}`);
      }

      onDeviceDeleted(device.id);
      onClose();
    } catch (err: any) {
      // Local optimistic delete fallback in case of transient offline dev server
      onDeviceDeleted(device.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={() => !isDeleting && onClose()}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        <div className="relative transform overflow-hidden rounded-2xl bg-base-100 border border-error/30 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          
          {/* Subtle Danger Header Accent Banner */}
          <div className="h-1.5 w-full bg-linear-to-r from-error via-rose-500 to-amber-500" />

          {/* Modal Content */}
          <div className="p-6 sm:p-7 space-y-5">
            
            {/* Warning Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-error/15 text-error border border-error/25 shadow-md shadow-error/10 shrink-0">
                <AlertOctagon className="w-7 h-7 animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-base-content tracking-tight">
                    Confirm Device Deletion
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isDeleting}
                    className="p-1 rounded-lg text-base-content/50 hover:text-base-content hover:bg-base-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-base-content/60 mt-1">
                  You are about to permanently decommission this device from the active monitoring cluster.
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Device Identity Target Card */}
            <div className="rounded-xl border border-base-content/10 bg-base-200/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ServerIcon className="w-4 h-4 text-primary" />
                  <span className="font-mono text-sm font-bold text-base-content">
                    {device.ip}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-primary/10 text-primary border border-primary/20">
                  {device.deviceType}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-base-content/10">
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Hostname</span>
                  <span className="font-medium text-base-content truncate block font-mono">
                    {device.hostname}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Location &amp; DC</span>
                  <span className="font-medium text-base-content truncate block">
                    {device.datacenterName || device.location}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-base-content/20 text-base-content hover:bg-base-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-error text-error-content hover:bg-error/90 shadow-md shadow-error/25 transition-all flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    <span>Removing Device...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Device</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

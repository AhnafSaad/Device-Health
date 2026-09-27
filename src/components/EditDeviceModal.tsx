import React, { useState, useEffect } from 'react';
import { 
  X, 
  Server as ServerIcon, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  MapPin, 
  Radio, 
  Cpu, 
  Terminal,
  Layers,
  Edit3,
  Tag
} from 'lucide-react';
import { Server, Datacenter, DeviceType, DeviceBrand, BRAND_OPTIONS } from '../types';
import { BrandLogo } from './BrandLogo';
import { fetchWithAuth, clearAuth } from '../utils/auth';

interface EditDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Server | null;
  datacenters: Datacenter[];
  onDeviceUpdated: (updatedServer: Server) => void;
  existingIps: string[];
}

export const EditDeviceModal: React.FC<EditDeviceModalProps> = ({
  isOpen,
  onClose,
  device,
  datacenters,
  onDeviceUpdated,
  existingIps,
}) => {
  const [ip, setIp] = useState('');
  const [hostname, setHostname] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('Server');
  const [brand, setBrand] = useState<string>('Other');
  const [datacenterId, setDatacenterId] = useState<string>('');
  const [location, setLocation] = useState('');
  const [rackNumber, setRackNumber] = useState('');
  const [snmpCommunity, setSnmpCommunity] = useState('public');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-fill form when device changes or modal opens
  useEffect(() => {
    if (device && isOpen) {
      setIp(device.ip || '');
      setHostname(device.hostname || '');
      setDeviceType((device.deviceType as DeviceType) || 'Server');
      setBrand((device.brand as string) || 'Other');
      setDatacenterId(device.datacenterId ? String(device.datacenterId) : '');
      setLocation(device.location || '');
      setRackNumber(device.rackNumber || '');
      setSnmpCommunity(device.snmpCommunity || 'public');
      setErrorMessage(null);
    }
  }, [device, isOpen]);

  if (!isOpen || !device) return null;

  // Handle datacenter change to automatically update default location
  const handleDatacenterChange = (dcId: string) => {
    setDatacenterId(dcId);
    if (dcId) {
      const selectedDc = datacenters.find((d) => String(d.id) === String(dcId));
      if (selectedDc && (!location || location === device.location)) {
        setLocation(selectedDc.location);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    const cleanIp = ip.trim();
    const cleanHost = hostname.trim();
    const cleanLocation = location.trim();
    const cleanRack = rackNumber.trim();
    const cleanCommunity = snmpCommunity.trim();

    if (!cleanIp) {
      setErrorMessage('IP Address is required.');
      return;
    }

    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(cleanIp)) {
      setErrorMessage(`"${cleanIp}" is not a valid IPv4 address.`);
      return;
    }

    // Check IP collision with other devices
    if (cleanIp !== device.ip && existingIps.includes(cleanIp)) {
      setErrorMessage(`Another device with IP address ${cleanIp} already exists.`);
      return;
    }

    if (!cleanHost) {
      setErrorMessage('Hostname is required.');
      return;
    }

    setIsSubmitting(true);

    const selectedDc = datacenters.find((d) => String(d.id) === String(datacenterId));
    const resolvedDcName = selectedDc ? selectedDc.name : device.datacenterName;

    const payload = {
      id: device.id,
      ip_address: cleanIp,
      ip: cleanIp,
      hostname: cleanHost,
      device_type: deviceType,
      deviceType,
      brand,
      datacenter_id: datacenterId || undefined,
      datacenterId: datacenterId || undefined,
      datacenter_name: resolvedDcName,
      datacenterName: resolvedDcName,
      location: cleanLocation || (selectedDc?.location ?? 'Local Datacenter'),
      rack_number: cleanRack || 'Unassigned',
      snmp_community: cleanCommunity || 'public',
      status: device.status,
      health: device.health,
    };

    try {
      const response = await fetchWithAuth(`/api/devices/${encodeURIComponent(device.id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        clearAuth();
        setErrorMessage('Admin authentication required — please log in again.');
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server responded with status ${response.status}`);
      }

      const result = await response.json();
      const updatedFromServer = result.device;

      const mergedServer: Server = {
        ...device,
        ip: cleanIp,
        hostname: cleanHost,
        deviceType,
        brand,
        datacenterId: datacenterId || undefined,
        datacenterName: resolvedDcName,
        location: cleanLocation || (selectedDc?.location ?? device.location),
        rackNumber: cleanRack || device.rackNumber,
        snmpCommunity: cleanCommunity,
        ...(updatedFromServer ? {
          ip: updatedFromServer.ip_address || updatedFromServer.ip || cleanIp,
          hostname: updatedFromServer.hostname || cleanHost,
          deviceType: updatedFromServer.device_type || updatedFromServer.deviceType || deviceType,
          brand: updatedFromServer.brand !== undefined ? updatedFromServer.brand : brand,
          datacenterId: updatedFromServer.datacenter_id || updatedFromServer.datacenterId || datacenterId,
          datacenterName: updatedFromServer.datacenter_name || updatedFromServer.datacenterName || resolvedDcName,
          location: updatedFromServer.location || cleanLocation,
          rackNumber: updatedFromServer.rack_number || updatedFromServer.rackNumber || cleanRack,
          snmpCommunity: updatedFromServer.snmp_community || updatedFromServer.snmpCommunity || cleanCommunity,
        } : {}),
      };

      onDeviceUpdated(mergedServer);
      onClose();
    } catch (err: any) {
      // Optimistic local update with warning banner
      const localUpdated: Server = {
        ...device,
        ip: cleanIp,
        hostname: cleanHost,
        deviceType,
        brand,
        datacenterId: datacenterId || undefined,
        datacenterName: resolvedDcName,
        location: cleanLocation || (selectedDc?.location ?? device.location),
        rackNumber: cleanRack || device.rackNumber,
        snmpCommunity: cleanCommunity,
      };
      onDeviceUpdated(localUpdated);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        <div className="relative transform overflow-hidden rounded-2xl bg-base-100 border border-base-content/10 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-xl">
          
          {/* Modal Header */}
          <div className="p-5 sm:p-6 border-b border-base-content/10 bg-base-100/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-base-content flex items-center gap-2">
                  <span>Edit Device Configuration</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-base-200 border border-base-content/10 text-base-content/70">
                    {device.id}
                  </span>
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Update device telemetry identity, datacenter allocation, and hardware metadata.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-base-content/50 hover:text-base-content hover:bg-base-200 transition-colors"
              aria-label="Close edit dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            
            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/25 text-error text-xs flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Row 1: IP Address and Hostname */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/70 mb-1.5">
                  IP Address <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="e.g. 192.168.1.10"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none"
                  />
                </div>
                <p className="text-[10px] text-base-content/50 mt-1">Must be a valid IPv4 address.</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/70 mb-1.5">
                  Hostname <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder="e.g. srv-app-core-01"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none"
                  />
                </div>
                <p className="text-[10px] text-base-content/50 mt-1">Unique cluster DNS/FQDN moniker.</p>
              </div>
            </div>

            {/* Row 2: Device Type and Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/70 mb-1.5">
                  Device Architecture Type
                </label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none"
                >
                  <option value="Server">Server (Compute / Database)</option>
                  <option value="Router">Router (Gateway / BGP / Firewall)</option>
                  <option value="Switch">Switch (Spine / Leaf / ToR)</option>
                  <option value="OLT">OLT (Fiber Access Chassis)</option>
                </select>
                <p className="text-[10px] text-base-content/50 mt-1">Hardware telemetry profile category.</p>
              </div>

              {/* Device Brand / Vendor Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-accent" />
                    <span>Device Brand / Vendor</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <BrandLogo brand={brand} size="xs" />
                    <span className="text-[10px] text-base-content/50 font-mono">{brand}</span>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none pr-9 font-semibold"
                  >
                    {BRAND_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 pointer-events-none flex items-center">
                    <BrandLogo brand={brand} size="sm" />
                  </div>
                </div>
                <p className="text-[10px] text-base-content/50 mt-1">Manual hardware vendor assignment.</p>
              </div>
            </div>

            {/* Row 3: Assigned Datacenter and Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/70 mb-1.5 flex items-center justify-between">
                  <span>Assigned Datacenter</span>
                  {datacenterId && (
                    <span className="text-[10px] font-normal text-primary">Connected</span>
                  )}
                </label>
                <select
                  value={datacenterId}
                  onChange={(e) => handleDatacenterChange(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none"
                >
                  <option value="">-- No Datacenter (Unassigned) --</option>
                  {datacenters.map((dc) => (
                    <option key={dc.id} value={String(dc.id)}>
                      {dc.name} ({dc.location})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-base-content/50 mt-1">Facility hosting this hardware device.</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/70 mb-1.5">
                  Geographic Location / Zone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. EU-Central (Frankfurt)"
                    disabled={isSubmitting}
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/70 mb-1.5">
                  Rack &amp; Elevation
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={rackNumber}
                    onChange={(e) => setRackNumber(e.target.value)}
                    placeholder="e.g. Rack F-02 (U10)"
                    disabled={isSubmitting}
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SNMP Community String */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/70 mb-1.5">
                SNMP Community String
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                  <Terminal className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={snmpCommunity}
                  onChange={(e) => setSnmpCommunity(e.target.value)}
                  placeholder="public"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-base-content/20 bg-base-200/50 focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 text-base-content transition-all outline-none"
                />
              </div>
              <p className="text-[10px] text-base-content/50 mt-1">Read-only SNMP community for Prometheus/Telegraf polling daemon.</p>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-base-content/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-base-content/20 text-base-content hover:bg-base-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-content hover:opacity-95 shadow-md shadow-primary/25 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

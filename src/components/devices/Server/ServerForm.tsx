import React from 'react';
import { Datacenter } from '../../../types';
import { FormSection, FormInput, CommunityInput } from '../shared/FormInputs';
import { DatacenterDropdown } from '../../DatacenterDropdown';
import { BrandLogo } from '../../BrandLogo';
import { Server as ServerIcon, Building2, MapPin, Tag, Key, Info } from 'lucide-react';

export interface ServerFormData {
  ip_address: string;
  brand: string;
  datacenter_id: string;
  location: string;
  rack_number: string;
  snmp_community: string;
  hostname?: string;
}

export interface ServerFormProps {
  formData: ServerFormData;
  onChange: (field: keyof ServerFormData, value: string) => void;
  datacenters: Datacenter[];
  onOpenDcModal?: () => void;
  onNavigateToDatacenters?: () => void;
  isEdit?: boolean;
  disabled?: boolean;
  errors?: Partial<Record<keyof ServerFormData, string>>;
}

export const SERVER_BRAND_OPTIONS = [
  'Dell',
  'HP',
  'Other',
];

export const ServerForm: React.FC<ServerFormProps> = ({
  formData,
  onChange,
  datacenters,
  onOpenDcModal,
  onNavigateToDatacenters,
  isEdit = false,
  disabled = false,
  errors = {},
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Server Identity & Brand */}
      <FormSection
        title="Server Identity & Manufacturer"
        description="Specify compute node hardware vendor and primary IP address"
        icon={<ServerIcon className="w-5 h-5" />}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-base-content/80">
            Hardware Vendor / Brand
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SERVER_BRAND_OPTIONS.map((brandName) => {
              const isSelected = formData.brand === brandName;
              return (
                <button
                  key={brandName}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange('brand', brandName)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary text-base-content font-bold shadow-xs'
                      : 'border-base-content/15 bg-base-100 hover:bg-base-200/50 text-base-content/80'
                  }`}
                >
                  <BrandLogo brand={brandName} size="sm" />
                  <span className="text-xs">{brandName}</span>
                </button>
              );
            })}
          </div>
        </div>

        <FormInput
          label="Server IPv4 Address"
          placeholder="192.168.1.50"
          value={formData.ip_address}
          onChange={(e) => onChange('ip_address', e.target.value)}
          error={errors.ip_address}
          required
          disabled={disabled}
          helperText="Primary host IP or BMC / IPMI out-of-band management interface"
        />

        {isEdit && (
          <FormInput
            label="Server Hostname"
            value={formData.hostname || ''}
            onChange={(e) => onChange('hostname', e.target.value)}
            disabled={disabled}
            helperText="Canonical hostname of this compute node"
          />
        )}
      </FormSection>

      {/* 2. SNMP Credentials */}
      <FormSection
        title="SNMP Telemetry Credentials"
        description="SNMPv2c community used for CPU, RAM ECC, and NVMe SMART storage telemetry"
        icon={<Key className="w-5 h-5" />}
      >
        <CommunityInput
          value={formData.snmp_community}
          onChange={(val) => onChange('snmp_community', val)}
          disabled={disabled}
        />
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-[11px] text-base-content/70 flex items-start gap-2">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            Ensure <span className="font-mono">snmpd</span> is listening on UDP port 161.
            Linux EDAC counters and smartctl disk extends are parsed automatically for NVMe lifecycle analysis.
          </span>
        </div>
      </FormSection>

      {/* 3. Placement */}
      <FormSection
        title="Datacenter & Rack Location"
        description="Assign server to physical facility and rack unit"
        icon={<Building2 className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-base-content/80">
              Data Center or Location
            </label>
            <DatacenterDropdown
              datacenters={datacenters}
              selectedId={formData.datacenter_id}
              onSelect={(dcId) => {
                const selected = datacenters.find((d) => String(d.id) === String(dcId));
                onChange('datacenter_id', dcId);
                if (selected) {
                  onChange('location', selected.location);
                }
              }}
              onOpenDcModal={onOpenDcModal || onNavigateToDatacenters}
            />
          </div>

          <FormInput
            label="Rack Position / Unit (Optional)"
            placeholder="e.g. Rack 01 (Optional)"
            value={formData.rack_number}
            onChange={(e) => onChange('rack_number', e.target.value)}
            icon={<Tag className="w-4 h-4" />}
            disabled={disabled}
            helperText="e.g. Rack 01 or Cabinet 04-U12 (Optional)"
          />
        </div>

        <FormInput
          label="Facility Location / City"
          placeholder="Global Datacenter"
          value={formData.location}
          onChange={(e) => onChange('location', e.target.value)}
          icon={<MapPin className="w-4 h-4" />}
          disabled={disabled}
          helperText="Geographic datacenter facility"
        />
      </FormSection>
    </div>
  );
};

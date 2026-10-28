import React from 'react';
import { Datacenter } from '../../../types';
import { FormSection, FormInput, CommunityInput } from '../shared/FormInputs';
import { DatacenterDropdown } from '../../DatacenterDropdown';
import { BrandLogo } from '../../BrandLogo';
import { Radio, Building2, MapPin, Tag, Key, Info } from 'lucide-react';

export interface RouterFormData {
  ip_address: string;
  brand: string;
  datacenter_id: string;
  location: string;
  rack_number: string;
  snmp_community: string;
  hostname?: string;
  software_id?: string;
}

export interface RouterFormProps {
  formData: RouterFormData;
  onChange: (field: keyof RouterFormData, value: string) => void;
  datacenters: Datacenter[];
  onOpenDcModal?: () => void;
  onNavigateToDatacenters?: () => void;
  isEdit?: boolean;
  disabled?: boolean;
  errors?: Partial<Record<keyof RouterFormData, string>>;
}

export const ROUTER_BRAND_OPTIONS = [
  'MikroTik',
  'Juniper',
  'Cisco',
  'Huawei',
  'Other',
];

export const RouterForm: React.FC<RouterFormProps> = ({
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
      {/* 1. Router Identity & Brand */}
      <FormSection
        title="Router Identity & Brand Profile"
        description="Specify edge gateway manufacturer and management IP"
        icon={<Radio className="w-5 h-5" />}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-base-content/80">
            Hardware Vendor / Brand
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ROUTER_BRAND_OPTIONS.map((brandName) => {
              const isSelected = formData.brand === brandName;
              return (
                <button
                  key={brandName}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange('brand', brandName)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500 text-base-content font-bold shadow-xs'
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
          label="Router IPv4 Address"
          placeholder="10.0.0.1"
          value={formData.ip_address}
          onChange={(e) => onChange('ip_address', e.target.value)}
          error={errors.ip_address}
          required
          disabled={disabled}
          helperText="Gateway address or loopback router management interface"
        />

        {isEdit && (
          <FormInput
            label="System Hostname / sysName"
            value={formData.hostname || ''}
            onChange={(e) => onChange('hostname', e.target.value)}
            disabled={disabled}
            helperText="System identity configured in RouterOS / Junos"
          />
        )}
      </FormSection>

      {/* 2. SNMP Polling Credentials */}
      <FormSection
        title="SNMP Telemetry Credentials"
        description="SNMP community used for dynamic storage, interfaces, and connected subscribers"
        icon={<Key className="w-5 h-5" />}
      >
        <CommunityInput
          value={formData.snmp_community}
          onChange={(val) => onChange('snmp_community', val)}
          disabled={disabled}
        />
        <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-[11px] text-base-content/70 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <span>
            For MikroTik RouterOS, ensure SNMP service is enabled under <span className="font-mono">/snmp set enabled=yes</span>.
            The poller automatically crawls <span className="font-mono">hrStorageDescr</span> to map dynamic memory and disk indices.
          </span>
        </div>
      </FormSection>

      {/* 3. Datacenter & Physical Placement */}
      <FormSection
        title="Datacenter & Rack Location"
        description="Assign this router to an edge facility and rack enclosure"
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
            label="Rack Number (Optional)"
            placeholder="e.g. Rack 01 (Optional)"
            value={formData.rack_number}
            onChange={(e) => onChange('rack_number', e.target.value)}
            icon={<Tag className="w-4 h-4" />}
            disabled={disabled}
            helperText="e.g. Core Rack 01 or Edge A-1 (Optional)"
          />
        </div>

        <FormInput
          label="Facility Location / City"
          placeholder="Global Datacenter"
          value={formData.location}
          onChange={(e) => onChange('location', e.target.value)}
          icon={<MapPin className="w-4 h-4" />}
          disabled={disabled}
          helperText="Geographic or PoP location"
        />
      </FormSection>
    </div>
  );
};

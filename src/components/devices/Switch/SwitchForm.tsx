import React from 'react';
import { Datacenter } from '../../../types';
import { FormSection, FormInput, CommunityInput } from '../shared/FormInputs';
import { DatacenterDropdown } from '../../DatacenterDropdown';
import { BrandLogo } from '../../BrandLogo';
import { Network, Building2, MapPin, Tag, Key, Info } from 'lucide-react';

export interface SwitchFormData {
  ip_address: string;
  brand: string;
  datacenter_id: string;
  location: string;
  rack_number: string;
  snmp_community: string;
  hostname?: string;
}

export interface SwitchFormProps {
  formData: SwitchFormData;
  onChange: (field: keyof SwitchFormData, value: string) => void;
  datacenters: Datacenter[];
  onOpenDcModal?: () => void;
  onNavigateToDatacenters?: () => void;
  isEdit?: boolean;
  disabled?: boolean;
  errors?: Partial<Record<keyof SwitchFormData, string>>;
}

export const SWITCH_BRAND_OPTIONS = [
  'Cisco',
  'Huawei',
  'Arista',
  'BDCOM',
  'TP-Link',
  'Other',
];

export const SwitchForm: React.FC<SwitchFormProps> = ({
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
      {/* 1. Switch Identity & Brand */}
      <FormSection
        title="Switch Identity & Brand Profile"
        description="Specify L2/L3 switch vendor profile and management IPv4 address"
        icon={<Network className="w-5 h-5" />}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-base-content/80">
            Hardware Vendor / Brand
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SWITCH_BRAND_OPTIONS.map((brandName) => {
              const isSelected = formData.brand === brandName;
              return (
                <button
                  key={brandName}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange('brand', brandName)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500 text-base-content font-bold shadow-xs'
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
          label="Management IPv4 Address"
          placeholder="172.16.0.2"
          value={formData.ip_address}
          onChange={(e) => onChange('ip_address', e.target.value)}
          error={errors.ip_address}
          required
          disabled={disabled}
          helperText="Out-of-band management interface or VLAN 1 management IP"
        />

        {isEdit && (
          <FormInput
            label="Switch Hostname"
            value={formData.hostname || ''}
            onChange={(e) => onChange('hostname', e.target.value)}
            disabled={disabled}
            helperText="Configured switch hostname"
          />
        )}
      </FormSection>

      {/* 2. SNMP Credentials */}
      <FormSection
        title="SNMP Telemetry Credentials"
        description="SNMPv2c read-only community used for optical DOM and interface status"
        icon={<Key className="w-5 h-5" />}
      >
        <CommunityInput
          value={formData.snmp_community}
          onChange={(val) => onChange('snmp_community', val)}
          disabled={disabled}
        />
        <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15 text-[11px] text-base-content/70 flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>
            For Cisco switches, ensure <span className="font-mono">snmp-server community [string] RO</span> is configured.
            Optical power (DOM/DDM) and entity sensor millidegrees are polled automatically.
          </span>
        </div>
      </FormSection>

      {/* 3. Physical Placement */}
      <FormSection
        title="Datacenter & Rack Placement"
        description="Assign the switch to an aggregation rack or top-of-rack leaf cabinet"
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
            helperText="e.g. ToR Rack 01 or Leaf A-2 (Optional)"
          />
        </div>

        <FormInput
          label="Facility Location / City"
          placeholder="Global Datacenter"
          value={formData.location}
          onChange={(e) => onChange('location', e.target.value)}
          icon={<MapPin className="w-4 h-4" />}
          disabled={disabled}
          helperText="Geographic or campus location"
        />
      </FormSection>
    </div>
  );
};

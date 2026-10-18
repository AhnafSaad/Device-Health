import React from 'react';
import { Datacenter } from '../../../types';
import { FormSection, FormInput, CommunityInput } from '../shared/FormInputs';
import { DatacenterDropdown } from '../../DatacenterDropdown';
import { BrandLogo } from '../../BrandLogo';
import { Layers, Building2, MapPin, Tag, Key, Info } from 'lucide-react';

export interface OLTFormData {
  ip_address: string;
  brand: string;
  datacenter_id: string;
  location: string;
  rack_number: string;
  snmp_community: string;
  hostname?: string;
}

export interface OLTFormProps {
  formData: OLTFormData;
  onChange: (field: keyof OLTFormData, value: string) => void;
  datacenters: Datacenter[];
  onOpenDcModal?: () => void;
  onNavigateToDatacenters?: () => void;
  isEdit?: boolean;
  disabled?: boolean;
  errors?: Partial<Record<keyof OLTFormData, string>>;
}

export const OLT_BRAND_OPTIONS = [
  'V-SOL',
  'BDCOM',
  'Huawei',
  'DBC',
  'Other',
];

export const OLTForm: React.FC<OLTFormProps> = ({
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
      {/* 1. Device Identity & Brand Selection */}
      <FormSection
        title="OLT Identity & Hardware Vendor"
        description="Specify optical line terminal brand profile and management IP"
        icon={<Layers className="w-5 h-5" />}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-base-content/80">
            Hardware Vendor / Brand
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {OLT_BRAND_OPTIONS.map((brandName) => {
              const isSelected = formData.brand === brandName;
              return (
                <button
                  key={brandName}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange('brand', brandName)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500 text-base-content font-bold shadow-xs'
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
          placeholder="192.168.1.100"
          value={formData.ip_address}
          onChange={(e) => onChange('ip_address', e.target.value)}
          error={errors.ip_address}
          required
          disabled={disabled}
          helperText="Standard in-band or out-of-band management interface IP of the OLT"
        />

        {isEdit && (
          <FormInput
            label="Device Hostname"
            value={formData.hostname || ''}
            onChange={(e) => onChange('hostname', e.target.value)}
            disabled={disabled}
            helperText="System identifier reported by the OLT"
          />
        )}
      </FormSection>

      {/* 2. SNMP Polling Credentials */}
      <FormSection
        title="SNMP Telemetry Credentials"
        description="SNMPv2c read-only community used for optical power and temperature polling"
        icon={<Key className="w-5 h-5" />}
      >
        <CommunityInput
          value={formData.snmp_community}
          onChange={(val) => onChange('snmp_community', val)}
          disabled={disabled}
        />
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[11px] text-base-content/70 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            For V-SOL OLTs, ensure SNMP agent is enabled on port 161 in the web/CLI settings.
            Dual power supplies (PSU 1 and PSU 2) are automatically discovered.
          </span>
        </div>
      </FormSection>

      {/* 3. Physical Datacenter & Rack Placement */}
      <FormSection
        title="Datacenter & Rack Location"
        description="Assign the OLT to a facility and rack enclosure"
        icon={<Building2 className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-base-content/80">
              Datacenter Facility
            </label>
            <DatacenterDropdown
              datacenters={datacenters}
              selectedId={formData.datacenter_id}
              onSelect={(dcId) => {
                const selected = datacenters.find((d) => String(d.id) === String(dcId));
                onChange('datacenter_id', dcId);
                if (selected) {
                  onChange('location', selected.location);
                  if (selected.racks && selected.racks.length > 0) {
                    onChange('rack_number', selected.racks[0]);
                  }
                }
              }}
              onOpenDcModal={onOpenDcModal || onNavigateToDatacenters}
            />
          </div>

          <FormInput
            label="Rack Number"
            placeholder="Rack 01"
            value={formData.rack_number}
            onChange={(e) => onChange('rack_number', e.target.value)}
            icon={<Tag className="w-4 h-4" />}
            disabled={disabled}
            helperText="e.g. Rack 01 or Cabinet A-4"
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

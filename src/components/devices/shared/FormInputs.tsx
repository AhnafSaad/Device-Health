import React from 'react';
import { DeviceType, DeviceBrand, BRAND_OPTIONS, Datacenter } from '../../../types';
import { BrandLogo } from '../../BrandLogo';
import { formatRack } from '../../../utils/rack';
import { 
  Server as ServerIcon, 
  Network, 
  Layers, 
  Radio, 
  Cpu, 
  Key, 
  Building2, 
  MapPin, 
  Tag,
  Eye,
  EyeOff
} from 'lucide-react';

export interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  icon,
  children,
  className = '',
}) => {
  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-base-100 border border-base-content/10 shadow-xs space-y-3.5 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <div>
          <h3 className="text-sm font-bold text-base-content">{title}</h3>
          {description && <p className="text-xs text-base-content/60 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="space-y-3 pt-1">
        {children}
      </div>
    </div>
  );
};

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string | null;
  helperText?: string;
  required?: boolean;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  icon,
  error,
  helperText,
  required,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-bold text-base-content/80">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <div className="relative rounded-xl shadow-2xs">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-base-content/50">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          {...props}
          className={`w-full rounded-xl border bg-base-100 py-2.5 text-sm text-base-content transition-all focus:outline-hidden ${
            icon ? 'pl-10 pr-3.5' : 'px-3.5'
          } ${
            error
              ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
              : 'border-base-content/20 focus:border-primary focus:ring-1 focus:ring-primary'
          } ${props.disabled ? 'opacity-60 bg-base-200/50 cursor-not-allowed' : ''} ${className}`}
        />
      </div>
      {error ? (
        <p className="text-xs text-error font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-base-content/50">{helperText}</p>
      ) : null}
    </div>
  );
};

export interface DeviceTypeSelectorProps {
  value: DeviceType | string;
  onChange: (type: DeviceType) => void;
  disabled?: boolean;
}

export const DeviceTypeSelector: React.FC<DeviceTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const types: { type: DeviceType; label: string; desc: string; icon: React.ReactNode; badgeClass: string }[] = [
    {
      type: 'Server',
      label: 'Server',
      desc: 'Linux / Bare-Metal compute node',
      icon: <ServerIcon className="w-5 h-5 text-primary" />,
      badgeClass: 'border-primary/30 text-primary bg-primary/5',
    },
    {
      type: 'Router',
      label: 'Router',
      desc: 'MikroTik / Juniper / BGP edge gateway',
      icon: <Radio className="w-5 h-5 text-cyan-500" />,
      badgeClass: 'border-cyan-500/30 text-cyan-500 bg-cyan-500/5',
    },
    {
      type: 'Switch',
      label: 'Switch',
      desc: 'Cisco / Huawei / Arista L2/L3 switch',
      icon: <Network className="w-5 h-5 text-indigo-500" />,
      badgeClass: 'border-indigo-500/30 text-indigo-500 bg-indigo-500/5',
    },
    {
      type: 'OLT',
      label: 'GPON / EPON OLT',
      desc: 'V-SOL / Huawei / BDCOM optical terminal',
      icon: <Layers className="w-5 h-5 text-amber-500" />,
      badgeClass: 'border-amber-500/30 text-amber-500 bg-amber-500/5',
    },
  ];

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-base-content/80">
        Device Architecture / Type <span className="text-error">*</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {types.map((item) => {
          const isSelected = value === item.type;
          return (
            <button
              key={item.type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.type)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                  : 'border-base-content/15 bg-base-100 hover:bg-base-200/50 hover:border-base-content/30'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-base-200/80">
                  {item.icon}
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <div>
                <div className="font-bold text-sm text-base-content">{item.label}</div>
                <div className="text-[11px] text-base-content/60 leading-tight mt-0.5">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export interface BrandSelectorProps {
  value: string;
  onChange: (brand: string) => void;
  disabled?: boolean;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-base-content/80">
        Hardware Brand / Vendor
      </label>
      <div className="relative rounded-xl shadow-2xs">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
          <BrandLogo brand={value === 'Auto' ? 'Other' : value} size="sm" />
        </div>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-base-content/20 bg-base-100 py-2.5 pl-10 pr-8 text-sm text-base-content focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
        >
          <option value="Auto">Auto-Detect Brand (via SNMP sysObjectID / sysDescr)</option>
          {BRAND_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-base-content/50">
        Select a specific brand or keep 'Auto-Detect' to determine hardware profile via SNMP discovery.
      </p>
    </div>
  );
};

export interface CommunityInputProps {
  value: string;
  onChange: (community: string) => void;
  disabled?: boolean;
}

export const CommunityInput: React.FC<CommunityInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [showKey, setShowKey] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-base-content/80">
          SNMP v2c Community String <span className="text-error">*</span>
        </label>
        <div className="flex items-center gap-1">
          {['public', 'private', 'monitoring'].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
                value === preset
                  ? 'bg-primary/20 text-primary border border-primary/30 font-bold'
                  : 'bg-base-200 text-base-content/60 hover:bg-base-300'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
      <div className="relative rounded-xl shadow-2xs">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-base-content/50">
          <Key className="w-4 h-4" />
        </div>
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="public"
          className="w-full rounded-xl border border-base-content/20 bg-base-100 py-2.5 pl-10 pr-10 text-sm font-mono text-base-content focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-base-content/40 hover:text-base-content"
        >
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[11px] text-base-content/50">
        Read-only SNMP Community used for telemetry metrics. Never used for write or SET operations.
      </p>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Server, Box } from 'lucide-react';

export const BRAND_DOMAINS: Record<string, string> = {
  'Huawei': 'huawei.com',
  'Cisco': 'cisco.com',
  'MikroTik': 'mikrotik.com',
  'Juniper': 'juniper.net',
  'Arista': 'arista.com',
  'BDCOM': 'bdcom.cn',
  'V-SOL': 'vsolcn.com',
  'TP-Link': 'tp-link.com',
  'Dell': 'dell.com',
  'HP': 'hp.com',
  'ZTE': 'zte.com.cn',
  'Supermicro': 'supermicro.com',
};

interface BrandLogoProps {
  brand?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  brand,
  size = 'md',
  className = '',
  showLabel = false,
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state when brand changes
  useEffect(() => {
    setHasError(false);
  }, [brand]);

  const cleanBrand = (brand || '').trim();
  const isDetecting = !cleanBrand || cleanBrand.toLowerCase() === 'auto';
  const displayLabel = isDetecting ? 'Detecting...' : cleanBrand;
  const domain = !isDetecting ? BRAND_DOMAINS[cleanBrand] : null;

  // Explicit overrides for brands lacking configured favicons or custom styling
  let logoSrc: string | null = null;
  if (!isDetecting) {
    if (cleanBrand.toUpperCase() === 'BDCOM') {
      logoSrc = 'https://ui-avatars.com/api/?name=BDCOM&background=0284c7&color=fff&bold=true&font-size=0.33';
    } else if (cleanBrand.toUpperCase() === 'DBC') {
      logoSrc = 'https://ui-avatars.com/api/?name=DBC&background=059669&color=fff&bold=true&font-size=0.4';
    } else if (domain) {
      logoSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }
  }

  // Size classes: default to w-6 h-6, with responsive variants if requested
  const sizeClasses = {
    xs: 'w-4 h-4 min-w-4 text-[9px]',
    sm: 'w-5 h-5 min-w-5 text-[10px]',
    md: 'w-6 h-6 min-w-6 text-[11px]', // 24x24px (default as requested)
    lg: 'w-8 h-8 min-w-8 text-xs',
  }[size] || 'w-6 h-6 min-w-6 text-[11px]';

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4.5 h-4.5',
  }[size] || 'w-3.5 h-3.5';

  // Robust fallback: display generic neutral icon for Auto/empty/Other, or first letter monogram
  const renderFallback = () => {
    const isNeutralFallback = isDetecting || cleanBrand.toLowerCase() === 'other';

    if (isNeutralFallback) {
      return (
        <span
          title={displayLabel}
          className={`inline-flex items-center justify-center rounded-full bg-white object-contain p-[2px] shadow-sm border border-gray-200 text-gray-600 shrink-0 align-middle ${sizeClasses} ${className}`}
        >
          <Server className={iconSizes} />
        </span>
      );
    }

    // For local brands (e.g. DBC) or when image fails, show clean monogram
    const firstLetter = cleanBrand.charAt(0).toUpperCase();

    return (
      <span
        title={cleanBrand}
        className={`inline-flex items-center justify-center rounded-full bg-white object-contain p-[2px] shadow-sm border border-gray-200 font-mono font-bold uppercase text-primary shrink-0 align-middle ${sizeClasses} ${className}`}
      >
        {firstLetter}
      </span>
    );
  };

  // Standard <img> tag pointing to Google's Favicon API or explicit override avatar
  const logoElement = (logoSrc && !hasError) ? (
    <img
      src={logoSrc}
      alt={`${cleanBrand} logo`}
      title={`${cleanBrand}${domain ? ` (${domain})` : ''}`}
      onError={() => setHasError(true)}
      loading="lazy"
      className={`rounded-full bg-white object-contain p-[2px] shadow-sm border border-gray-200 shrink-0 inline-block align-middle ${sizeClasses} ${className}`}
    />
  ) : (
    renderFallback()
  );

  if (!showLabel) {
    return logoElement;
  }

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {logoElement}
      <span className="text-xs font-semibold text-base-content/90">{displayLabel}</span>
    </span>
  );
};

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bell,
  Clock,
  Save,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Cpu,
  HardDrive,
  Thermometer,
  Users,
  Activity,
  Plus,
  ChevronDown,
  MemoryStick,
  X as CloseIcon,
} from 'lucide-react';
import { PollingSettingsSection } from './PollingSettingsSection';
import { fetchWithAuth as defaultFetchWithAuth } from '../utils/auth';

export type ThresholdMetric =
  | 'cpu'
  | 'ram'
  | 'disk'
  | 'temperature'
  | 'connected_users'
  | 'ram_ecc_corrected'
  | 'ram_ecc_uncorrected';
export type ThresholdDeviceType = 'All' | 'Server' | 'Router' | 'Switch' | 'OLT';

const ALL_SUPPORTED_METRICS: ThresholdMetric[] = [
  'cpu',
  'ram',
  'disk',
  'temperature',
  'connected_users',
  'ram_ecc_corrected',
  'ram_ecc_uncorrected',
];

export interface ThresholdRow {
  id?: number;
  metric: ThresholdMetric;
  device_type: ThresholdDeviceType;
  warning_value: number;
  critical_value: number;
  enabled: boolean;
}

interface MetricConfig {
  metric: ThresholdMetric;
  label: string;
  unit: string;
  scaleMax: number;
  defaultWarning: number;
  defaultCritical: number;
  defaultEnabled: boolean;
  tileClasses: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    metric: 'cpu',
    label: 'CPU Usage',
    unit: '%',
    scaleMax: 100,
    defaultWarning: 75,
    defaultCritical: 85,
    defaultEnabled: true,
    tileClasses: 'bg-primary/10 border-primary/25 text-primary shadow-[0_0_12px_rgba(59,130,246,0.12)]',
  },
  {
    metric: 'ram',
    label: 'RAM Usage',
    unit: '%',
    scaleMax: 100,
    defaultWarning: 80,
    defaultCritical: 90,
    defaultEnabled: true,
    tileClasses: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.12)]',
  },
  {
    metric: 'disk',
    label: 'Disk Usage',
    unit: '%',
    scaleMax: 100,
    defaultWarning: 70,
    defaultCritical: 85,
    defaultEnabled: true,
    tileClasses: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.12)]',
  },
  {
    metric: 'temperature',
    label: 'Temperature',
    unit: '°C',
    scaleMax: 110,
    defaultWarning: 60,
    defaultCritical: 75,
    defaultEnabled: true,
    tileClasses: 'bg-amber-500/10 border-amber-500/25 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.12)]',
  },
  {
    metric: 'connected_users',
    label: 'Connected Users',
    unit: '',
    scaleMax: 500,
    defaultWarning: 100,
    defaultCritical: 250,
    defaultEnabled: false,
    tileClasses: 'bg-purple-500/10 border-purple-500/25 text-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.12)]',
  },
];

const OVERRIDE_DEVICE_TYPES: ThresholdDeviceType[] = ['Server', 'Router', 'Switch', 'OLT'];

interface ThresholdsViewProps {
  onBack?: () => void;
  fetchWithAuth?: typeof defaultFetchWithAuth;
  onUnauthorized?: () => void;
}

export const ThresholdsView: React.FC<ThresholdsViewProps> = ({
  onBack,
  fetchWithAuth = defaultFetchWithAuth,
  onUnauthorized,
}) => {
  const [rows, setRows] = useState<ThresholdRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingMetric, setSavingMetric] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [openDropdownMetric, setOpenDropdownMetric] = useState<ThresholdMetric | 'ecc' | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close override dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!openDropdownMetric) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setOpenDropdownMetric(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdownMetric(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdownMetric]);

  const normalizeLoadedRows = useCallback((apiRows: any[]): ThresholdRow[] => {
    const normalized: ThresholdRow[] = [];

    for (const raw of apiRows) {
      if (!raw || !raw.metric) continue;
      const metric = String(raw.metric).trim().toLowerCase() as ThresholdMetric;
      if (!ALL_SUPPORTED_METRICS.includes(metric)) continue;

      const rawType = String(raw.device_type || 'All').trim();
      const matchedType =
        (['All', 'Server', 'Router', 'Switch', 'OLT'] as ThresholdDeviceType[]).find(
          (t) => t.toLowerCase() === rawType.toLowerCase()
        ) || 'All';

      normalized.push({
        id: raw.id !== undefined && raw.id !== null ? Number(raw.id) : undefined,
        metric,
        device_type: matchedType,
        warning_value: Number(raw.warning_value),
        critical_value: Number(raw.critical_value),
        enabled: raw.enabled !== undefined && raw.enabled !== null ? Boolean(raw.enabled) : true,
      });
    }

    // Ensure every metric has an 'All' row so it can be configured and used as template for overrides
    for (const cfg of METRIC_CONFIGS) {
      const hasAll = normalized.some((r) => r.metric === cfg.metric && r.device_type === 'All');
      if (!hasAll) {
        normalized.push({
          id: undefined,
          metric: cfg.metric,
          device_type: 'All',
          warning_value: cfg.defaultWarning,
          critical_value: cfg.defaultCritical,
          enabled: cfg.defaultEnabled,
        });
      }
    }

    // Ensure ram_ecc_corrected and ram_ecc_uncorrected have 'All' rows
    if (!normalized.some((r) => r.metric === 'ram_ecc_corrected' && r.device_type === 'All')) {
      normalized.push({
        id: undefined,
        metric: 'ram_ecc_corrected',
        device_type: 'All',
        warning_value: 10,
        critical_value: 50,
        enabled: true,
      });
    }
    if (!normalized.some((r) => r.metric === 'ram_ecc_uncorrected' && r.device_type === 'All')) {
      normalized.push({
        id: undefined,
        metric: 'ram_ecc_uncorrected',
        device_type: 'All',
        warning_value: 1,
        critical_value: 1,
        enabled: true,
      });
    }

    return normalized;
  }, []);

  const fetchThresholds = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchWithAuth('/api/thresholds', { credentials: 'include' });
      if (res.status === 401) {
        if (onUnauthorized) onUnauthorized();
        setLoadError('Admin authentication required. Please log in.');
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to load thresholds (HTTP ${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.thresholds) ? data.thresholds : [];
      setRows(normalizeLoadedRows(list));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to fetch thresholds from server.');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, normalizeLoadedRows, onUnauthorized]);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  // Count how many metrics currently have at least one device-type override configured
  const customizedMetricsCount = useMemo(() => {
    const regularCount = METRIC_CONFIGS.filter((cfg) =>
      rows.some((r) => r.metric === cfg.metric && r.device_type !== 'All')
    ).length;
    const eccCustomized = rows.some(
      (r) =>
        (r.metric === 'ram_ecc_corrected' || r.metric === 'ram_ecc_uncorrected') &&
        r.device_type !== 'All'
    )
      ? 1
      : 0;
    return regularCount + eccCustomized;
  }, [rows]);

  const updateRowField = (
    metric: ThresholdMetric,
    deviceType: ThresholdDeviceType,
    field: 'warning_value' | 'critical_value' | 'enabled',
    value: number | boolean
  ) => {
    setRows((prev) =>
      prev.map((r) =>
        r.metric === metric && r.device_type === deviceType
          ? { ...r, [field]: value }
          : r
      )
    );
  };

  const handleAddOverride = (metric: ThresholdMetric, deviceType: ThresholdDeviceType) => {
    if (!deviceType) return;
    setRows((prev) => {
      if (prev.some((r) => r.metric === metric && r.device_type === deviceType)) {
        return prev;
      }
      const allRow = prev.find((r) => r.metric === metric && r.device_type === 'All');
      const cfg = METRIC_CONFIGS.find((c) => c.metric === metric)!;
      const newRow: ThresholdRow = {
        id: undefined,
        metric,
        device_type: deviceType,
        warning_value: allRow ? allRow.warning_value : cfg.defaultWarning,
        critical_value: allRow ? allRow.critical_value : cfg.defaultCritical,
        enabled: allRow ? allRow.enabled : true,
      };
      return [...prev, newRow];
    });
    setOpenDropdownMetric(null);
  };

  const handleRemoveOverride = async (row: ThresholdRow) => {
    if (row.device_type === 'All') return;
    const key = `${row.metric}:${row.device_type}`;

    if (row.id === undefined || row.id === null) {
      setRows((prev) =>
        prev.filter((r) => !(r.metric === row.metric && r.device_type === row.device_type))
      );
      setToast({
        type: 'success',
        message: `Removed unsaved ${row.device_type} override for ${row.metric.toUpperCase()}.`,
      });
      return;
    }

    setDeletingKey(key);
    try {
      const res = await fetchWithAuth(`/api/thresholds/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.status === 401) {
        if (onUnauthorized) onUnauthorized();
        setToast({ type: 'error', message: 'Admin authentication required.' });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete threshold override.');
      }

      setRows((prev) =>
        prev.filter((r) => !(r.metric === row.metric && r.device_type === row.device_type))
      );
      setToast({
        type: 'success',
        message: `Removed ${row.device_type} override for ${row.metric.toUpperCase()}.`,
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to remove override.',
      });
    } finally {
      setDeletingKey(null);
    }
  };

  const getRowValidationError = (row: ThresholdRow): string | null => {
    if (
      row.warning_value === null ||
      row.warning_value === undefined ||
      Number.isNaN(Number(row.warning_value)) ||
      row.critical_value === null ||
      row.critical_value === undefined ||
      Number.isNaN(Number(row.critical_value))
    ) {
      return 'Warning and Critical values must be valid numbers.';
    }
    if (Number(row.warning_value) < 0 || Number(row.critical_value) < 0) {
      return 'Threshold values cannot be negative.';
    }
    if (row.metric === 'ram_ecc_uncorrected') {
      if (Number(row.warning_value) > Number(row.critical_value)) {
        return 'Warning value cannot be greater than Critical value.';
      }
    } else if (Number(row.warning_value) >= Number(row.critical_value)) {
      return 'Warning value must be less than Critical value.';
    }
    return null;
  };

  const handleSaveEccCard = async () => {
    const eccRows = rows.filter(
      (r) => r.metric === 'ram_ecc_corrected' || r.metric === 'ram_ecc_uncorrected'
    );
    const invalidRow = eccRows.find((r) => getRowValidationError(r) !== null);
    if (invalidRow) {
      setToast({
        type: 'error',
        message: getRowValidationError(invalidRow) || 'Please fix validation errors before saving.',
      });
      return;
    }

    setSavingMetric('ecc');
    try {
      const payload = eccRows.map((r) => ({
        metric: r.metric,
        device_type: r.device_type,
        warning_value: Number(r.warning_value),
        critical_value: Number(r.critical_value),
        enabled: Boolean(r.enabled),
      }));

      const res = await fetchWithAuth('/api/thresholds', {
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        if (onUnauthorized) onUnauthorized();
        setToast({ type: 'error', message: 'Admin authentication required.' });
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save ECC thresholds.');
      }

      const savedList = Array.isArray(data)
        ? data
        : Array.isArray(data?.thresholds)
        ? data.thresholds
        : null;

      if (savedList) {
        const normalizedServer = normalizeLoadedRows(savedList);
        setRows((prev) => {
          const nonEccRows = prev.filter(
            (r) => r.metric !== 'ram_ecc_corrected' && r.metric !== 'ram_ecc_uncorrected'
          );
          const updatedEccRows = normalizedServer.filter(
            (r) => r.metric === 'ram_ecc_corrected' || r.metric === 'ram_ecc_uncorrected'
          );
          return [...nonEccRows, ...updatedEccRows];
        });
      }

      setToast({
        type: 'success',
        message: 'ECC Memory Errors thresholds saved successfully.',
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to save ECC thresholds.',
      });
    } finally {
      setSavingMetric(null);
    }
  };

  const handleAddEccOverride = (deviceType: ThresholdDeviceType) => {
    if (!deviceType || deviceType === 'All') return;
    setRows((prev) => {
      const next = [...prev];
      const hasCe = next.some((r) => r.metric === 'ram_ecc_corrected' && r.device_type === deviceType);
      const hasUe = next.some((r) => r.metric === 'ram_ecc_uncorrected' && r.device_type === deviceType);
      const allCe = next.find((r) => r.metric === 'ram_ecc_corrected' && r.device_type === 'All');
      const allUe = next.find((r) => r.metric === 'ram_ecc_uncorrected' && r.device_type === 'All');

      if (!hasCe) {
        next.push({
          id: undefined,
          metric: 'ram_ecc_corrected',
          device_type: deviceType,
          warning_value: allCe ? allCe.warning_value : 10,
          critical_value: allCe ? allCe.critical_value : 50,
          enabled: allCe ? allCe.enabled : true,
        });
      }
      if (!hasUe) {
        next.push({
          id: undefined,
          metric: 'ram_ecc_uncorrected',
          device_type: deviceType,
          warning_value: allUe ? allUe.warning_value : 1,
          critical_value: allUe ? allUe.critical_value : 1,
          enabled: allUe ? allUe.enabled : true,
        });
      }
      return next;
    });
    setOpenDropdownMetric(null);
  };

  const handleRemoveEccOverride = async (deviceType: ThresholdDeviceType) => {
    if (deviceType === 'All') return;
    const key = `ecc:${deviceType}`;
    const targetRows = rows.filter(
      (r) =>
        (r.metric === 'ram_ecc_corrected' || r.metric === 'ram_ecc_uncorrected') &&
        r.device_type === deviceType
    );

    const unsavedOnly = targetRows.every((r) => r.id === undefined || r.id === null);
    if (unsavedOnly) {
      setRows((prev) =>
        prev.filter(
          (r) =>
            !(
              (r.metric === 'ram_ecc_corrected' || r.metric === 'ram_ecc_uncorrected') &&
              r.device_type === deviceType
            )
        )
      );
      setToast({
        type: 'success',
        message: `Removed unsaved ${deviceType} override for ECC Memory Errors.`,
      });
      return;
    }

    setDeletingKey(key);
    try {
      for (const row of targetRows) {
        if (row.id !== undefined && row.id !== null) {
          const res = await fetchWithAuth(`/api/thresholds/${row.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || `Failed to delete ${row.metric} override.`);
          }
        }
      }

      setRows((prev) =>
        prev.filter(
          (r) =>
            !(
              (r.metric === 'ram_ecc_corrected' || r.metric === 'ram_ecc_uncorrected') &&
              r.device_type === deviceType
            )
        )
      );
      setToast({
        type: 'success',
        message: `Removed ${deviceType} override for ECC Memory Errors.`,
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to remove override.',
      });
    } finally {
      setDeletingKey(null);
    }
  };

  const handleSaveCard = async (metric: ThresholdMetric) => {
    const metricRows = rows.filter((r) => r.metric === metric);
    const invalidRow = metricRows.find((r) => getRowValidationError(r) !== null);
    if (invalidRow) {
      setToast({
        type: 'error',
        message: getRowValidationError(invalidRow) || 'Please fix validation errors before saving.',
      });
      return;
    }

    setSavingMetric(metric);
    try {
      const payload = metricRows.map((r) => ({
        metric: r.metric,
        device_type: r.device_type,
        warning_value: Number(r.warning_value),
        critical_value: Number(r.critical_value),
        enabled: Boolean(r.enabled),
      }));

      const res = await fetchWithAuth('/api/thresholds', {
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        if (onUnauthorized) onUnauthorized();
        setToast({ type: 'error', message: 'Admin authentication required.' });
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save thresholds.');
      }

      const savedList = Array.isArray(data)
        ? data
        : Array.isArray(data?.thresholds)
        ? data.thresholds
        : null;

      if (savedList) {
        const normalizedServer = normalizeLoadedRows(savedList);
        setRows((prev) => {
          const otherMetrics = prev.filter((r) => r.metric !== metric);
          const updatedThisMetric = normalizedServer.filter((r) => r.metric === metric);
          return [...otherMetrics, ...updatedThisMetric];
        });
      }

      const cfg = METRIC_CONFIGS.find((c) => c.metric === metric);
      setToast({
        type: 'success',
        message: `${cfg?.label || metric} thresholds saved successfully.`,
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to save thresholds.',
      });
    } finally {
      setSavingMetric(null);
    }
  };

  const renderMetricIcon = (metric: ThresholdMetric) => {
    switch (metric) {
      case 'cpu':
        return <Cpu className="w-5 h-5" />;
      case 'ram':
        return <Activity className="w-5 h-5" />;
      case 'disk':
        return <HardDrive className="w-5 h-5" />;
      case 'temperature':
        return <Thermometer className="w-5 h-5" />;
      case 'connected_users':
        return <Users className="w-5 h-5" />;
    }
  };

  const renderDeviceTypeBadge = (deviceType: ThresholdDeviceType, isUnsaved: boolean) => {
    const badgeStyles: Record<ThresholdDeviceType, string> = {
      All: 'bg-base-300/80 text-base-content border-base-content/15',
      Server: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
      Router: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
      Switch: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
      OLT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    };

    return (
      <div className="flex flex-col items-start gap-1">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold border tracking-tight ${badgeStyles[deviceType]}`}
        >
          {deviceType === 'All' ? 'All devices' : deviceType}
        </span>
        {deviceType !== 'All' && isUnsaved && (
          <span className="text-[10px] font-mono text-amber-500 font-semibold pl-0.5">
            Unsaved override
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex items-start sm:items-center gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0"
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_16px_rgba(59,130,246,0.15)] shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-base-content">
                Thresholds
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
                {customizedMetricsCount} of {METRIC_CONFIGS.length + 1} metrics customized
              </span>
            </div>
            <p className="text-xs text-base-content/60 mt-1">
              Configure warning and critical telemetry thresholds across all devices or per device type.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={fetchThresholds}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-base-200/70 hover:bg-base-200 border border-base-content/10 text-base-content/80 hover:text-primary transition-all focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-base-100 border border-base-content/10 rounded-2xl p-14 flex flex-col items-center justify-center gap-3 text-center shadow-lg">
          <span className="loading loading-spinner loading-md text-primary" />
          <span className="text-xs font-semibold text-base-content/70">
            Loading thresholds...
          </span>
        </div>
      )}

      {/* Error State with Retry Button */}
      {!loading && loadError && (
        <div className="bg-base-100 border border-rose-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3 text-rose-500">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-xs font-bold">Failed to load thresholds</p>
              <p className="text-xs opacity-80">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchThresholds}
            className="btn btn-sm btn-error rounded-xl text-xs font-bold gap-1.5 shrink-0 focus-visible:ring-2 focus-visible:ring-rose-500/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* SNMP Polling Frequency & 2-Column Responsive Metric Cards Grid */}
      {!loading && !loadError && (
        <div className="space-y-6">
          {/* SNMP Polling Frequency Card */}
          <div className="bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-3 border-b border-base-content/10 pb-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.12)] shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-base-content tracking-tight">
                  SNMP Polling Frequency
                </h2>
                <p className="text-xs text-base-content/60">
                  Configure background telemetry sweep cadence and scheduler presets across fleet nodes.
                </p>
              </div>
            </div>

            <PollingSettingsSection onUnauthorized={onUnauthorized} />
          </div>

          {/* 2-Column Responsive Metric Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {METRIC_CONFIGS.map((cfg) => {
            const metricRows = rows.filter((r) => r.metric === cfg.metric);
            const allRow = metricRows.find((r) => r.device_type === 'All');
            const overrideRows = metricRows.filter((r) => r.device_type !== 'All');
            const orderedRows = allRow ? [allRow, ...overrideRows] : overrideRows;

            const availableOverrideTypes = OVERRIDE_DEVICE_TYPES.filter(
              (dtype) => !metricRows.some((r) => r.device_type === dtype)
            );

            const hasValidationError = orderedRows.some(
              (r) => getRowValidationError(r) !== null
            );
            const isSavingThisCard = savingMetric === cfg.metric;
            const isDropdownOpen = openDropdownMetric === cfg.metric;

            return (
              <div
                key={cfg.metric}
                className="bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col justify-between min-h-[320px] gap-5"
              >
                {/* Top & Middle Section */}
                <div className="space-y-4">
                  {/* Card Header with Tinted Icon Tile */}
                  <div className="flex items-center justify-between gap-3 border-b border-base-content/10 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${cfg.tileClasses}`}
                      >
                        {renderMetricIcon(cfg.metric)}
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-extrabold text-base-content tracking-tight">
                          {cfg.label}
                        </h2>
                        <div className="flex items-center gap-2 text-[11px] text-base-content/50 font-mono">
                          <span>{cfg.unit ? `Unit: ${cfg.unit}` : 'Count threshold'}</span>
                          <span>•</span>
                          <span>
                            {overrideRows.length === 0
                              ? 'Global default only'
                              : `${overrideRows.length} device ${overrideRows.length === 1 ? 'override' : 'overrides'}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Threshold Rows Container with Alternating Backgrounds */}
                  <div className="rounded-xl border border-base-content/10 overflow-hidden divide-y divide-base-content/10">
                    {orderedRows.map((row, rowIdx) => {
                      const isAll = row.device_type === 'All';
                      const rowError = getRowValidationError(row);
                      const rowKey = `${row.metric}:${row.device_type}`;
                      const isDeleting = deletingKey === rowKey;

                      const rawWarn = Number.isNaN(Number(row.warning_value)) ? 0 : Math.max(0, Number(row.warning_value));
                      const rawCrit = Number.isNaN(Number(row.critical_value)) ? 0 : Math.max(0, Number(row.critical_value));
                      const maxScale =
                        cfg.unit === '%'
                          ? 100
                          : Math.max(cfg.scaleMax, rawCrit > 0 ? Math.ceil(rawCrit * 1.25) : cfg.scaleMax);

                      const warnPct = Math.min(100, Math.max(0, (rawWarn / maxScale) * 100));
                      const critPct = Math.min(100, Math.max(warnPct, (rawCrit / maxScale) * 100));
                      const amberWidth = Math.max(0, critPct - warnPct);
                      const redWidth = Math.max(0, 100 - critPct);

                      const alternatingBg =
                        rowIdx % 2 === 0 ? 'bg-base-100' : 'bg-base-200/45';

                      return (
                        <div
                          key={rowKey}
                          className={`p-3.5 sm:p-4 transition-colors ${alternatingBg}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                            {/* Left: Device Type Pill Badge (dims when row is disabled) */}
                            <div
                              className={`sm:w-32 shrink-0 transition-opacity ${
                                row.enabled ? 'opacity-100' : 'opacity-40'
                              }`}
                            >
                              {renderDeviceTypeBadge(row.device_type, row.id === undefined)}
                            </div>

                            {/* Center: Connected Gradient Bar + Left-Bordered Inputs (dims when row is disabled) */}
                            <div
                              className={`flex-1 min-w-0 space-y-2.5 transition-opacity ${
                                row.enabled ? 'opacity-100' : 'opacity-40'
                              }`}
                            >
                              {/* Horizontal Segmented Gradient Bar (Green -> Amber -> Red) */}
                              <div className="space-y-1">
                                <div className="relative h-2 w-full rounded-full bg-base-300/70 overflow-hidden flex shadow-inner">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-500 transition-all duration-200"
                                    style={{ width: `${warnPct}%` }}
                                    title={`Normal: 0 – ${rawWarn}${cfg.unit}`}
                                  />
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-200"
                                    style={{ width: `${amberWidth}%` }}
                                    title={`Warning: ${rawWarn}${cfg.unit} – ${rawCrit}${cfg.unit}`}
                                  />
                                  <div
                                    className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-200"
                                    style={{ width: `${redWidth}%` }}
                                    title={`Critical: ≥ ${rawCrit}${cfg.unit}`}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-base-content/45">
                                  <span>0{cfg.unit}</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                    Warn: {Number.isNaN(Number(row.warning_value)) ? '—' : `${row.warning_value}${cfg.unit}`}
                                  </span>
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                    Crit: {Number.isNaN(Number(row.critical_value)) ? '—' : `${row.critical_value}${cfg.unit}`}
                                  </span>
                                  <span>{maxScale}{cfg.unit}</span>
                                </div>
                              </div>

                              {/* Connected Pair of Number Inputs with Colored Left Borders */}
                              <div className="grid grid-cols-2 gap-2.5">
                                {/* Warning Field (Amber left border) */}
                                <div className="relative flex items-center rounded-lg border border-base-content/15 border-l-4 border-l-amber-500 bg-base-100 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:border-amber-500/50">
                                  <div className="flex-1 min-w-0">
                                    <label
                                      htmlFor={`warn-${cfg.metric}-${row.device_type}`}
                                      className="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 leading-none mb-1"
                                    >
                                      Warning
                                    </label>
                                    <div className="flex items-baseline gap-1">
                                      <input
                                        id={`warn-${cfg.metric}-${row.device_type}`}
                                        type="number"
                                        value={Number.isNaN(Number(row.warning_value)) ? '' : row.warning_value}
                                        onChange={(e) =>
                                          updateRowField(
                                            cfg.metric,
                                            row.device_type,
                                            'warning_value',
                                            e.target.value === '' ? NaN : Number(e.target.value)
                                          )
                                        }
                                        className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-base-content outline-none"
                                      />
                                      {cfg.unit && (
                                        <span className="text-[11px] font-mono text-base-content/50 shrink-0">
                                          {cfg.unit}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Critical Field (Red left border) */}
                                <div className="relative flex items-center rounded-lg border border-base-content/15 border-l-4 border-l-rose-500 bg-base-100 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-rose-500/40 focus-within:border-rose-500/50">
                                  <div className="flex-1 min-w-0">
                                    <label
                                      htmlFor={`crit-${cfg.metric}-${row.device_type}`}
                                      className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 leading-none mb-1"
                                    >
                                      Critical
                                    </label>
                                    <div className="flex items-baseline gap-1">
                                      <input
                                        id={`crit-${cfg.metric}-${row.device_type}`}
                                        type="number"
                                        value={Number.isNaN(Number(row.critical_value)) ? '' : row.critical_value}
                                        onChange={(e) =>
                                          updateRowField(
                                            cfg.metric,
                                            row.device_type,
                                            'critical_value',
                                            e.target.value === '' ? NaN : Number(e.target.value)
                                          )
                                        }
                                        className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-base-content outline-none"
                                      />
                                      {cfg.unit && (
                                        <span className="text-[11px] font-mono text-base-content/50 shrink-0">
                                          {cfg.unit}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Far Right: Vertically Centered Toggle + Remove Override Button */}
                            <div className="flex items-center justify-end gap-2.5 sm:pl-2 shrink-0 self-end sm:self-center">
                              <label
                                htmlFor={`toggle-${cfg.metric}-${row.device_type}`}
                                className="inline-flex items-center gap-2 cursor-pointer select-none"
                                title={row.enabled ? 'Threshold active' : 'Threshold disabled'}
                              >
                                <input
                                  id={`toggle-${cfg.metric}-${row.device_type}`}
                                  type="checkbox"
                                  checked={row.enabled}
                                  onChange={(e) =>
                                    updateRowField(
                                      cfg.metric,
                                      row.device_type,
                                      'enabled',
                                      e.target.checked
                                    )
                                  }
                                  className="toggle toggle-sm toggle-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                                />
                                <span
                                  className={`text-[11px] font-mono font-semibold w-14 ${
                                    row.enabled ? 'text-base-content/80' : 'text-base-content/40'
                                  }`}
                                >
                                  {row.enabled ? 'Enabled' : 'Muted'}
                                </span>
                              </label>

                              {!isAll ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOverride(row)}
                                  disabled={isDeleting}
                                  className="p-1.5 rounded-lg text-base-content/50 hover:text-rose-500 hover:bg-rose-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500/50"
                                  title={`Remove override for ${row.device_type}`}
                                  aria-label={`Remove override for ${row.device_type}`}
                                >
                                  {isDeleting ? (
                                    <span className="loading loading-spinner loading-xs text-rose-500" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-7" aria-hidden="true" />
                              )}
                            </div>
                          </div>

                          {/* Small Red Validation Banner Directly Under Row Inputs */}
                          {rowError && (
                            <div
                              role="alert"
                              className="mt-2.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2"
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{rowError}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Dashed-Border Ghost Button "+ Add device type override" with Dropdown */}
                  {availableOverrideTypes.length > 0 && (
                    <div
                      ref={isDropdownOpen ? dropdownContainerRef : undefined}
                      className="relative inline-block"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDropdownMetric((prev) => (prev === cfg.metric ? null : cfg.metric))
                        }
                        aria-expanded={isDropdownOpen}
                        aria-haspopup="listbox"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-base-content/25 hover:border-primary/50 hover:bg-primary/5 text-xs font-semibold text-base-content/70 hover:text-primary transition-all focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        <span>+ Add device type override</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 opacity-60 transition-transform ${
                            isDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isDropdownOpen && (
                        <div
                          role="listbox"
                          aria-label={`Select device type override for ${cfg.label}`}
                          className="absolute left-0 mt-1.5 w-48 rounded-xl bg-base-100 border border-base-content/15 shadow-xl py-1.5 z-30 animate-fadeIn"
                        >
                          <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-base-content/45 border-b border-base-content/10">
                            Select Device Type
                          </div>
                          {availableOverrideTypes.map((dtype) => (
                            <button
                              key={dtype}
                              type="button"
                              role="option"
                              aria-selected={false}
                              onClick={() => handleAddOverride(cfg.metric, dtype)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-base-content/80 hover:bg-primary/10 hover:text-primary flex items-center justify-between transition-colors focus-visible:bg-primary/10 focus-visible:text-primary outline-none"
                            >
                              <span>{dtype}</span>
                              <Plus className="w-3.5 h-3.5 opacity-60" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Full-Width "Save Changes" Final Action */}
                <div className="pt-2 border-t border-base-content/10">
                  <button
                    type="button"
                    onClick={() => handleSaveCard(cfg.metric)}
                    disabled={isSavingThisCard || hasValidationError}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      hasValidationError
                        ? 'bg-base-200 text-base-content/40 border border-base-content/10 cursor-not-allowed'
                        : 'bg-primary text-primary-content hover:brightness-105 shadow-sm shadow-primary/20'
                    }`}
                  >
                    {isSavingThisCard ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        <span>Saving {cfg.label}...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Combined ECC Memory Errors Card */}
          {(() => {
            const eccCeRows = rows.filter((r) => r.metric === 'ram_ecc_corrected');
            const eccUeRows = rows.filter((r) => r.metric === 'ram_ecc_uncorrected');
            const allCeRow = eccCeRows.find((r) => r.device_type === 'All') || {
              metric: 'ram_ecc_corrected' as const,
              device_type: 'All' as const,
              warning_value: 10,
              critical_value: 50,
              enabled: true,
            };
            const allUeRow = eccUeRows.find((r) => r.device_type === 'All') || {
              metric: 'ram_ecc_uncorrected' as const,
              device_type: 'All' as const,
              warning_value: 1,
              critical_value: 1,
              enabled: true,
            };

            const overrideDeviceTypes = Array.from(
              new Set([
                ...eccCeRows.filter((r) => r.device_type !== 'All').map((r) => r.device_type),
                ...eccUeRows.filter((r) => r.device_type !== 'All').map((r) => r.device_type),
              ])
            ) as ThresholdDeviceType[];

            const availableOverrideTypes = OVERRIDE_DEVICE_TYPES.filter(
              (dtype) => !overrideDeviceTypes.includes(dtype)
            );

            const allDtypes: ThresholdDeviceType[] = ['All', ...overrideDeviceTypes];

            const allEccRows = rows.filter(
              (r) => r.metric === 'ram_ecc_corrected' || r.metric === 'ram_ecc_uncorrected'
            );
            const hasValidationError = allEccRows.some((r) => getRowValidationError(r) !== null);
            const isSavingThisCard = savingMetric === 'ecc';
            const isDropdownOpen = openDropdownMetric === 'ecc';

            return (
              <div
                key="ecc-memory-errors"
                className="bg-base-100 border border-base-content/10 rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col justify-between min-h-[320px] gap-5"
              >
                {/* Top & Middle Section */}
                <div className="space-y-4">
                  {/* Card Header with Tinted Icon Tile */}
                  <div className="flex items-center justify-between gap-3 border-b border-base-content/10 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 bg-violet-500/10 border-violet-500/25 text-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.12)]">
                        <MemoryStick className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-extrabold text-base-content tracking-tight">
                          ECC Memory Errors
                        </h2>
                        <div className="flex items-center gap-2 text-[11px] text-base-content/50 font-mono">
                          <span>Count threshold</span>
                          <span>•</span>
                          <span>
                            {overrideDeviceTypes.length === 0
                              ? 'Global default only'
                              : `${overrideDeviceTypes.length} device ${overrideDeviceTypes.length === 1 ? 'override' : 'overrides'}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Threshold Sections Container with Alternating Backgrounds */}
                  <div className="rounded-xl border border-base-content/10 overflow-hidden divide-y divide-base-content/10">
                    {allDtypes.map((dtype, sectionIdx) => {
                      const isAll = dtype === 'All';
                      const ceRow =
                        rows.find((r) => r.metric === 'ram_ecc_corrected' && r.device_type === dtype) ||
                        allCeRow;
                      const ueRow =
                        rows.find((r) => r.metric === 'ram_ecc_uncorrected' && r.device_type === dtype) ||
                        allUeRow;

                      const ceError = getRowValidationError(ceRow);
                      const ueError = getRowValidationError(ueRow);

                      const sectionKey = `ecc:${dtype}`;
                      const isDeleting = deletingKey === sectionKey;
                      const isUnsaved = !isAll && (ceRow.id === undefined || ueRow.id === undefined);

                      // CE scale calculations
                      const ceWarn = Number.isNaN(Number(ceRow.warning_value)) ? 0 : Math.max(0, Number(ceRow.warning_value));
                      const ceCrit = Number.isNaN(Number(ceRow.critical_value)) ? 0 : Math.max(0, Number(ceRow.critical_value));
                      const ceMaxScale = Math.max(100, ceCrit > 0 ? Math.ceil(ceCrit * 1.25) : 100);
                      const ceWarnPct = Math.min(100, Math.max(0, (ceWarn / ceMaxScale) * 100));
                      const ceCritPct = Math.min(100, Math.max(ceWarnPct, (ceCrit / ceMaxScale) * 100));
                      const ceAmberWidth = Math.max(0, ceCritPct - ceWarnPct);
                      const ceRedWidth = Math.max(0, 100 - ceCritPct);

                      // UE scale calculations
                      const ueWarn = Number.isNaN(Number(ueRow.warning_value)) ? 0 : Math.max(0, Number(ueRow.warning_value));
                      const ueCrit = Number.isNaN(Number(ueRow.critical_value)) ? 0 : Math.max(0, Number(ueRow.critical_value));
                      const ueMaxScale = Math.max(10, ueCrit > 0 ? Math.ceil(ueCrit * 2) : 10);
                      const ueWarnPct = Math.min(100, Math.max(0, (ueWarn / ueMaxScale) * 100));
                      const ueCritPct = Math.min(100, Math.max(ueWarnPct, (ueCrit / ueMaxScale) * 100));
                      const ueAmberWidth = Math.max(0, ueCritPct - ueWarnPct);
                      const ueRedWidth = Math.max(0, 100 - ueCritPct);

                      const alternatingBg = sectionIdx % 2 === 0 ? 'bg-base-100' : 'bg-base-200/45';

                      return (
                        <div key={sectionKey} className={`p-3.5 sm:p-4 space-y-3.5 transition-colors ${alternatingBg}`}>
                          {/* Device Type Header Row */}
                          <div className="flex items-center justify-between pb-2 border-b border-base-content/10">
                            {renderDeviceTypeBadge(dtype, isUnsaved)}
                            {!isAll ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveEccOverride(dtype)}
                                disabled={isDeleting}
                                className="p-1.5 rounded-lg text-base-content/50 hover:text-rose-500 hover:bg-rose-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500/50"
                                title={`Remove override for ${dtype}`}
                                aria-label={`Remove override for ${dtype}`}
                              >
                                {isDeleting ? (
                                  <span className="loading loading-spinner loading-xs text-rose-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <div className="text-[11px] font-mono text-base-content/40 font-medium">Default</div>
                            )}
                          </div>

                          {/* Sub-metric 1: Corrected ECC Errors (CE) */}
                          <div className={`space-y-2 rounded-lg p-2.5 bg-base-200/30 border border-base-content/5 transition-opacity ${ceRow.enabled ? 'opacity-100' : 'opacity-40'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                <span className="text-xs font-bold text-base-content">
                                  Corrected ECC Errors (CE)
                                </span>
                              </div>
                              <label
                                htmlFor={`toggle-ce-${dtype}`}
                                className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                                title={ceRow.enabled ? 'Threshold active' : 'Threshold disabled'}
                              >
                                <input
                                  id={`toggle-ce-${dtype}`}
                                  type="checkbox"
                                  checked={ceRow.enabled}
                                  onChange={(e) => updateRowField('ram_ecc_corrected', dtype, 'enabled', e.target.checked)}
                                  className="toggle toggle-xs toggle-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                                />
                                <span className={`text-[10px] font-mono font-semibold w-12 ${ceRow.enabled ? 'text-base-content/80' : 'text-base-content/40'}`}>
                                  {ceRow.enabled ? 'Enabled' : 'Muted'}
                                </span>
                              </label>
                            </div>

                            {/* Gradient bar for CE */}
                            <div className="space-y-1">
                              <div className="relative h-2 w-full rounded-full bg-base-300/70 overflow-hidden flex shadow-inner">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-500 transition-all duration-200"
                                  style={{ width: `${ceWarnPct}%` }}
                                  title={`Normal: 0 – ${ceWarn}`}
                                />
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-200"
                                  style={{ width: `${ceAmberWidth}%` }}
                                  title={`Warning: ${ceWarn} – ${ceCrit}`}
                                />
                                <div
                                  className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-200"
                                  style={{ width: `${ceRedWidth}%` }}
                                  title={`Critical: ≥ ${ceCrit}`}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono text-base-content/45">
                                <span>0</span>
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  Warn: {Number.isNaN(Number(ceRow.warning_value)) ? '—' : ceRow.warning_value}
                                </span>
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  Crit: {Number.isNaN(Number(ceRow.critical_value)) ? '—' : ceRow.critical_value}
                                </span>
                                <span>{ceMaxScale}</span>
                              </div>
                            </div>

                            {/* Inputs for CE */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="relative flex items-center rounded-lg border border-base-content/15 border-l-4 border-l-amber-500 bg-base-100 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:border-amber-500/50">
                                <div className="flex-1 min-w-0">
                                  <label htmlFor={`warn-ce-${dtype}`} className="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 leading-none mb-1">
                                    Warning
                                  </label>
                                  <input
                                    id={`warn-ce-${dtype}`}
                                    type="number"
                                    value={Number.isNaN(Number(ceRow.warning_value)) ? '' : ceRow.warning_value}
                                    onChange={(e) => updateRowField('ram_ecc_corrected', dtype, 'warning_value', e.target.value === '' ? NaN : Number(e.target.value))}
                                    className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-base-content outline-none"
                                  />
                                </div>
                              </div>
                              <div className="relative flex items-center rounded-lg border border-base-content/15 border-l-4 border-l-rose-500 bg-base-100 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-rose-500/40 focus-within:border-rose-500/50">
                                <div className="flex-1 min-w-0">
                                  <label htmlFor={`crit-ce-${dtype}`} className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 leading-none mb-1">
                                    Critical
                                  </label>
                                  <input
                                    id={`crit-ce-${dtype}`}
                                    type="number"
                                    value={Number.isNaN(Number(ceRow.critical_value)) ? '' : ceRow.critical_value}
                                    onChange={(e) => updateRowField('ram_ecc_corrected', dtype, 'critical_value', e.target.value === '' ? NaN : Number(e.target.value))}
                                    className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-base-content outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                            {ceError && (
                              <div role="alert" className="mt-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>{ceError}</span>
                              </div>
                            )}
                          </div>

                          {/* Sub-metric 2: Uncorrected ECC Errors (UE) */}
                          <div className={`space-y-2 rounded-lg p-2.5 bg-base-200/30 border border-base-content/5 transition-opacity ${ueRow.enabled ? 'opacity-100' : 'opacity-40'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <span className="text-xs font-bold text-base-content">
                                  Uncorrected ECC Errors (UE)
                                </span>
                              </div>
                              <label
                                htmlFor={`toggle-ue-${dtype}`}
                                className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                                title={ueRow.enabled ? 'Threshold active' : 'Threshold disabled'}
                              >
                                <input
                                  id={`toggle-ue-${dtype}`}
                                  type="checkbox"
                                  checked={ueRow.enabled}
                                  onChange={(e) => updateRowField('ram_ecc_uncorrected', dtype, 'enabled', e.target.checked)}
                                  className="toggle toggle-xs toggle-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                                />
                                <span className={`text-[10px] font-mono font-semibold w-12 ${ueRow.enabled ? 'text-base-content/80' : 'text-base-content/40'}`}>
                                  {ueRow.enabled ? 'Enabled' : 'Muted'}
                                </span>
                              </label>
                            </div>

                            {/* Gradient bar for UE */}
                            <div className="space-y-1">
                              <div className="relative h-2 w-full rounded-full bg-base-300/70 overflow-hidden flex shadow-inner">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-500 transition-all duration-200"
                                  style={{ width: `${ueWarnPct}%` }}
                                  title={`Normal: 0 – ${ueWarn}`}
                                />
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-200"
                                  style={{ width: `${ueAmberWidth}%` }}
                                  title={`Warning: ${ueWarn} – ${ueCrit}`}
                                />
                                <div
                                  className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-200"
                                  style={{ width: `${ueRedWidth}%` }}
                                  title={`Critical: ≥ ${ueCrit}`}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono text-base-content/45">
                                <span>0</span>
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  Warn: {Number.isNaN(Number(ueRow.warning_value)) ? '—' : ueRow.warning_value}
                                </span>
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  Crit: {Number.isNaN(Number(ueRow.critical_value)) ? '—' : ueRow.critical_value}
                                </span>
                                <span>{ueMaxScale}</span>
                              </div>
                            </div>

                            {/* Inputs for UE */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="relative flex items-center rounded-lg border border-base-content/15 border-l-4 border-l-amber-500 bg-base-100 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:border-amber-500/50">
                                <div className="flex-1 min-w-0">
                                  <label htmlFor={`warn-ue-${dtype}`} className="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 leading-none mb-1">
                                    Warning
                                  </label>
                                  <input
                                    id={`warn-ue-${dtype}`}
                                    type="number"
                                    value={Number.isNaN(Number(ueRow.warning_value)) ? '' : ueRow.warning_value}
                                    onChange={(e) => updateRowField('ram_ecc_uncorrected', dtype, 'warning_value', e.target.value === '' ? NaN : Number(e.target.value))}
                                    className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-base-content outline-none"
                                  />
                                </div>
                              </div>
                              <div className="relative flex items-center rounded-lg border border-base-content/15 border-l-4 border-l-rose-500 bg-base-100 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-rose-500/40 focus-within:border-rose-500/50">
                                <div className="flex-1 min-w-0">
                                  <label htmlFor={`crit-ue-${dtype}`} className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 leading-none mb-1">
                                    Critical
                                  </label>
                                  <input
                                    id={`crit-ue-${dtype}`}
                                    type="number"
                                    value={Number.isNaN(Number(ueRow.critical_value)) ? '' : ueRow.critical_value}
                                    onChange={(e) => updateRowField('ram_ecc_uncorrected', dtype, 'critical_value', e.target.value === '' ? NaN : Number(e.target.value))}
                                    className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-base-content outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                            {ueError && (
                              <div role="alert" className="mt-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>{ueError}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dashed button: + Add device type override for ECC */}
                  {availableOverrideTypes.length > 0 && (
                    <div
                      ref={isDropdownOpen ? dropdownContainerRef : undefined}
                      className="relative inline-block"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDropdownMetric((prev) => (prev === 'ecc' ? null : 'ecc'))
                        }
                        aria-expanded={isDropdownOpen}
                        aria-haspopup="listbox"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-base-content/25 hover:border-primary/50 hover:bg-primary/5 text-xs font-semibold text-base-content/70 hover:text-primary transition-all focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        <span>+ Add device type override</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 opacity-60 transition-transform ${
                            isDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isDropdownOpen && (
                        <div
                          role="listbox"
                          aria-label="Select device type override for ECC Memory Errors"
                          className="absolute left-0 mt-1.5 w-48 rounded-xl bg-base-100 border border-base-content/15 shadow-xl py-1.5 z-30 animate-fadeIn"
                        >
                          <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-base-content/45 border-b border-base-content/10">
                            Select Device Type
                          </div>
                          {availableOverrideTypes.map((dtype) => (
                            <button
                              key={dtype}
                              type="button"
                              role="option"
                              aria-selected={false}
                              onClick={() => handleAddEccOverride(dtype)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-base-content/80 hover:bg-primary/10 hover:text-primary flex items-center justify-between transition-colors focus-visible:bg-primary/10 focus-visible:text-primary outline-none"
                            >
                              <span>{dtype}</span>
                              <Plus className="w-3.5 h-3.5 opacity-60" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Save Changes button */}
                <div className="pt-2 border-t border-base-content/10">
                  <button
                    type="button"
                    onClick={handleSaveEccCard}
                    disabled={isSavingThisCard || hasValidationError}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      hasValidationError
                        ? 'bg-base-200 text-base-content/40 border border-base-content/10 cursor-not-allowed'
                        : 'bg-primary text-primary-content hover:brightness-105 shadow-sm shadow-primary/20'
                    }`}
                  >
                    {isSavingThisCard ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        <span>Saving ECC Memory Errors...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {/* Floating Toast Notification matching App.tsx */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-auto transition-all animate-bounce-short">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-base-100 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/10'
                : 'bg-base-100 border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-rose-500/10'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-base-content/10 transition-colors ml-1 text-base-content/50 hover:text-base-content"
              aria-label="Dismiss notification"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThresholdsView;

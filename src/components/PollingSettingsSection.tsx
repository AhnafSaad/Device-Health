import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Clock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sliders, 
  Activity,
  Zap,
  Info,
  ArrowLeft,
  Timer,
  LogIn
} from 'lucide-react';
import { fetchWithAuth, clearAuth } from '../utils/auth';

export interface PollingPreset {
  label: string;
  value: string;
  minutes: number;
  description: string;
}

export const POLLING_PRESETS: PollingPreset[] = [
  { label: 'Every 1 minute (*/1 * * * *)', value: '*/1 * * * *', minutes: 1, description: 'Recommended for high-criticality environments' },
  { label: 'Every 5 minutes (*/5 * * * *)', value: '*/5 * * * *', minutes: 5, description: 'Balanced telemetry cadence & low SNMP overhead' },
  { label: 'Every 15 minutes (*/15 * * * *)', value: '*/15 * * * *', minutes: 15, description: 'Standard periodic health monitoring' },
  { label: 'Every 30 minutes (*/30 * * * *)', value: '*/30 * * * *', minutes: 30, description: 'Low-frequency enterprise baseline' },
  { label: 'Every hour (0 * * * *)', value: '0 * * * *', minutes: 60, description: 'Minimal background polling' },
];

/**
 * Translates a 5-field cron expression into user-friendly plain English.
 */
export function formatCronToPlainLanguage(cron: string): string {
  if (!cron || typeof cron !== 'string') return 'Unknown';
  const trimmed = cron.trim();

  if (trimmed === '*/1 * * * *' || trimmed === '* * * * *') {
    return 'Every 1 minute';
  }
  if (trimmed === '*/5 * * * *') {
    return 'Every 5 minutes';
  }
  if (trimmed === '*/10 * * * *') {
    return 'Every 10 minutes';
  }
  if (trimmed === '*/15 * * * *') {
    return 'Every 15 minutes';
  }
  if (trimmed === '*/30 * * * *') {
    return 'Every 30 minutes';
  }
  if (trimmed === '0 * * * *' || trimmed === '0 */1 * * *') {
    return 'Every hour (60 min)';
  }
  if (trimmed === '0 0 * * *') {
    return 'Every 24 hours (daily)';
  }

  // Regex pattern matching for */N * * * *
  const minMatch = trimmed.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (minMatch) {
    const mins = Number(minMatch[1]);
    return `Every ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  }

  // Regex pattern matching for 0 */N * * *
  const hourMatch = trimmed.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (hourMatch) {
    const hrs = Number(hourMatch[1]);
    return `Every ${hrs} ${hrs === 1 ? 'hour' : 'hours'} (${hrs * 60} min)`;
  }

  return `Custom Schedule (${trimmed})`;
}

/**
 * Converts a cron expression into whole minutes if possible.
 */
export function cronToMinutes(cron: string): number | null {
  if (!cron) return null;
  const trimmed = cron.trim();
  if (trimmed === '* * * * *' || trimmed === '*/1 * * * *') return 1;
  if (trimmed === '0 * * * *' || trimmed === '0 */1 * * *') return 60;
  if (trimmed === '0 0 * * *') return 1440;

  const minMatch = trimmed.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (minMatch) return parseInt(minMatch[1], 10);

  const hourMatch = trimmed.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60;

  return null;
}

/**
 * Builds a valid 5-field cron string from an integer number of minutes (1 - 1440).
 * - For 1 to 59: `* /<N> * * * *`
 * - For 60 or multiples of 60: hourly expressions like `0 * * * *`, `0 * /2 * * *`, `0 0 * * *`
 */
export function minutesToCron(mins: number): string {
  if (mins >= 1 && mins <= 59) {
    return `*/${mins} * * * *`;
  }
  if (mins % 60 === 0) {
    const hours = mins / 60;
    if (hours === 1) return '0 * * * *';
    if (hours === 24) return '0 0 * * *';
    return `0 */${hours} * * *`;
  }
  // Fallback for non-multiples of 60: closest hour expression
  const hours = Math.max(1, Math.round(mins / 60));
  return hours === 1 ? '0 * * * *' : hours === 24 ? '0 0 * * *' : `0 */${hours} * * *`;
}

interface PollingSettingsSectionProps {
  onIntervalChanged?: (newCron: string, plainLabel: string) => void;
  onBackToUsers?: () => void;
  parentAuthStatus?: 'checking' | 'authenticated' | 'unauthenticated';
  onUnauthorized?: () => void;
}

export const PollingSettingsSection: React.FC<PollingSettingsSectionProps> = ({
  onIntervalChanged,
  onBackToUsers,
  parentAuthStatus,
  onUnauthorized,
}) => {
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>(
    parentAuthStatus === 'authenticated' ? 'authenticated' : 'checking'
  );
  const [currentCron, setCurrentCron] = useState<string>('*/1 * * * *');
  const [selectedPreset, setSelectedPreset] = useState<string>('*/1 * * * *');
  const [customMinutes, setCustomMinutes] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Synchronize state from API fetch
  const applyFetchedCron = useCallback((cron: string) => {
    setCurrentCron(cron);
    const mins = cronToMinutes(cron);
    if (mins !== null) {
      setCustomMinutes(String(mins));
      const match = POLLING_PRESETS.find((p) => p.value === cron || p.minutes === mins);
      if (match) {
        setSelectedPreset(match.value);
      } else {
        setSelectedPreset('custom');
      }
    } else {
      setSelectedPreset('custom');
    }
  }, []);

  // Three-state auth check followed by settings load
  const checkAuthAndLoad = useCallback(async () => {
    setAuthStatus('checking');
    setErrorMsg(null);
    try {
      // 1. Verify session with GET /api/auth/me
      const authRes = await fetchWithAuth('/api/auth/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) {
        setAuthStatus('unauthenticated');
        setErrorMsg('Admin authentication required. Please log in.');
        setLoading(false);
        return;
      }
      setAuthStatus('authenticated');
      setErrorMsg(null);

      // 2. Fetch active polling settings with fetchWithAuth
      setLoading(true);
      const res = await fetchWithAuth('/api/settings/snmp-poll-cron');
      const data = await res.json();
      if (res.ok && data.cron) {
        applyFetchedCron(data.cron);
        setErrorMsg(null);
      } else if (res.status === 401) {
        setAuthStatus('unauthenticated');
        setErrorMsg(data.message || 'Admin authentication required. Please log in.');
      } else {
        setErrorMsg(data.message || 'Failed to fetch active polling settings.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error fetching polling settings.');
    } finally {
      setLoading(false);
    }
  }, [applyFetchedCron]);

  useEffect(() => {
    checkAuthAndLoad();
  }, [checkAuthAndLoad]);

  useEffect(() => {
    if (parentAuthStatus && parentAuthStatus !== 'checking') {
      setAuthStatus(parentAuthStatus);
    }
  }, [parentAuthStatus]);

  // Frontend validation for custom interval (whole number between 1 and 1440)
  const validation = useMemo<{ isValid: boolean; error: string | null; targetCron: string }>(() => {
    const trimmed = customMinutes.trim();
    if (!trimmed) {
      return { isValid: false, error: 'Please enter an interval in minutes.', targetCron: '' };
    }
    const num = Number(trimmed);
    if (!Number.isInteger(num)) {
      return { isValid: false, error: 'Interval must be a whole integer number.', targetCron: '' };
    }
    if (num < 1 || num > 1440) {
      return { isValid: false, error: 'Interval must be between 1 and 1440 minutes (1 min up to 24 hours).', targetCron: '' };
    }
    if (num >= 60 && num % 60 !== 0) {
      return {
        isValid: false,
        error: 'Intervals of 60 minutes or more must be a multiple of 60 (e.g. 60, 120, 180... up to 1440 mins / 24 hours) for standard cron scheduling.',
        targetCron: '',
      };
    }

    const built = minutesToCron(num);
    return { isValid: true, error: null, targetCron: built };
  }, [customMinutes]);

  // Handling preset selection
  const handlePresetSelect = (value: string) => {
    setSelectedPreset(value);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (value !== 'custom') {
      const preset = POLLING_PRESETS.find((p) => p.value === value);
      if (preset) {
        setCustomMinutes(String(preset.minutes));
      }
    }
  };

  // Handling manual number input
  const handleCustomMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomMinutes(val);
    setErrorMsg(null);
    setSuccessMsg(null);

    const num = Number(val.trim());
    if (Number.isInteger(num) && num >= 1 && num <= 1440) {
      const match = POLLING_PRESETS.find((p) => p.minutes === num);
      if (match) {
        setSelectedPreset(match.value);
      } else {
        setSelectedPreset('custom');
      }
    } else {
      setSelectedPreset('custom');
    }
  };

  // Check if target cron has changed from active cron
  const isChanged = validation.isValid && validation.targetCron.trim() !== currentCron.trim();

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Please provide a valid polling interval.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cronToSend = validation.targetCron.trim();

    try {
      const res = await fetchWithAuth('/api/settings/snmp-poll-cron', {
        method: 'PUT',
        body: JSON.stringify({ cron: cronToSend }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        setErrorMsg(data.message || 'Admin authentication required. Please log in.');
        return;
      }

      if (res.ok && data.cron) {
        setCurrentCron(data.cron);
        applyFetchedCron(data.cron);
        const plain = formatCronToPlainLanguage(data.cron);
        setSuccessMsg(data.message || `SNMP polling interval successfully updated to ${plain}.`);
        if (onIntervalChanged) {
          onIntervalChanged(data.cron, plain);
        }
      } else {
        setErrorMsg(data.message || 'Failed to update SNMP polling interval.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error updating polling interval.');
    } finally {
      setSaving(false);
    }
  };

  const plainLanguage = formatCronToPlainLanguage(currentCron);

  // 1. While authStatus is 'checking', show a neutral loading indicator — NEVER show the red error banner
  if (authStatus === 'checking') {
    return (
      <div className="bg-base-200/60 p-6 sm:p-8 rounded-xl border border-base-content/10 flex flex-col items-center justify-center py-14 gap-3 text-center animate-fadeIn">
        <span className="loading loading-spinner loading-md text-primary" />
        <span className="text-xs font-semibold text-base-content/70">
          Verifying administrator authorization &amp; loading settings...
        </span>
      </div>
    );
  }

  // 2. Only show error state in the 'unauthenticated' case
  if (authStatus === 'unauthenticated') {
    return (
      <div className="bg-base-200/60 p-4 sm:p-5 rounded-xl border border-base-content/10 space-y-4 animate-fadeIn">
        <div className="p-3.5 rounded-xl bg-error/10 border border-error/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-error font-medium">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold block">Admin authentication required. Please log in.</span>
              <span className="text-[11px] opacity-80">
                Only authenticated administrators can view or modify SNMP polling intervals.
              </span>
            </div>
          </div>
          {onUnauthorized && (
            <button
              type="button"
              onClick={() => {
                clearAuth();
                onUnauthorized();
              }}
              className="btn btn-error btn-sm gap-1.5 text-xs font-bold shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}
        </div>
        {onBackToUsers && (
          <button
            type="button"
            onClick={onBackToUsers}
            className="btn btn-sm btn-ghost gap-1.5 text-xs text-base-content/70 hover:text-base-content"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Users</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-base-200/60 p-4 sm:p-5 rounded-xl border border-base-content/10 space-y-4 animate-fadeIn">
      
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-base-content/10 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/90 flex items-center gap-2">
              <span>SNMP Polling Settings</span>
              <span className="badge badge-xs badge-primary font-mono">Live Sync</span>
            </h3>
            <p className="text-[11px] text-base-content/60">
              Configure background SNMP sweep cadence across fleet nodes without server restarts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToUsers && (
            <button
              type="button"
              onClick={onBackToUsers}
              className="btn btn-ghost btn-xs text-base-content/70 hover:text-primary flex items-center gap-1"
              title="Return to user list"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Users</span>
            </button>
          )}

          <button
            type="button"
            onClick={checkAuthAndLoad}
            disabled={loading}
            className="btn btn-ghost btn-xs text-base-content/60 hover:text-primary flex items-center gap-1"
            title="Refresh current interval from server"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-2 text-xs text-error font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2 text-xs text-success font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Current Active Interval Display (Read-only plain language) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-base-100 p-3.5 rounded-xl border border-base-content/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-base-content/50 tracking-wider block">
              Active Polling Interval
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-extrabold text-base-content">
                {loading ? 'Fetching...' : plainLanguage}
              </span>
              <span className="badge badge-sm badge-outline font-mono text-[10px] text-base-content/70">
                {currentCron}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-base-100 p-3.5 rounded-xl border border-base-content/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-base-content/50 tracking-wider block">
              Scheduler Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Active in background
              </span>
              <span className="text-[10px] text-base-content/50">
                (Database backed)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interval Form with Presets Dropdown and Manual Custom Number Input */}
      <form onSubmit={handleSave} className="bg-base-100 p-4 rounded-xl border border-base-content/10 space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 1. Preset Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-base-content/80 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span>Common Presets</span>
              </span>
              <span className="text-[10px] text-base-content/50">
                Quick selection
              </span>
            </label>

            <select
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              disabled={saving || loading}
              className="select select-bordered select-sm w-full text-xs bg-base-200/50 font-medium"
            >
              {POLLING_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom" disabled>
                Custom Interval (Set below)
              </option>
            </select>
            <p className="text-[10px] text-base-content/50 mt-1">
              Selecting a preset automatically fills the custom minutes input.
            </p>
          </div>

          {/* 2. Custom Number Input */}
          <div>
            <label className="block text-xs font-semibold text-base-content/80 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-primary" />
                <span>Custom interval (minutes)</span>
              </span>
              <span className="text-[10px] font-mono text-base-content/50">
                1 – 1440 min
              </span>
            </label>

            <div className="relative">
              <input
                type="number"
                min={1}
                max={1440}
                step={1}
                placeholder="e.g. 5, 15, 60, 120"
                value={customMinutes}
                onChange={handleCustomMinutesChange}
                disabled={saving || loading}
                className={`input input-bordered input-sm w-full text-xs bg-base-200/50 font-mono pr-14 ${
                  validation.error ? 'input-error' : ''
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-base-content/50 font-semibold pointer-events-none">
                minutes
              </span>
            </div>

            <p className="text-[10px] text-base-content/50 mt-1">
              1–59 min (sub-hour), or multiples of 60 up to 1440 (hourly).
            </p>
          </div>

        </div>

        {/* Inline Validation Error */}
        {validation.error && (
          <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2 text-xs text-warning font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{validation.error}</span>
          </div>
        )}

        {/* Computed Cron Preview & Save Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-base-content/10">
          <div className="flex items-center gap-2 text-[11px] text-base-content/70 w-full sm:w-auto">
            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              Target schedule: <code className="font-mono text-primary font-bold">{validation.targetCron || '—'}</code> ({formatCronToPlainLanguage(validation.targetCron)})
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || loading || !validation.isValid || !isChanged}
            className={`btn btn-primary btn-sm min-w-[130px] flex items-center justify-center gap-1.5 w-full sm:w-auto ${
              !validation.isValid || !isChanged ? 'btn-disabled opacity-60' : 'shadow-md shadow-primary/20'
            }`}
          >
            {saving ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Interval</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};

export default PollingSettingsSection;

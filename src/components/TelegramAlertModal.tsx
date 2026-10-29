import React, { useState, useEffect } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RotateCcw, 
  ShieldCheck, 
  Clock, 
  Smartphone, 
  Key, 
  Radio, 
  Check, 
  Sparkles,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { fetchWithAuth } from '../utils/auth';

interface TelegramSettings {
  enabled: boolean;
  chatId: string;
  botTokenConfigured: boolean;
  maskedToken: string;
  cooldownHours: number;
  policy: string;
  stats: {
    totalAlertsSent: number;
    alertedDevicesToday: number;
    activeTrackedDevices: number;
  };
}

interface AlertHistoryItem {
  deviceId: string;
  ip: string;
  hostname: string;
  severity: string;
  issues: string[];
  timestamp: number;
  dateStr: string;
  timeString: string;
}

interface ActiveCooldownItem {
  deviceId: string;
  hostname: string;
  ip: string;
  severity: string;
  alertedAt: string;
  remainingHours: string;
  isLockedToday: boolean;
}

interface TelegramAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramAlertModal: React.FC<TelegramAlertModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [cooldowns, setCooldowns] = useState<ActiveCooldownItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [chatId, setChatId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch settings & history
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resSettings, resHistory] = await Promise.all([
        fetchWithAuth('/api/telegram/settings'),
        fetchWithAuth('/api/telegram/history'),
      ]);

      if (resSettings.ok) {
        const sData = await resSettings.json();
        setSettings(sData);
        setChatId(sData.chatId || '');
        setEnabled(sData.enabled !== false);
      }

      if (resHistory.ok) {
        const hData = await resHistory.json();
        setHistory(hData.history || []);
        setCooldowns(hData.activeCooldowns || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setNotification(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    try {
      const payload: any = {
        chatId: chatId.trim(),
        enabled,
      };
      if (showTokenInput && botToken.trim()) {
        payload.botToken = botToken.trim();
      }

      const res = await fetchWithAuth('/api/telegram/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setNotification({
          type: 'success',
          message: 'Telegram alert configuration saved successfully.',
        });
        setShowTokenInput(false);
        setBotToken('');
      } else {
        const err = await res.json();
        setNotification({ type: 'error', message: err.message || 'Failed to save settings.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Network error saving settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setNotification(null);

    try {
      const res = await fetchWithAuth('/api/telegram/test', {
        method: 'POST',
        body: JSON.stringify({
          chatId: chatId.trim() || undefined,
          botToken: botToken.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          message: 'Test alert sent! Check your Telegram app for the instant confirmation message.',
        });
        loadData();
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Telegram test failed. Please verify Bot Token and Chat ID.',
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Network error testing Telegram.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCooldown = async (devId: string = 'all') => {
    try {
      const res = await fetchWithAuth('/api/telegram/clear-cooldown', {
        method: 'POST',
        body: JSON.stringify({ deviceId: devId }),
      });
      if (res.ok) {
        setNotification({
          type: 'success',
          message: devId === 'all' ? 'All device daily cooldowns have been reset.' : 'Device cooldown reset.',
        });
        loadData();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-100 rounded-3xl border border-base-content/10 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-base-content/10 bg-base-200/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-base-content tracking-tight">Telegram Alert Bot</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Active
                </span>
              </div>
              <p className="text-xs text-base-content/60 mt-0.5">
                Instant Warning &amp; Critical notifications • Policy: 1 alert per device per day
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-square rounded-xl text-base-content/60 hover:text-base-content"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {notification && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-fadeIn ${
              notification.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-semibold leading-relaxed flex-1">
                {notification.message}
              </div>
            </div>
          )}

          {/* Quick Summary Pill Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-base-200/50 border border-base-content/10">
              <div className="text-[11px] font-mono uppercase tracking-wider text-base-content/50 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" />
                Alert Frequency
              </div>
              <div className="text-sm font-bold text-base-content mt-1">1 Alert / Day</div>
              <div className="text-[10px] text-base-content/50">24-hour host cooldown</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-base-200/50 border border-base-content/10">
              <div className="text-[11px] font-mono uppercase tracking-wider text-base-content/50 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-sky-500" />
                Target Chat ID
              </div>
              <div className="text-sm font-mono font-bold text-base-content mt-1">{settings?.chatId || chatId || '8973067640'}</div>
              <div className="text-[10px] text-base-content/50">Private / Group Alerting</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-base-200/50 border border-base-content/10">
              <div className="text-[11px] font-mono uppercase tracking-wider text-base-content/50 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Trigger State
              </div>
              <div className="text-sm font-bold text-base-content mt-1">Warning &amp; Critical</div>
              <div className="text-[10px] text-base-content/50">Offline, CPU, RAM, Temp</div>
            </div>
          </div>

          {/* Settings Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="p-5 rounded-2xl border border-base-content/10 bg-base-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-base-content/10">
                <div>
                  <h3 className="text-sm font-bold text-base-content">Bot Connection Details</h3>
                  <p className="text-[11px] text-base-content/50">Verified active Telegram Bot token &amp; recipient Chat ID</p>
                </div>
                
                {/* Enable toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs font-semibold text-base-content/70">
                    {enabled ? 'Alerts Enabled' : 'Alerts Paused'}
                  </span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="toggle toggle-primary toggle-sm"
                  />
                </label>
              </div>

              {/* Chat ID Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-base-content flex items-center justify-between">
                  <span>Telegram Chat ID / Group ID</span>
                  <span className="text-[11px] font-normal text-base-content/50">Recipient ID</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="e.g. 8973067640"
                    className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 font-mono text-sm text-base-content focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-base-content/40">
                  Messages are sent directly to your Telegram chat (ID: <code>{chatId || '8973067640'}</code>)
                </p>
              </div>

              {/* Bot Token Configuration */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-base-content flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-accent" />
                    <span>Bot Token</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {showTokenInput ? 'Keep Current Token' : 'Change Bot Token'}
                  </button>
                </div>

                {showTokenInput ? (
                  <input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="e.g. 9048015016:AAG_n00x2g2y9CiHrDF9qwnQQx_DgoQMGyI"
                    className="w-full px-4 py-2.5 rounded-xl border border-base-content/15 bg-base-200/50 font-mono text-xs text-base-content focus:bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                ) : (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-base-content/10 bg-base-200/40 text-xs font-mono text-base-content/70">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>{settings?.maskedToken || '904801...QMGyI'}</span>
                    </div>
                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Connected</span>
                  </div>
                )}
              </div>

              {/* Buttons: Save & Test */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isTesting}
                  className="btn btn-sm btn-outline rounded-xl text-xs gap-1.5 hover:bg-sky-500 hover:text-white hover:border-sky-500"
                >
                  <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Sending Test...' : 'Send Test Alert to Telegram'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-sm btn-primary rounded-xl text-xs font-bold px-5"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </form>

          {/* Rate-Limited / Cooldown Devices Section */}
          <div className="p-5 rounded-2xl border border-base-content/10 bg-base-200/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-base-content">
                  Active 24h Daily Cooldowns ({cooldowns.length})
                </h4>
              </div>
              {cooldowns.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleClearCooldown('all')}
                  className="text-[10px] text-warning hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All Cooldowns</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-base-content/60">
              Under the <strong>1 Alert per Device per Day</strong> policy, once a device sends an alert for warning or critical status, it is locked for 24 hours to prevent spamming your chat.
            </p>

            {cooldowns.length === 0 ? (
              <div className="p-4 rounded-xl bg-base-100 border border-base-content/10 text-center text-xs text-base-content/50">
                No devices currently in daily cooldown. Any device that encounters a Warning or Critical state will alert immediately.
              </div>
            ) : (
              <div className="divide-y divide-base-content/10 rounded-xl bg-base-100 border border-base-content/10 overflow-hidden">
                {cooldowns.map((cd) => (
                  <div key={cd.deviceId} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold font-mono text-base-content">{cd.hostname}</span>
                      <span className="text-[11px] text-base-content/50 ml-2 font-mono">({cd.ip})</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-error/10 text-error">
                        {cd.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-base-content/50">
                        Unlocked in ~{cd.remainingHours}h
                      </span>
                      <button
                        onClick={() => handleClearCooldown(cd.deviceId)}
                        className="text-[10px] font-bold text-primary hover:underline"
                        title="Allow alert again now"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Alert Dispatches */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>Recent Telegram Alert Dispatches</span>
            </h4>

            {history.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-base-content/20 text-center text-xs text-base-content/50">
                No telemetry alert dispatches yet. Use &ldquo;Send Test Alert to Telegram&rdquo; above to verify your phone receives notifications.
              </div>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 5).map((h, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-base-content/10 bg-base-100 flex items-start justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          h.severity === 'CRITICAL' || h.severity.includes('OFFLINE')
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {h.severity}
                        </span>
                        <span className="font-bold font-mono text-base-content">{h.hostname}</span>
                        <span className="font-mono text-base-content/50">({h.ip})</span>
                      </div>
                      <div className="text-[11px] text-base-content/70">
                        {h.issues?.join(', ') || 'SLA Threshold breached'}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-base-content/40 whitespace-nowrap">
                      {h.timeString}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-content/10 bg-base-200/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-base-content/60">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>HealthStream Telegram Engine v1.0</span>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-sm btn-ghost rounded-xl font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

/**
 * HealthStream Telegram Alert Notification Engine
 * Policy: 1 Alert For Each Device per Day (24-hour deduplication window)
 */

import { getSetting, setSetting } from './db.js';

// Default configuration provided by user
const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9048015016:AAG_n00x2g2y9CiHrDF9qwnQQx_DgoQMGyI';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8973067640';

/**
 * In-memory map to enforce 1 Alert per Device per Day.
 * Key: deviceId or deviceIp
 * Value: { timestamp, dateStr, status, issue, hostname, ip }
 */
const dailyAlertCache = new Map();

/**
 * Circular buffer of recent alert dispatch logs (last 50)
 */
const alertHistoryLog = [];

/**
 * Get current Telegram settings
 */
export async function getTelegramSettings() {
  const token = (await getSetting('telegram_bot_token')) || DEFAULT_BOT_TOKEN;
  const chatId = (await getSetting('telegram_chat_id')) || DEFAULT_CHAT_ID;
  const enabledStr = await getSetting('telegram_enabled');
  const enabled = enabledStr !== null ? enabledStr === 'true' : true;
  const cooldownStr = await getSetting('telegram_cooldown_hours');
  const cooldownHours = cooldownStr && !isNaN(Number(cooldownStr)) && Number(cooldownStr) > 0 ? Number(cooldownStr) : 24;

  const todayStr = new Date().toISOString().slice(0, 10);
  let alertedTodayCount = 0;
  for (const entry of dailyAlertCache.values()) {
    if (entry.dateStr === todayStr) {
      alertedTodayCount++;
    }
  }

  const policy = cooldownHours >= 24 && cooldownHours % 24 === 0
    ? `1 Alert per Device per ${cooldownHours / 24 === 1 ? 'Day' : `${cooldownHours / 24} Days`} (${cooldownHours}-hour deduplication)`
    : `1 Alert per Device per ${cooldownHours} ${cooldownHours === 1 ? 'Hour' : 'Hours'} (${cooldownHours}-hour deduplication)`;

  return {
    enabled,
    chatId: chatId ? String(chatId) : '',
    botTokenConfigured: Boolean(token && token.trim()),
    // Mask token for security in UI
    maskedToken: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : '',
    cooldownHours,
    policy,
    stats: {
      totalAlertsSent: alertHistoryLog.length,
      alertedDevicesToday: alertedTodayCount,
      activeTrackedDevices: dailyAlertCache.size,
    },
  };
}

/**
 * Update Telegram settings
 */
export async function updateTelegramSettings({ botToken, chatId, enabled, cooldownHours }) {
  if (botToken !== undefined) {
    await setSetting('telegram_bot_token', String(botToken).trim());
  }
  if (chatId !== undefined) {
    await setSetting('telegram_chat_id', String(chatId).trim());
  }
  if (enabled !== undefined) {
    await setSetting('telegram_enabled', enabled ? 'true' : 'false');
  }
  if (cooldownHours !== undefined) {
    const parsedH = Math.max(1, Math.round(Number(cooldownHours) || 24));
    await setSetting('telegram_cooldown_hours', String(parsedH));
  }
  return await getTelegramSettings();
}

/**
 * Low-level Telegram sendMessage API
 */
export async function sendTelegramMessage(text, customChatId, customToken) {
  const token = customToken || (await getSetting('telegram_bot_token')) || DEFAULT_BOT_TOKEN;
  const chatId = customChatId || (await getSetting('telegram_chat_id')) || DEFAULT_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('Telegram Bot Token or Chat ID is not configured.');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(chatId),
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API Error (${response.status})`);
  }

  return data;
}

/**
 * Format alert reason from telemetry
 */
function extractAlertReasons(telemetry) {
  const issues = [];
  const statusStr = String(telemetry.status || '').toLowerCase();

  if (statusStr === 'offline' || statusStr === 'down' || telemetry.snmp_reachable === false) {
    issues.push('Host unreachable / Ping & SNMP heartbeat offline');
    return issues;
  }

  const cpu = Number(telemetry.cpu_usage || 0);
  const ram = Number(telemetry.ram_usage || 0);
  const disk = Number(telemetry.disk_usage || 0);
  const temp = telemetry.temperature !== null && telemetry.temperature !== undefined ? Number(telemetry.temperature) : null;

  if (cpu >= 85) issues.push(`CPU Critical: ${cpu.toFixed(1)}% (Threshold: 85%)`);
  else if (cpu >= 70) issues.push(`CPU Warning: ${cpu.toFixed(1)}% (Threshold: 70%)`);

  if (ram >= 85) issues.push(`RAM Critical: ${ram.toFixed(1)}% (Threshold: 85%)`);
  else if (ram >= 70) issues.push(`RAM Warning: ${ram.toFixed(1)}% (Threshold: 70%)`);

  if (disk >= 85) issues.push(`Disk Critical: ${disk.toFixed(1)}% (Threshold: 85%)`);
  else if (disk >= 70) issues.push(`Disk Warning: ${disk.toFixed(1)}% (Threshold: 70%)`);

  if (temp !== null) {
    if (temp >= 75) issues.push(`Temperature Critical: ${temp.toFixed(1)}°C (Threshold: 75°C)`);
    else if (temp >= 60) issues.push(`Temperature Warning: ${temp.toFixed(1)}°C (Threshold: 60°C)`);
  }

  // Check hardware units if present
  if (Array.isArray(telemetry.power_supplies)) {
    for (const psu of telemetry.power_supplies) {
      const st = String(psu.status || '').toLowerCase();
      if (st && st !== 'ok' && st !== 'normal') {
        issues.push(`PSU Failure: ${psu.name || 'PSU'} status: ${psu.status}`);
      }
    }
  }

  if (Array.isArray(telemetry.fans)) {
    for (const fan of telemetry.fans) {
      const st = String(fan.status || '').toLowerCase();
      if (st && st !== 'ok' && st !== 'normal') {
        issues.push(`Fan Failure: ${fan.name || 'Fan'} status: ${fan.status}`);
      }
    }
  }

  // Check interface CRC error thresholds
  let ifacesList = telemetry.interfaces;
  if (typeof ifacesList === 'string') {
    try { ifacesList = JSON.parse(ifacesList); } catch {}
  }
  if (Array.isArray(ifacesList)) {
    for (const iface of ifacesList) {
      const crc = Number(iface?.crc_errors);
      if (!isNaN(crc) && crc > 0) {
        if (crc >= 50) {
          issues.push(`Port ${iface.name || iface.index} CRC Critical: ${crc.toLocaleString()} errors (Threshold: 50)`);
        } else if (crc >= 10) {
          issues.push(`Port ${iface.name || iface.index} CRC Warning: ${crc.toLocaleString()} errors (Threshold: 10)`);
        }
      }
    }
  }

  if (issues.length === 0 && (telemetry.health === 'Critical' || telemetry.health === 'Warning' || telemetry.health === 'High CPU')) {
    issues.push(`Device health marked as ${telemetry.health}`);
  }

  return issues;
}

/**
 * Check if a device has an active Warning or Critical state,
 * and dispatch an alert IF it has not already been alerted today.
 *
 * Enforces: "1 Alert For Each Devices one day"
 */
export async function checkAndDispatchTelegramAlert(device, telemetry) {
  try {
    const enabledStr = await getSetting('telegram_enabled');
    const enabled = enabledStr !== null ? enabledStr === 'true' : true;
    if (!enabled) return { sent: false, reason: 'alerts_disabled' };

    const status = String(telemetry.status || device.status || '').toLowerCase();
    const health = String(telemetry.health || device.health || '').trim();

    const isOffline = status === 'offline' || status === 'down' || telemetry.snmp_reachable === false;
    const isWarningOrCritical =
      isOffline ||
      health === 'Critical' ||
      health === 'Warning' ||
      health === 'High CPU' ||
      Number(telemetry.cpu_usage) >= 70 ||
      Number(telemetry.ram_usage) >= 70 ||
      Number(telemetry.disk_usage) >= 70 ||
      (telemetry.temperature !== null && Number(telemetry.temperature) >= 60);

    if (!isWarningOrCritical) {
      return { sent: false, reason: 'nominal_health' };
    }

    const deviceId = String(device.id || telemetry.id || telemetry.ip_address || device.ip_address || device.ip);
    const ip = String(telemetry.ip_address || device.ip_address || device.ip || 'Unknown IP');
    const hostname = String(telemetry.hostname || device.hostname || telemetry.sys_name || `node-${ip.replace(/\./g, '-')}`);
    const deviceType = String(device.device_type || telemetry.device_type || 'Device');
    const location = String(device.location || telemetry.location || device.datacenter_name || 'Datacenter');
    const rack = device.rack_number || telemetry.rack_number || 'Unassigned';

    // Configurable Alert Cooldown Check (by hours or days)
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const cooldownStr = await getSetting('telegram_cooldown_hours');
    const cooldownHours = cooldownStr && !isNaN(Number(cooldownStr)) && Number(cooldownStr) > 0 ? Number(cooldownStr) : 24;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    const existingAlert = dailyAlertCache.get(deviceId) || dailyAlertCache.get(ip);
    if (existingAlert) {
      const timeDiff = now - existingAlert.timestamp;

      if (timeDiff < cooldownMs) {
        const remainingHours = Math.max(0.1, (cooldownMs - timeDiff) / (60 * 60 * 1000)).toFixed(1);
        return {
          sent: false,
          reason: 'cooldown_active',
          message: `Device ${hostname} (${ip}) in cooldown (unlocked in ~${remainingHours}h).`,
          nextAllowed: new Date(existingAlert.timestamp + cooldownMs).toISOString(),
        };
      }
    }

    // Build issues
    const issues = extractAlertReasons(telemetry);
    const issueText = issues.length > 0 ? issues.map((i) => `• ${i}`).join('\n') : '• Telemetry SLA threshold breached';
    const severityEmoji = isOffline || health === 'Critical' ? '🚨' : '⚠️';
    const severityLabel = isOffline ? 'OFFLINE / DOWN' : health.toUpperCase() || 'WARNING';

    const message = [
      `${severityEmoji} *HealthStream Infrastructure Alert*`,
      ``,
      `*Device:* \`${hostname}\``,
      `*IP Address:* \`${ip}\``,
      `*Type:* ${deviceType}`,
      `*Severity:* *${severityLabel}*`,
      `*Data Center or Location:* ${location}`,
      rack && rack !== 'Unassigned' ? `*Rack:* ${rack}` : null,
      ``,
      `*Detected Issues:*`,
      issueText,
      ``,
      telemetry.cpu_usage !== undefined ? `*CPU:* ${Number(telemetry.cpu_usage).toFixed(1)}%  |  *RAM:* ${Number(telemetry.ram_usage).toFixed(1)}%` : null,
      telemetry.uptime ? `*Uptime:* ${telemetry.uptime}` : null,
      ``,
      `🕒 _Timestamp: ${new Date().toUTCString()}_`,
      `🔒 _Policy: 1 alert per device per ${cooldownHours >= 24 && cooldownHours % 24 === 0 ? (cooldownHours === 24 ? 'day' : `${cooldownHours / 24} days`) : `${cooldownHours}h`} (Next alert for this host unlocked in ${cooldownHours}h)_`,
    ].filter(Boolean).join('\n');

    // Send Telegram message
    await sendTelegramMessage(message);

    // Record alert in cache and history
    const record = {
      deviceId,
      ip,
      hostname,
      severity: severityLabel,
      issues,
      timestamp: now,
      dateStr: todayStr,
      timeString: new Date().toLocaleTimeString(),
    };

    dailyAlertCache.set(deviceId, record);
    dailyAlertCache.set(ip, record);

    alertHistoryLog.unshift(record);
    if (alertHistoryLog.length > 50) {
      alertHistoryLog.pop();
    }

    console.log(`[Telegram Alert] Successfully dispatched daily alert for ${hostname} (${ip}) [${severityLabel}]`);

    return {
      sent: true,
      deviceId,
      hostname,
      ip,
      severity: severityLabel,
      timestamp: now,
    };
  } catch (err) {
    console.error('[Telegram Alert Error]', err?.message || err);
    return { sent: false, error: err?.message };
  }
}

/**
 * Send a test alert message
 */
export async function sendTestTelegramAlert(customChatId, customToken) {
  const cooldownStr = await getSetting('telegram_cooldown_hours');
  const cooldownHours = cooldownStr && !isNaN(Number(cooldownStr)) && Number(cooldownStr) > 0 ? Number(cooldownStr) : 24;
  const policyLabel = cooldownHours >= 24 && cooldownHours % 24 === 0 
    ? `1 Alert For Each Device per ${cooldownHours === 24 ? 'Day' : `${cooldownHours / 24} Days`}`
    : `1 Alert For Each Device every ${cooldownHours} Hours`;

  const testMessage = [
    `🔔 *HealthStream Telemetry Alert Test*`,
    ``,
    `*System Status:* Active & Online`,
    `*Target Chat ID:* \`${customChatId || DEFAULT_CHAT_ID}\``,
    `*Policy Active:* ${policyLabel}`,
    `*Telemetry Engine:* HealthStream Monitoring v4.8`,
    ``,
    `✅ _If you received this message, your Telegram Bot integration is configured properly and ready to dispatch Warning & Critical device alerts._`,
    `🕒 _Sent at: ${new Date().toUTCString()}_`,
  ].join('\n');

  return await sendTelegramMessage(testMessage, customChatId, customToken);
}

/**
 * Get recent alert dispatch history & rate-limited devices
 */
export async function getTelegramAlertHistory() {
  const activeCooldowns = [];
  const now = Date.now();
  const cooldownStr = await getSetting('telegram_cooldown_hours');
  const cooldownHours = cooldownStr && !isNaN(Number(cooldownStr)) && Number(cooldownStr) > 0 ? Number(cooldownStr) : 24;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;

  for (const [key, entry] of dailyAlertCache.entries()) {
    if (key === entry.deviceId) {
      const remainingMs = Math.max(0, entry.timestamp + cooldownMs - now);
      if (remainingMs > 0) {
        activeCooldowns.push({
          deviceId: entry.deviceId,
          hostname: entry.hostname,
          ip: entry.ip,
          severity: entry.severity,
          alertedAt: new Date(entry.timestamp).toISOString(),
          remainingHours: (remainingMs / (1000 * 60 * 60)).toFixed(1),
          isLockedToday: true,
        });
      }
    }
  }

  return {
    history: alertHistoryLog.slice(0, 20),
    activeCooldowns,
  };
}

/**
 * Reset cooldown for a device or all devices (e.g. for testing)
 */
export function clearTelegramCooldown(deviceId) {
  if (deviceId && deviceId !== 'all') {
    dailyAlertCache.delete(deviceId);
    return { success: true, message: `Cooldown cleared for device ${deviceId}.` };
  }
  dailyAlertCache.clear();
  return { success: true, message: 'All device alert cooldowns have been reset.' };
}

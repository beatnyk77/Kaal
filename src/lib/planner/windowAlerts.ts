import type { AlertPreferences, PlannerWindow } from './types';
import { DEFAULT_ALERT_PREFS } from './types';

const STORAGE_KEY = 'kaal_window_alerts_v1';
const firedKey = (id: string) => `kaal_alert_fired_${id}`;

export function loadAlertPreferences(): AlertPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ALERT_PREFS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_ALERT_PREFS };
}

export function saveAlertPreferences(prefs: AlertPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function windowId(w: PlannerWindow): string {
  return `${w.windowStart.toISOString()}-ph${w.personalHour}`;
}

function shouldNotify(w: PlannerWindow, prefs: AlertPreferences): boolean {
  if (w.isMaster && prefs.notifyMaster) return true;
  if (w.quality === 'best' && prefs.notifyBest) return true;
  return false;
}

/** Check upcoming windows and fire browser notifications */
export function pollWindowAlerts(windows: PlannerWindow[], prefs: AlertPreferences, now = new Date()): void {
  if (!prefs.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  const leadMs = prefs.minutesBefore * 60_000;

  for (const w of windows) {
    if (!shouldNotify(w, prefs)) continue;

    const id = windowId(w);
    if (sessionStorage.getItem(firedKey(id))) continue;

    const notifyAt = w.windowStart.getTime() - leadMs;
    const notifyEnd = w.windowStart.getTime();
    const t = now.getTime();

    if (t >= notifyAt && t < notifyEnd) {
      const tier = w.isMaster ? 'master' : w.quality;
      const title = `Kaal: PH ${w.personalHour} (${tier}) in ${prefs.minutesBefore}m`;
      const body = `Deal window ${formatIstRange(w)} IST — sign, close, or ship.`;

      new Notification(title, { body, tag: id });
      sessionStorage.setItem(firedKey(id), '1');
    }
  }
}

function formatIstRange(w: PlannerWindow): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  return `${fmt(w.windowStart)}–${fmt(w.windowEnd)}`;
}

export function collectUpcomingAlertWindows(
  allWindows: PlannerWindow[],
  prefs: AlertPreferences,
  horizonHours = 24,
  now = new Date()
): PlannerWindow[] {
  const horizon = now.getTime() + horizonHours * 60 * 60_000;
  return allWindows.filter(
    (w) =>
      shouldNotify(w, prefs) &&
      w.windowStart.getTime() > now.getTime() &&
      w.windowStart.getTime() <= horizon
  );
}
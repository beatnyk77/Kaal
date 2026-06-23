import type { AlertPreferences, PlannerWindow } from './types';
import { collectUpcomingAlertWindows } from './windowAlerts';

const DB_NAME = 'kaal_sw_v1';
const DB_VERSION = 1;
const SCHEDULE_STORE = 'schedule';

export interface SerializedAlertWindow {
  id: string;
  windowStartMs: number;
  personalHour: number;
  tier: string;
  rangeLabel: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SCHEDULE_STORE)) {
        db.createObjectStore(SCHEDULE_STORE);
      }
      if (!db.objectStoreNames.contains('fired')) {
        db.createObjectStore('fired');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function windowId(w: PlannerWindow): string {
  return `${w.windowStart.toISOString()}-ph${w.personalHour}`;
}

function formatIstRange(w: PlannerWindow): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  return `${fmt(w.windowStart)}–${fmt(w.windowEnd)}`;
}

function serializeWindows(windows: PlannerWindow[]): SerializedAlertWindow[] {
  return windows.map((w) => ({
    id: windowId(w),
    windowStartMs: w.windowStart.getTime(),
    personalHour: w.personalHour,
    tier: w.isMaster ? 'master' : w.quality,
    rangeLabel: formatIstRange(w),
  }));
}

/** Publish alert schedule to IndexedDB for the service worker. */
export async function publishAlertSchedule(
  windows: PlannerWindow[],
  prefs: AlertPreferences,
  horizonHours = 7 * 24,
  now = new Date()
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const upcoming = collectUpcomingAlertWindows(windows, prefs, horizonHours, now);
  const serialized = serializeWindows(upcoming);

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SCHEDULE_STORE, 'readwrite');
    const store = tx.objectStore(SCHEDULE_STORE);
    store.put(prefs, 'prefs');
    store.put(serialized, 'windows');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SCHEDULE_UPDATED' });
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    return registration;
  } catch {
    return null;
  }
}
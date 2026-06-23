/* Kaal service worker — background deal-window alerts */

const DB_NAME = 'kaal_sw_v1';
const SCHEDULE_STORE = 'schedule';
const FIRED_STORE = 'fired';
const CHECK_MS = 60_000;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SCHEDULE_STORE)) {
        db.createObjectStore(SCHEDULE_STORE);
      }
      if (!db.objectStoreNames.contains(FIRED_STORE)) {
        db.createObjectStore(FIRED_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readSchedule(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCHEDULE_STORE, 'readonly');
    const store = tx.objectStore(SCHEDULE_STORE);
    const prefsReq = store.get('prefs');
    const windowsReq = store.get('windows');
    const result = { prefs: null, windows: [] };
    prefsReq.onsuccess = () => {
      result.prefs = prefsReq.result ?? null;
    };
    windowsReq.onsuccess = () => {
      result.windows = windowsReq.result ?? [];
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

function wasFired(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FIRED_STORE, 'readonly');
    const req = tx.objectStore(FIRED_STORE).get(id);
    req.onsuccess = () => resolve(Boolean(req.result));
    req.onerror = () => reject(req.error);
  });
}

function markFired(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FIRED_STORE, 'readwrite');
    tx.objectStore(FIRED_STORE).put(Date.now(), id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function checkAlerts() {
  let db;
  try {
    db = await openDb();
    const { prefs, windows } = await readSchedule(db);
    if (!prefs?.enabled || !windows?.length) return;

    const now = Date.now();
    const leadMs = (prefs.minutesBefore ?? 5) * 60_000;

    for (const w of windows) {
      const notifyAt = w.windowStartMs - leadMs;
      const notifyEnd = w.windowStartMs;
      if (now < notifyAt || now >= notifyEnd) continue;

      if (await wasFired(db, w.id)) continue;

      const title = `Kaal: PH ${w.personalHour} (${w.tier}) in ${prefs.minutesBefore}m`;
      const body = `Deal window ${w.rangeLabel} IST — sign, close, or ship.`;

      await self.registration.showNotification(title, { body, tag: w.id });
      await markFired(db, w.id);
    }
  } catch {
    // IDB or notification errors — skip this tick
  } finally {
    if (db) db.close();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await checkAlerts();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'SCHEDULE_UPDATED') {
    void checkAlerts();
  }
});

setInterval(() => {
  void checkAlerts();
}, CHECK_MS);
import { useRef, useState } from 'react';
import type { IntelligenceStore } from '../../lib/intelligence/memoryStore';
import {
  applyProfileForm,
  profileToFormValues,
  type ProfileFormValues,
} from '../../lib/intelligence/profileUpdate';
import {
  buildExportBundle,
  downloadExportBundle,
  importExportBundle,
  parseImportBundle,
} from '../../lib/intelligence/dataPortability';
import { persistActiveStore } from '../../lib/intelligence/storeBootstrap';
import { requestNotificationPermission } from '../../lib/planner/windowAlerts';
import { registerServiceWorker } from '../../lib/planner/alertSchedule';

interface SettingsPageProps {
  store: IntelligenceStore;
  userId: string;
  backend: 'sqlite' | 'memory';
  onProfileSaved: () => void;
}

export function SettingsPage({ store, userId, backend, onProfileSaved }: SettingsPageProps) {
  const profile = store.getProfile(userId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileFormValues | null>(() =>
    profile ? profileToFormValues(profile) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [swStatus, setSwStatus] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  if (!profile || !form) {
    return (
      <div className="kala-page">
        <p className="kala-loading">Loading settings…</p>
      </div>
    );
  }

  const phPreview = (() => {
    try {
      const updated = applyProfileForm(profile, form);
      return `BTN ${updated.numerology.btn} · transition :${updated.personal_hours.transition_minute}`;
    } catch {
      return null;
    }
  })();

  const update = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = applyProfileForm(profile, form);
      store.saveProfile(updated);
      await persistActiveStore(userId);
      setSaved(true);
      setError(null);
      onProfileSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaved(false);
    }
  };

  const handleExport = () => {
    const bundle = buildExportBundle(store, userId);
    if (!bundle) return;
    downloadExportBundle(bundle);
  };

  const handleImport = async (file: File) => {
    setImportStatus(null);
    try {
      const raw = await file.text();
      const bundle = parseImportBundle(raw);
      const importedId = await importExportBundle(store, bundle);
      await persistActiveStore(importedId);
      const imported = store.getProfile(importedId);
      if (imported) setForm(profileToFormValues(imported));
      setImportStatus(`Imported ${bundle.logs.length} logs for ${bundle.profile.identity.display_name}.`);
      onProfileSaved();
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleEnablePwa = async () => {
    const reg = await registerServiceWorker();
    setSwStatus(reg ? 'Service worker registered — install from browser menu for background alerts.' : 'Service worker unavailable in this browser.');
  };

  const handleNotifPerm = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
  };

  return (
    <div className="kala-page">
      <header className="kala-page__header">
        <div>
          <h1>Settings</h1>
          <p className="kala-subtitle">Profile, data portability, and PWA alerts · {backend} backend</p>
        </div>
      </header>

      <form className="kala-form kala-settings" onSubmit={(e) => void handleSave(e)}>
        <section className="kala-card">
          <h2>Profile</h2>
          <p className="kala-muted">Birth time drives BTN and Personal Hour transition minute.</p>

          <div className="kala-settings__grid">
            <label className="kala-field">
              <span>Display name</span>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => update('displayName', e.target.value)}
                required
              />
            </label>

            <label className="kala-field">
              <span>Birth date</span>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
                required
              />
            </label>

            <label className="kala-field">
              <span>Birth time (HH:MM)</span>
              <input
                type="text"
                value={form.birthTime}
                onChange={(e) => update('birthTime', e.target.value)}
                placeholder="20:20"
                required
              />
            </label>

            <label className="kala-field">
              <span>Core number</span>
              <input
                type="number"
                min={1}
                max={33}
                value={form.coreNumber}
                onChange={(e) => update('coreNumber', Number(e.target.value))}
                required
              />
            </label>

            <label className="kala-field">
              <span>Birth place</span>
              <input
                type="text"
                value={form.placeName}
                onChange={(e) => update('placeName', e.target.value)}
                placeholder="New Delhi"
              />
            </label>

            <label className="kala-field">
              <span>City</span>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="New Delhi"
              />
            </label>

            <label className="kala-field">
              <span>Latitude</span>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => update('latitude', Number(e.target.value))}
                required
              />
            </label>

            <label className="kala-field">
              <span>Longitude</span>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => update('longitude', Number(e.target.value))}
                required
              />
            </label>
          </div>

          {phPreview && <p className="kala-muted">Preview: {phPreview}</p>}
          {error && <p className="kala-error">{error}</p>}
          {saved && <p className="kala-success">Profile saved.</p>}

          <button type="submit" className="kala-btn kala-btn--primary">
            Save profile
          </button>
        </section>
      </form>

      <section className="kala-card">
        <h2>Data portability</h2>
        <p className="kala-muted">Export full intelligence state (profile + action logs) as JSON.</p>
        <div className="kala-settings__actions">
          <button type="button" className="kala-btn" onClick={handleExport}>
            Export JSON
          </button>
          <button type="button" className="kala-btn" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
        {importStatus && <p className={importStatus.startsWith('Imported') ? 'kala-success' : 'kala-error'}>{importStatus}</p>}
      </section>

      <section className="kala-card">
        <h2>PWA &amp; background alerts</h2>
        <p className="kala-muted">
          Install Kaal as an app and enable notifications for deal-window alerts while the app is in the background.
          Configure which windows to notify on the Planner tab.
        </p>
        <div className="kala-settings__actions">
          <button type="button" className="kala-btn" onClick={() => void handleEnablePwa()}>
            Register service worker
          </button>
          <button type="button" className="kala-btn kala-btn--primary" onClick={() => void handleNotifPerm()}>
            {notifPerm === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
          </button>
        </div>
        {swStatus && <p className="kala-muted">{swStatus}</p>}
        <p className="kala-muted">Notification permission: {notifPerm}</p>
      </section>
    </div>
  );
}
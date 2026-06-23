import { useState } from 'react';
import type { AlertPreferences } from '../../lib/planner/types';
import {
  loadAlertPreferences,
  requestNotificationPermission,
  saveAlertPreferences,
} from '../../lib/planner/windowAlerts';

interface WindowAlertPanelProps {
  upcomingCount: number;
}

export function WindowAlertPanel({ upcomingCount }: WindowAlertPanelProps) {
  const [prefs, setPrefs] = useState<AlertPreferences>(() => loadAlertPreferences());
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const update = (patch: Partial<AlertPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveAlertPreferences(next);
  };

  const enableAlerts = async () => {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === 'granted') update({ enabled: true });
  };

  return (
    <section className="kala-card">
      <h2>Window alerts</h2>
      <p className="kala-muted">
        Browser notifications {prefs.minutesBefore} min before best/master windows
        {upcomingCount > 0 ? ` · ${upcomingCount} in next 24h` : ''}
      </p>

      {perm === 'unsupported' ? (
        <p className="kala-muted">Notifications not supported in this browser.</p>
      ) : (
        <div className="kala-alert-settings">
          <label className="kala-checkbox">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => {
                if (e.target.checked && perm !== 'granted') void enableAlerts();
                else update({ enabled: e.target.checked });
              }}
            />
            Enable alerts
          </label>

          {perm === 'denied' && (
            <p className="kala-error-inline">Permission denied — enable in browser settings.</p>
          )}

          <label className="kala-field">
            <span>Minutes before window</span>
            <input
              type="number"
              min={1}
              max={30}
              value={prefs.minutesBefore}
              onChange={(e) => update({ minutesBefore: Number(e.target.value) })}
              disabled={!prefs.enabled}
            />
          </label>

          <label className="kala-checkbox">
            <input
              type="checkbox"
              checked={prefs.notifyBest}
              onChange={(e) => update({ notifyBest: e.target.checked })}
              disabled={!prefs.enabled}
            />
            Best tier (6, 8, 9…)
          </label>

          <label className="kala-checkbox">
            <input
              type="checkbox"
              checked={prefs.notifyMaster}
              onChange={(e) => update({ notifyMaster: e.target.checked })}
              disabled={!prefs.enabled}
            />
            Master (11, 22, 33)
          </label>
        </div>
      )}
    </section>
  );
}
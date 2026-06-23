import { useEffect, useMemo, useState } from 'react';
import { buildDayPlan, buildWeekPlans } from '../../lib/planner/buildDayPlan';
import { buildIcsCalendar, downloadIcs } from '../../lib/planner/icsExport';
import {
  collectUpcomingAlertWindows,
  loadAlertPreferences,
  pollWindowAlerts,
} from '../../lib/planner/windowAlerts';
import { publishAlertSchedule } from '../../lib/planner/alertSchedule';
import type { IntelligenceStore } from '../../lib/intelligence/memoryStore';
import { DayTimeline } from '../components/DayTimeline';
import { WindowAlertPanel } from '../components/WindowAlertPanel';
import {
  addIstDays,
  anchorDateForIstDay,
  formatIstTimeRange,
  toIstDatetimeLocalValue,
} from '../utils/datetime';

interface PlannerPageProps {
  store: IntelligenceStore;
  userId: string;
}

export function PlannerPage({ store, userId }: PlannerPageProps) {
  const profile = store.getProfile(userId);
  const logs = store.getLogs(userId);

  const [anchor, setAnchor] = useState(() => anchorDateForIstDay());
  const [now, setNow] = useState(() => new Date());

  const plan = useMemo(() => {
    if (!profile) return null;
    return buildDayPlan(anchor, profile, logs);
  }, [anchor, profile, logs]);

  const weekPlans = useMemo(() => {
    if (!profile) return [];
    return buildWeekPlans(anchor, profile, logs, 7);
  }, [anchor, profile, logs]);

  const upcomingAlerts = useMemo(() => {
    if (!plan) return [];
    const prefs = loadAlertPreferences();
    const weekWindows = weekPlans.flatMap((p) => p.dealWindows);
    return collectUpcomingAlertWindows(weekWindows, prefs, 24, now);
  }, [plan, weekPlans, now]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!weekPlans.length) return;
    const prefs = loadAlertPreferences();
    const allDeal = weekPlans.flatMap((p) => p.dealWindows);
    pollWindowAlerts(allDeal, prefs, now);
    void publishAlertSchedule(allDeal, prefs);
    const interval = setInterval(() => {
      const p = loadAlertPreferences();
      pollWindowAlerts(allDeal, p, new Date());
      void publishAlertSchedule(allDeal, p);
    }, 60_000);
    return () => clearInterval(interval);
  }, [weekPlans, now]);

  if (!profile || !plan) {
    return (
      <div className="kala-page">
        <p className="kala-loading">Loading planner…</p>
      </div>
    );
  }

  const exportToday = () => {
    const ics = buildIcsCalendar([plan], true);
    downloadIcs(`kaal-windows-${plan.dateIso}.ics`, ics);
  };

  const exportWeek = () => {
    const ics = buildIcsCalendar(weekPlans, true);
    downloadIcs(`kaal-windows-week-${plan.dateIso}.ics`, ics);
  };

  return (
    <div className="kala-page">
      <header className="kala-page__header">
        <div>
          <h1>Deal Planner</h1>
          <p className="kala-subtitle">{plan.dateLabel} · Core {profile.numerology.core_number} · IST</p>
        </div>
        <div className="kala-planner-actions">
          <button type="button" className="kala-btn" onClick={exportToday}>
            Export today
          </button>
          <button type="button" className="kala-btn kala-btn--primary" onClick={exportWeek}>
            Export 7-day ICS
          </button>
        </div>
      </header>

      <div className="kala-planner-nav">
        <button type="button" className="kala-btn" onClick={() => setAnchor((a) => addIstDays(a, -1))}>
          ← Prev
        </button>
        <label className="kala-field kala-field--inline">
          <input
            type="date"
            value={plan.dateIso}
            onChange={(e) => {
              if (!e.target.value) return;
              setAnchor(new Date(`${e.target.value}T12:00:00+05:30`));
            }}
          />
        </label>
        <button type="button" className="kala-btn" onClick={() => setAnchor(anchorDateForIstDay())}>
          Today
        </button>
        <button type="button" className="kala-btn" onClick={() => setAnchor((a) => addIstDays(a, 1))}>
          Next →
        </button>
      </div>

      <section className="kala-card kala-card--synthesis">
        <h2>High-conviction windows</h2>
        <p className="kala-muted">
          {plan.dealWindows.length} deal-ready slots today · sign, close, launch during best/master PH
        </p>
        {plan.dealWindows.length === 0 ? (
          <p>No best/master windows — check another day or verify PH calibration.</p>
        ) : (
          <ul className="kala-deal-windows">
            {plan.dealWindows.map((w) => (
              <li key={`deal-${w.clockHour}`}>
                <strong>PH {w.personalHour}</strong>
                <span>{w.isMaster ? 'master' : 'best'}</span>
                <span className="kala-muted">{formatIstTimeRange(w.windowStart, w.windowEnd)}</span>
                {w.learnedAvgOutcome != null && (
                  <span className="kala-muted">your avg {w.learnedAvgOutcome.toFixed(1)}/10</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <WindowAlertPanel upcomingCount={upcomingAlerts.length} />

      <section className="kala-card">
        <h2>24-hour Personal Hour map</h2>
        <p className="kala-muted">Transition :{profile.personal_hours.transition_minute} · live window marked</p>
        <DayTimeline windows={plan.windows} now={now} />
      </section>

      <details className="kala-card kala-details">
        <summary>ICS export note</summary>
        <p className="kala-muted" style={{ marginTop: 8 }}>
          Calendar events use UTC timestamps from your IST windows. Import into Google Calendar, Apple Calendar,
          or Notion. Preset: {toIstDatetimeLocalValue(plan.dealWindows[0]?.windowStart ?? anchor)} sample.
        </p>
      </details>
    </div>
  );
}
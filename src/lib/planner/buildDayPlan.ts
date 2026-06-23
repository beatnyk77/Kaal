import { getPersonalHoursForDay, type PersonalHourProfile } from '../panchangJS/personalHours';
import { comparePersonalHours } from '../intelligence/analytics';
import type { ActionLogEntry, UserProfile } from '../intelligence/types';
import type { DayPlan, PlannerWindow } from './types';

function toPlannerWindow(
  w: ReturnType<typeof getPersonalHoursForDay>[number],
  learned: Map<number, { avg: number; n: number }>
): PlannerWindow {
  const stats = learned.get(w.personalHour);
  const isHighConviction = w.quality === 'best' || w.isMaster;

  return {
    personalHour: w.personalHour,
    quality: w.quality,
    isMaster: w.isMaster,
    clockHour: w.clockHour,
    windowStart: w.windowStart,
    windowEnd: w.windowEnd,
    isHighConviction,
    learnedAvgOutcome: stats?.avg ?? null,
    learnedSampleCount: stats?.n ?? 0,
  };
}

export function buildDayPlan(
  anchorDate: Date,
  profile: UserProfile,
  logs: ActionLogEntry[] = []
): DayPlan {
  const tz = profile.location.timezone_offset_minutes;
  const phProfile: PersonalHourProfile = {
    birthTime: profile.birth.time,
    btn: profile.numerology.btn,
    transitionMinute: profile.personal_hours.transition_minute,
    coreNumber: profile.numerology.core_number,
    calibrationOffset: profile.personal_hours.calibration_offset ?? 0,
    qualityTiers: profile.personal_hours.quality_tiers,
  };

  const raw = getPersonalHoursForDay(anchorDate, phProfile, tz);
  const learned = new Map(
    comparePersonalHours(logs).map((m) => [m.personal_hour, { avg: m.avg_outcome, n: m.sample_count }])
  );

  const windows = raw.map((w) => toPlannerWindow(w, learned));
  const bestWindows = windows.filter((w) => w.quality === 'best');
  const masterWindows = windows.filter((w) => w.isMaster);
  const dealWindows = windows.filter((w) => w.isHighConviction);

  const shifted = new Date(anchorDate.getTime() + tz * 60_000);
  const dateIso = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;

  return {
    dateLabel: anchorDate.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    dateIso,
    windows,
    bestWindows,
    masterWindows,
    dealWindows,
  };
}

export function buildWeekPlans(
  startAnchor: Date,
  profile: UserProfile,
  logs: ActionLogEntry[] = [],
  days = 7
): DayPlan[] {
  const tz = profile.location.timezone_offset_minutes;
  const plans: DayPlan[] = [];

  for (let i = 0; i < days; i++) {
    const dayMs = startAnchor.getTime() + i * 24 * 60 * 60_000;
    const shifted = new Date(dayMs + tz * 60_000);
    const anchor = new Date(
      `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}T12:00:00+05:30`
    );
    plans.push(buildDayPlan(anchor, profile, logs));
  }

  return plans;
}
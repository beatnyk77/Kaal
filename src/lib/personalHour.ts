/**
 * Kaal PersonalHourEngine — thin wrapper over panchangJS/personalHours
 * (backward-compatible exports for App, fusionEngine, verify script)
 */

import {
  calculatePersonalHour,
  getCurrentPersonalHour as getCurrentPH,
  getPersonalHoursForDay,
  DEFAULT_PERSONAL_HOUR_PROFILE,
  debugPersonalHourCalc as debugPH,
  type PersonalHourProfile,
  type PersonalHourQuality,
  type PersonalHourResult,
} from './panchangJS/personalHours';

export type Quality = PersonalHourQuality;

export interface BirthProfile {
  birthTime: string;
  btn: number;
  transitionMinute: number;
}

/** @deprecated Use PersonalHourResult from panchangJS/personalHours */
export interface PersonalHour {
  personalHour: number;
  quality: Quality;
  clockHour: number;
  windowStart: Date;
  windowEnd: Date;
  isActive: boolean;
}

function toLegacyResult(r: PersonalHourResult): PersonalHour {
  return {
    personalHour: r.personalHour,
    quality: r.quality,
    clockHour: r.clockHour,
    windowStart: r.windowStart,
    windowEnd: r.windowEnd,
    isActive: r.isActive,
  };
}

function profileToBirth(profile: PersonalHourProfile): BirthProfile {
  return {
    birthTime: profile.birthTime ?? '20:20',
    btn: profile.btn,
    transitionMinute: profile.transitionMinute,
  };
}

export const DEFAULT_PROFILE: BirthProfile = profileToBirth(DEFAULT_PERSONAL_HOUR_PROFILE);

export function getPersonalHour(now: Date, profile: BirthProfile = DEFAULT_PROFILE): PersonalHour {
  return toLegacyResult(
    calculatePersonalHour({
      profile: {
        birthTime: profile.birthTime,
        btn: profile.btn,
        transitionMinute: profile.transitionMinute,
      },
      targetDateTime: now,
    })
  );
}

export function getCurrentPersonalHour(now: Date = new Date()): PersonalHour {
  return toLegacyResult(getCurrentPH(DEFAULT_PERSONAL_HOUR_PROFILE, now));
}

export function getPersonalHourWindowsForDay(
  date: Date,
  profile: BirthProfile = DEFAULT_PROFILE
): PersonalHour[] {
  return getPersonalHoursForDay(date, {
    birthTime: profile.birthTime,
    btn: profile.btn,
    transitionMinute: profile.transitionMinute,
  }).map(toLegacyResult);
}

export function getBestWindowsForDay(
  date: Date,
  profile: BirthProfile = DEFAULT_PROFILE
): PersonalHour[] {
  return getPersonalHourWindowsForDay(date, profile).filter((w) => w.quality === 'best');
}

export function debugPersonalHourCalc(now: Date, profile: BirthProfile = DEFAULT_PROFILE) {
  return debugPH({
    profile: {
      birthTime: profile.birthTime,
      btn: profile.btn,
      transitionMinute: profile.transitionMinute,
    },
    targetDateTime: now,
  });
}

export function formatWindow(ph: PersonalHour): string {
  return `${ph.personalHour} (${ph.quality}) — ${ph.windowStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${ph.windowEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export interface DaySummary {
  date: string;
  bestWindows: string[];
  confluence: number;
  dailyNumber: number;
  resonanceVsCore: string;
}

// Re-export full module for new consumers
export {
  calculatePersonalHour,
  DEFAULT_PERSONAL_HOUR_PROFILE,
  IST_OFFSET_MINUTES,
} from './panchangJS/personalHours';
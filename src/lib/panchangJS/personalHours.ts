/**
 * panchangJS — Personal Hours module (arthouse33 methodology)
 *
 * Rules:
 *  1. Birth Time Number (BTN): sum every digit of birth HH:MM → single digit or master (11/22/33)
 *  2. Transition Minute: window activates at birth minute past each clock hour (:20 for 20:20)
 *  3. Anchor: count full hours from 23:00 (11 PM) on the previous calendar night
 *  4. rawSum = BTN + hourCount + calibrationOffset
 *  5. Reduce rawSum to single digit UNLESS rawSum itself is 11, 22, or 33
 *  6. Quality tiers (arthouse33): best=[6,8,9,11,22,33], friendly=[1,2,7], caution=[3,5], else neutral
 *
 * Timezone: pass `timezoneOffsetMinutes` (e.g. 330 for IST) so wall-clock math is correct
 * regardless of the host machine TZ. If omitted, uses the Date object's local wall clock.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PersonalHourQuality = 'best' | 'friendly' | 'caution' | 'neutral';

export interface PersonalHourQualityTiers {
  best: number[];
  friendly: number[];
  caution: number[];
}

export interface PersonalHourProfile {
  /** Display label, e.g. "20:20" */
  birthTime?: string;
  /** Birth Time Number — anchor for the hourly count */
  btn: number;
  /** Minute past the hour when each Personal Hour window activates */
  transitionMinute: number;
  /** Optional life-path / core number for recommendation seeding */
  coreNumber?: number;
  /** Fine-tune if hand-count from 11 PM differs (default 0) */
  calibrationOffset?: number;
  /** Override default quality tiers per user */
  qualityTiers?: PersonalHourQualityTiers;
}

export interface PersonalHourInput {
  /** Either provide birthTime ("HH:MM" or "H:MM") … */
  birthTime?: string;
  /** … or a fully-resolved profile (btn + transitionMinute required) */
  profile?: PersonalHourProfile;
  /** Absolute instant to evaluate */
  targetDateTime: Date;
  /**
   * Minutes east of UTC for wall-clock math (IST = 330).
   * Omit to use the host machine's local timezone.
   */
  timezoneOffsetMinutes?: number;
}

export interface RecommendationsSeed {
  tier: PersonalHourQuality;
  personalHour: number;
  isMaster: boolean;
  /** Short action hints derived from tier + number */
  focus: string[];
  avoid: string[];
}

export interface PersonalHourResult {
  personalHour: number;
  isMaster: boolean;
  quality: PersonalHourQuality;
  /** Wall-clock hour (0–23) whose window is active */
  clockHour: number;
  windowStart: Date;
  windowEnd: Date;
  /** Full hours counted from previous-night 23:00 to active hour start */
  hourCount: number;
  /** BTN + hourCount + calibrationOffset (before master check / reduction) */
  rawSum: number;
  /** 23:00 anchor used for this calculation */
  reference11PM: Date;
  /** True when targetDateTime falls inside [windowStart, windowEnd) */
  isActive: boolean;
  recommendationsSeed: RecommendationsSeed;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MASTER_NUMBERS = new Set([11, 22, 33]);

const DEFAULT_QUALITY_TIERS: PersonalHourQualityTiers = {
  best: [6, 8, 9, 11, 22, 33],
  friendly: [1, 2, 7],
  caution: [3, 5],
};

/** Kartikay defaults: birth 20:20 → BTN 4, transition :20, core 4 */
export const DEFAULT_PERSONAL_HOUR_PROFILE: PersonalHourProfile = {
  birthTime: '20:20',
  btn: 4,
  transitionMinute: 20,
  coreNumber: 4,
  calibrationOffset: 0,
};

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/** India Standard Time — UTC+5:30 */
export const IST_OFFSET_MINUTES = 330;

export interface WallClock {
  year: number;
  month: number; // 0-indexed
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// ─── Parsing & BTN ───────────────────────────────────────────────────────────

const BIRTH_TIME_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * Parse "HH:MM" / "H:MM" birth time string.
 * @throws if format invalid or values out of range
 */
export function parseBirthTime(birthTime: string): { hour: number; minute: number } {
  const match = BIRTH_TIME_RE.exec(birthTime.trim());
  if (!match) {
    throw new Error(`Invalid birthTime "${birthTime}". Expected "HH:MM" (e.g. "20:20").`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid birthTime "${birthTime}". Hour must be 0–23, minute 0–59.`);
  }
  return { hour, minute };
}

/**
 * Sum every digit of birth hour and minute until single digit or master.
 * Example: 20:20 → 2+0+2+0 = 4
 */
export function computeBirthTimeNumber(hour: number, minute: number): number {
  const digits = `${hour}${minute}`.split('').map((d) => Number(d));
  let sum = digits.reduce((a, b) => a + b, 0);
  return reduceUnlessMaster(sum);
}

/**
 * Build a profile from birth time string, optionally merging overrides.
 */
export function profileFromBirthTime(
  birthTime: string,
  overrides: Partial<PersonalHourProfile> = {}
): PersonalHourProfile {
  const { hour, minute } = parseBirthTime(birthTime);
  return {
    birthTime,
    btn: computeBirthTimeNumber(hour, minute),
    transitionMinute: minute,
    ...overrides,
  };
}

// ─── Reduction & quality ─────────────────────────────────────────────────────

/**
 * If n is exactly 11/22/33, return as-is. Otherwise digital-root to single digit.
 * Masters are only preserved when they are the rawSum itself, not an intermediate step.
 */
export function reduceUnlessMaster(n: number): number {
  if (MASTER_NUMBERS.has(n)) return n;
  let value = n;
  while (value > 9) {
    value = String(value)
      .split('')
      .reduce((sum, d) => sum + Number(d), 0);
  }
  return value;
}

export function isMasterNumber(n: number): boolean {
  return MASTER_NUMBERS.has(n);
}

export function getPersonalHourQuality(
  personalHour: number,
  tiers: PersonalHourQualityTiers = DEFAULT_QUALITY_TIERS
): PersonalHourQuality {
  if (tiers.best.includes(personalHour)) return 'best';
  if (tiers.friendly.includes(personalHour)) return 'friendly';
  if (tiers.caution.includes(personalHour)) return 'caution';
  return 'neutral';
}

// ─── Time helpers (no external deps) ─────────────────────────────────────────

/** Read wall-clock components in a fixed UTC offset or host-local TZ. */
export function getWallClock(moment: Date, timezoneOffsetMinutes?: number): WallClock {
  if (timezoneOffsetMinutes === undefined) {
    return {
      year: moment.getFullYear(),
      month: moment.getMonth(),
      day: moment.getDate(),
      hour: moment.getHours(),
      minute: moment.getMinutes(),
      second: moment.getSeconds(),
    };
  }
  const shifted = moment.getTime() + timezoneOffsetMinutes * MS_PER_MINUTE;
  const utc = new Date(shifted);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth(),
    day: utc.getUTCDate(),
    hour: utc.getUTCHours(),
    minute: utc.getUTCMinutes(),
    second: utc.getUTCSeconds(),
  };
}

/** Convert wall-clock in a fixed offset (or host-local) to an absolute Date instant. */
export function wallClockToDate(
  parts: Pick<WallClock, 'year' | 'month' | 'day' | 'hour' | 'minute'>,
  timezoneOffsetMinutes?: number
): Date {
  if (timezoneOffsetMinutes === undefined) {
    const d = new Date(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0, 0);
    return d;
  }
  const utcMs =
    Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0, 0) -
    timezoneOffsetMinutes * MS_PER_MINUTE;
  return new Date(utcMs);
}

/**
 * Previous 23:00 wall-clock on or before `moment`.
 * If moment is before today's 23:00, use yesterday's 23:00.
 */
export function getPrevious11PM(moment: Date, timezoneOffsetMinutes?: number): Date {
  const wall = getWallClock(moment, timezoneOffsetMinutes);
  const today11PM = wallClockToDate(
    { year: wall.year, month: wall.month, day: wall.day, hour: 23, minute: 0 },
    timezoneOffsetMinutes
  );
  if (today11PM.getTime() <= moment.getTime()) return today11PM;

  const prevWall = getWallClock(new Date(today11PM.getTime() - 24 * MS_PER_HOUR), timezoneOffsetMinutes);
  return wallClockToDate(
    { year: prevWall.year, month: prevWall.month, day: prevWall.day, hour: 23, minute: 0 },
    timezoneOffsetMinutes
  );
}

/** Active clock hour whose Personal Hour window has started at `moment`. */
export function getActiveClockHour(
  moment: Date,
  transitionMinute: number,
  timezoneOffsetMinutes?: number
): number {
  const { hour, minute } = getWallClock(moment, timezoneOffsetMinutes);
  if (minute >= transitionMinute) return hour;
  return (hour - 1 + 24) % 24;
}

function calendarDayForClockHour(
  moment: Date,
  clockHour: number,
  timezoneOffsetMinutes?: number
): Pick<WallClock, 'year' | 'month' | 'day'> {
  const wall = getWallClock(moment, timezoneOffsetMinutes);
  // e.g. 00:10 with transition :20 → active hour 23 belongs to previous calendar day
  if (clockHour > wall.hour) {
    const noon = wallClockToDate(
      { year: wall.year, month: wall.month, day: wall.day, hour: 12, minute: 0 },
      timezoneOffsetMinutes
    );
    const prev = getWallClock(new Date(noon.getTime() - 24 * MS_PER_HOUR), timezoneOffsetMinutes);
    return { year: prev.year, month: prev.month, day: prev.day };
  }
  return { year: wall.year, month: wall.month, day: wall.day };
}

function startOfClockHour(
  moment: Date,
  clockHour: number,
  timezoneOffsetMinutes?: number
): Date {
  const { year, month, day } = calendarDayForClockHour(moment, clockHour, timezoneOffsetMinutes);
  return wallClockToDate({ year, month, day, hour: clockHour, minute: 0 }, timezoneOffsetMinutes);
}

function windowBounds(
  moment: Date,
  clockHour: number,
  transitionMinute: number,
  timezoneOffsetMinutes?: number
): { start: Date; end: Date } {
  const { year, month, day } = calendarDayForClockHour(moment, clockHour, timezoneOffsetMinutes);
  const start = wallClockToDate(
    { year, month, day, hour: clockHour, minute: transitionMinute },
    timezoneOffsetMinutes
  );
  const end = new Date(start.getTime() + MS_PER_HOUR);
  return { start, end };
}

// ─── Recommendations seed ─────────────────────────────────────────────────────

const TIER_FOCUS: Record<PersonalHourQuality, string[]> = {
  best: ['High-leverage actions', 'Important conversations', 'Deals and launches'],
  friendly: ['Collaboration', 'Steady progress', 'Relationship building'],
  caution: ['Maintenance only', 'Review before committing', 'Avoid impulsive moves'],
  neutral: ['Routine execution', 'Planning and admin', 'Foundation work'],
};

const NUMBER_FOCUS: Partial<Record<number, string[]>> = {
  6: ['Harmony and service', 'Team care'],
  7: ['Research and inner work'],
  8: ['Negotiations and authority'],
  9: ['Completion and decisive action'],
  11: ['Intuitive leaps', 'Master-channel creative work'],
  22: ['Institutional building', 'Scale decisions'],
  33: ['Teaching and transmission'],
};

function buildRecommendationsSeed(
  personalHour: number,
  quality: PersonalHourQuality,
  isMaster: boolean
): RecommendationsSeed {
  const focus = [...(TIER_FOCUS[quality] ?? [])];
  const numberHints = NUMBER_FOCUS[personalHour];
  if (numberHints) focus.push(...numberHints);
  if (isMaster) focus.push('Master number — treat as high-conviction if tier is best');

  const avoid =
    quality === 'caution'
      ? ['Signing contracts', 'Major confrontations', 'Large purchases']
      : quality === 'neutral'
        ? ['Speculative risk', 'Over-promising']
        : [];

  return { tier: quality, personalHour, isMaster, focus, avoid };
}

// ─── Core calculation ────────────────────────────────────────────────────────

function resolveProfile(input: PersonalHourInput): PersonalHourProfile {
  if (input.profile) {
    if (input.profile.btn == null || input.profile.transitionMinute == null) {
      throw new Error('profile must include btn and transitionMinute');
    }
    return { ...DEFAULT_PERSONAL_HOUR_PROFILE, ...input.profile };
  }
  if (input.birthTime) {
    return profileFromBirthTime(input.birthTime);
  }
  throw new Error('Provide either birthTime or profile');
}

/**
 * Calculate the Personal Hour for a given birth profile and target datetime.
 *
 * @example
 * calculatePersonalHour({ birthTime: '20:20', targetDateTime: new Date() })
 *
 * @example
 * calculatePersonalHour({
 *   profile: { btn: 4, transitionMinute: 20, coreNumber: 4 },
 *   targetDateTime: new Date('2026-06-23T15:28:00+05:30'),
 * })
 */
export function calculatePersonalHour(input: PersonalHourInput): PersonalHourResult {
  const profile = resolveProfile(input);
  const moment = input.targetDateTime;
  const tz = input.timezoneOffsetMinutes;
  const tiers = profile.qualityTiers ?? DEFAULT_QUALITY_TIERS;
  const offset = profile.calibrationOffset ?? 0;

  const transitionMinute = profile.transitionMinute;
  const clockHour = getActiveClockHour(moment, transitionMinute, tz);
  const reference11PM = getPrevious11PM(moment, tz);
  const activeHourStart = startOfClockHour(moment, clockHour, tz);

  const hourCount = Math.floor((activeHourStart.getTime() - reference11PM.getTime()) / MS_PER_HOUR);
  const rawSum = profile.btn + hourCount + offset;

  const isMaster = isMasterNumber(rawSum);
  const personalHour = reduceUnlessMaster(rawSum);
  const quality = getPersonalHourQuality(personalHour, tiers);

  const { start: windowStart, end: windowEnd } = windowBounds(moment, clockHour, transitionMinute, tz);
  const isActive = moment.getTime() >= windowStart.getTime() && moment.getTime() < windowEnd.getTime();

  return {
    personalHour,
    isMaster,
    quality,
    clockHour,
    windowStart,
    windowEnd,
    hourCount,
    rawSum,
    reference11PM,
    isActive,
    recommendationsSeed: buildRecommendationsSeed(personalHour, quality, isMaster),
  };
}

/**
 * Convenience: Personal Hour active right now for the given profile.
 */
export function getCurrentPersonalHour(
  profileOrBirthTime: PersonalHourProfile | string = DEFAULT_PERSONAL_HOUR_PROFILE,
  now: Date = new Date(),
  timezoneOffsetMinutes?: number
): PersonalHourResult {
  if (typeof profileOrBirthTime === 'string') {
    return calculatePersonalHour({ birthTime: profileOrBirthTime, targetDateTime: now, timezoneOffsetMinutes });
  }
  return calculatePersonalHour({ profile: profileOrBirthTime, targetDateTime: now, timezoneOffsetMinutes });
}

/**
 * All 24 Personal Hour windows for the calendar day containing `date`.
 * Samples at transitionMinute+5 past each hour to land inside each window.
 */
export function getPersonalHoursForDay(
  date: Date,
  profileOrBirthTime: PersonalHourProfile | string = DEFAULT_PERSONAL_HOUR_PROFILE,
  timezoneOffsetMinutes?: number
): PersonalHourResult[] {
  const profile =
    typeof profileOrBirthTime === 'string'
      ? profileFromBirthTime(profileOrBirthTime)
      : profileOrBirthTime;

  const sampleMinute = Math.min(profile.transitionMinute + 5, 59);
  const wall = getWallClock(date, timezoneOffsetMinutes);

  const results: PersonalHourResult[] = [];
  const seen = new Set<number>();

  for (let h = 0; h < 24; h++) {
    const sample = wallClockToDate(
      { year: wall.year, month: wall.month, day: wall.day, hour: h, minute: sampleMinute },
      timezoneOffsetMinutes
    );
    const result = calculatePersonalHour({ profile, targetDateTime: sample, timezoneOffsetMinutes });
    if (!seen.has(result.clockHour)) {
      seen.add(result.clockHour);
      results.push(result);
    }
  }

  return results.sort((a, b) => a.clockHour - b.clockHour);
}

/** Debug snapshot mirroring every intermediate value (for verify scripts). */
export function debugPersonalHourCalc(input: PersonalHourInput) {
  const profile = resolveProfile(input);
  const moment = input.targetDateTime;
  const tz = input.timezoneOffsetMinutes;
  const clockHour = getActiveClockHour(moment, profile.transitionMinute, tz);
  const reference11PM = getPrevious11PM(moment, tz);
  const activeHourStart = startOfClockHour(moment, clockHour, tz);
  const hourCount = Math.floor((activeHourStart.getTime() - reference11PM.getTime()) / MS_PER_HOUR);
  const rawSum = profile.btn + hourCount + (profile.calibrationOffset ?? 0);

  return {
    btn: profile.btn,
    transitionMinute: profile.transitionMinute,
    clockHour,
    reference11PM: reference11PM.toISOString(),
    activeHourStart: activeHourStart.toISOString(),
    hourCount,
    rawSum,
    personalHour: reduceUnlessMaster(rawSum),
    isMaster: isMasterNumber(rawSum),
  };
}
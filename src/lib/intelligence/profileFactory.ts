import { IST_OFFSET_MINUTES } from '../panchangJS/personalHours';
import type { HybridUserProfile } from '../hybridTimingAdvisor';
import {
  doctrinePreferencesFromKartikay,
  KARTIKAY_DOCTRINE,
  seedLearnedHourWeights,
} from '../kartikayDoctrine';
import type { UserProfile } from './types';

const KARTIKAY_PREFS = doctrinePreferencesFromKartikay(KARTIKAY_DOCTRINE);
const KARTIKAY_HOUR_WEIGHTS = seedLearnedHourWeights(KARTIKAY_DOCTRINE);

export function createKartikayProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = new Date().toISOString();
  const id = overrides.id ?? 'kartikay-default';

  return {
    id,
    schema_version: '1.0.0',
    created_at: now,
    updated_at: now,
    identity: { display_name: 'Kartikay Sharma', ...overrides.identity },
    birth: {
      date: '1992-05-15',
      time: '20:20',
      timezone_offset_minutes: IST_OFFSET_MINUTES,
      place_name: 'New Delhi',
      ...overrides.birth,
    },
    numerology: {
      core_number: 4,
      btn: 4,
      gg33: { birth_month: 5, birth_day: 15, birth_year: 1992, year_animal: 'Monkey' },
      ...overrides.numerology,
    },
    personal_hours: {
      transition_minute: 20,
      calibration_offset: 0,
      quality_tiers: {
        best: [6, 8, 9, 11, 22, 33],
        friendly: [1, 2, 7],
        caution: [3, 5],
        source: 'arthouse33_default',
        ...overrides.personal_hours?.quality_tiers,
      },
      learned_hour_weights: {
        ...KARTIKAY_HOUR_WEIGHTS,
        ...overrides.personal_hours?.learned_hour_weights,
      },
      ...overrides.personal_hours,
    },
    location: {
      latitude: 28.6139,
      longitude: 77.209,
      timezone_offset_minutes: IST_OFFSET_MINUTES,
      city: 'New Delhi',
      country_code: 'IN',
      ...overrides.location,
    },
    preferences: {
      primary_domains: ['deal', 'build', 'meetings'],
      conviction_sensitivity: KARTIKAY_PREFS.conviction_sensitivity,
      hybrid_weights_override: {
        ...KARTIKAY_PREFS.hybrid_weights_override,
        ...overrides.preferences?.hybrid_weights_override,
      },
      privacy: { storage_mode: 'local_only', retention_days: 365 },
      ...overrides.preferences,
    },
    ...overrides,
  };
}

/** Map intelligence UserProfile → hybrid advisor input */
export function userProfileToHybridInput(profile: UserProfile): HybridUserProfile {
  return {
    name: profile.identity.display_name,
    coreNumber: profile.numerology.core_number,
    birthTime: profile.birth.time,
    btn: profile.numerology.btn,
    transitionMinute: profile.personal_hours.transition_minute,
    calibrationOffset: profile.personal_hours.calibration_offset,
    timezoneOffsetMinutes: profile.location.timezone_offset_minutes,
    gg33: {
      birthMonth: profile.numerology.gg33.birth_month,
      birthDay: profile.numerology.gg33.birth_day,
      birthYear: profile.numerology.gg33.birth_year,
    },
    jyotish: {
      birthDate: profile.birth.date,
      birthTime: profile.birth.time,
      latitude: profile.location.latitude,
      longitude: profile.location.longitude,
      timezoneOffsetMinutes: profile.birth.timezone_offset_minutes,
    },
  };
}
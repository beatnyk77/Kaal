import { parseBirthTime, profileFromBirthTime } from '../panchangJS/personalHours';
import type { UserProfile } from './types';

export interface ProfileFormValues {
  displayName: string;
  birthDate: string;
  birthTime: string;
  coreNumber: number;
  placeName: string;
  city: string;
  latitude: number;
  longitude: number;
}

export function profileToFormValues(profile: UserProfile): ProfileFormValues {
  return {
    displayName: profile.identity.display_name,
    birthDate: profile.birth.date,
    birthTime: profile.birth.time,
    coreNumber: profile.numerology.core_number,
    placeName: profile.birth.place_name ?? '',
    city: profile.location.city ?? '',
    latitude: profile.location.latitude,
    longitude: profile.location.longitude,
  };
}

export function validateProfileForm(form: ProfileFormValues): string | null {
  if (!form.displayName.trim()) return 'Display name is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) return 'Birth date must be YYYY-MM-DD.';
  try {
    parseBirthTime(form.birthTime);
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid birth time.';
  }
  if (form.coreNumber < 1 || form.coreNumber > 33) return 'Core number must be 1–33.';
  if (form.latitude < -90 || form.latitude > 90) return 'Latitude must be between -90 and 90.';
  if (form.longitude < -180 || form.longitude > 180) return 'Longitude must be between -180 and 180.';
  return null;
}

/** Apply form edits; derives BTN + transition minute from birth time. */
export function applyProfileForm(existing: UserProfile, form: ProfileFormValues): UserProfile {
  const error = validateProfileForm(form);
  if (error) throw new Error(error);

  const phProfile = profileFromBirthTime(form.birthTime, { coreNumber: form.coreNumber });
  const [year, month, day] = form.birthDate.split('-').map(Number);

  return {
    ...existing,
    updated_at: new Date().toISOString(),
    identity: { ...existing.identity, display_name: form.displayName.trim() },
    birth: {
      ...existing.birth,
      date: form.birthDate,
      time: form.birthTime,
      place_name: form.placeName.trim() || undefined,
    },
    numerology: {
      ...existing.numerology,
      core_number: form.coreNumber,
      btn: phProfile.btn,
      gg33: {
        ...existing.numerology.gg33,
        birth_month: month,
        birth_day: day,
        birth_year: year,
      },
    },
    personal_hours: {
      ...existing.personal_hours,
      transition_minute: phProfile.transitionMinute,
    },
    location: {
      ...existing.location,
      latitude: form.latitude,
      longitude: form.longitude,
      city: form.city.trim() || undefined,
    },
  };
}
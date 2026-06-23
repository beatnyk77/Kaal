/**
 * GG33 + Vietnamese Zodiac / Numerology synthesis (pure, no deps)
 * 
 * This is a starting implementation for Phase 1/3.
 * - Personal Year / Personal Day (standard numerology + GG33 flavor)
 * - Vietnamese/Chinese zodiac animal for year + daily synergy notes
 * - Friendly / Enemy / Neutral relationships (stub for your rules)
 * 
 * TODO (when you provide full birth date):
 *   - Use exact birth month/day/year
 *   - Tune "enemy year", personal year themes per GG33 style
 */

export interface GG33Profile {
  birthMonth: number; // 1-12
  birthDay: number;   // 1-31
  birthYear: number;
  // Optional: vietBirthAnimal if you have a preferred mapping
}

export interface DailyNumerology {
  personalYear: number;
  personalMonth: number;
  personalDay: number;
  dailyNumber: number;
  yearAnimal: string;
  dayAnimal: string;
  synergy: 'friendly' | 'neutral' | 'enemy' | 'self';
  themeNote: string;
}

const VIET_ANIMALS = [
  'Rat', 'Ox', 'Tiger', 'Cat', 'Dragon', 'Snake',
  'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'
] as const;

type Animal = typeof VIET_ANIMALS[number];

function reduce(n: number): number {
  // Keep masters in some contexts, but for personal year/day GG33 often reduces or notes them
  while (n > 9 && ![11, 22, 33].includes(n)) {
    n = n.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
  }
  return n;
}

function getAnimalForYear(year: number): Animal {
  // Standard Chinese/Vietnamese cycle. Vietnamese new year can start late Jan/early Feb.
  // For daily timing we use the calendar year for simplicity (refine later with exact solar/lunar).
  const index = (year - 4) % 12; // 1984 was Rat (common anchor)
  return VIET_ANIMALS[(index + 12) % 12];
}

function getAnimalForDate(date: Date): Animal {
  // Rough: use the year of the date. For higher fidelity we would use lunar new year boundaries.
  return getAnimalForYear(date.getFullYear());
}

function getSynergy(birthAnimal: Animal, otherAnimal: Animal): 'friendly' | 'neutral' | 'enemy' | 'self' {
  if (birthAnimal === otherAnimal) return 'self';

  const birthIdx = VIET_ANIMALS.indexOf(birthAnimal);
  const otherIdx = VIET_ANIMALS.indexOf(otherAnimal);
  const diff = Math.abs(birthIdx - otherIdx) % 12;

  // Very rough GG33-style: opposites are enemy (+6)
  if (diff === 6) return 'enemy';

  // Common friendly triads in popular systems (approximation)
  const friendlyDiffs = [3, 4, 8, 9]; // tune with your GG33 notes
  if (friendlyDiffs.includes(diff)) return 'friendly';

  return 'neutral';
}

export function calculateDailyNumerology(
  date: Date,
  profile: GG33Profile
): DailyNumerology {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Personal Year (common formula: birth MM + DD + current YYYY)
  const pyRaw = profile.birthMonth + profile.birthDay + year;
  const personalYear = reduce(pyRaw);

  // Personal Month (Personal Year + current month)
  const pmRaw = personalYear + month;
  const personalMonth = reduce(pmRaw);

  // Personal Day
  const pdRaw = personalMonth + day;
  const personalDay = reduce(pdRaw);

  // A simple "daily number" (GG33 often uses the full date reduced or other methods)
  const dailyRaw = month + day + year;
  const dailyNumber = reduce(dailyRaw);

  const yearAnimal = getAnimalForYear(profile.birthYear);
  const dayAnimal = getAnimalForDate(date);
  const synergy = getSynergy(yearAnimal, dayAnimal);

  let themeNote = '';
  if (synergy === 'friendly') themeNote = 'Supportive energy — good for alliances, visibility, starting things.';
  else if (synergy === 'enemy') themeNote = 'Tension or opposition — protect energy, avoid major confrontations.';
  else if (synergy === 'self') themeNote = 'Your own animal year — amplified personal themes.';
  else themeNote = 'Neutral — steady but unremarkable day.';

  return {
    personalYear,
    personalMonth,
    personalDay,
    dailyNumber,
    yearAnimal,
    dayAnimal,
    synergy,
    themeNote,
  };
}

/**
 * Quick helper to create a default profile for demo purposes.
 * Replace with real birth date once known.
 */
export function createDemoGG33Profile(): GG33Profile {
  // Example: assume a plausible birth date for demo (user will replace)
  return {
    birthMonth: 5,
    birthDay: 15,
    birthYear: 1992,
  };
}

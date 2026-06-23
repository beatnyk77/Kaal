/**
 * Panchang calculator — beatnyk77/panchangJS (default) with mhah-panchang fallback.
 * @see https://github.com/beatnyk77/panchangJS
 */

import { MhahPanchang } from 'mhah-panchang';
import { IST_OFFSET_MINUTES } from './personalHours';
import {
  calculateBeatnykPanchang,
  normalizeBeatnykNakshatra,
  normalizeBeatnykTithi,
  normalizeBeatnykYoga,
} from './beatnykAdapter';

export type PanchangBackend = 'panchangJS' | 'mhah-panchang';

export interface CalculatedPanchang {
  tithi: string;
  tithiPhase: 'shukla' | 'krishna' | 'unknown';
  tithiIndex: number;
  nakshatra: string;
  yoga: string;
  karana: string;
  vara: string;
  tithiStart?: Date;
  tithiEnd?: Date;
  nakshatraStart?: Date;
  nakshatraEnd?: Date;
  yogaStart?: Date;
  yogaEnd?: Date;
  source: PanchangBackend;
}

const BEATNYK_TITHI_RAW = [
  'Padyami', 'Vidhiya', 'Thadiya', 'Chavithi', 'Panchami', 'Shasti', 'Sapthami', 'Ashtami', 'Navami', 'Dasami',
  'Ekadasi', 'Dvadasi', 'Trayodasi', 'Chaturdasi', 'Punnami', 'Padyami', 'Vidhiya', 'Thadiya', 'Chaviti',
  'Panchami', 'Shasti', 'Sapthami', 'Ashtami', 'Navami', 'Dasami', 'Ekadasi', 'Dvadasi', 'Trayodasi',
  'Chaturdasi', 'Amavasya',
];

function readPanchangBackend(): PanchangBackend {
  const env = import.meta.env.VITE_PANCHANG_BACKEND;
  if (env === 'mhah-panchang' || env === 'mhah') return 'mhah-panchang';
  return 'panchangJS';
}

const NAKSHATRA_ALIASES: Record<string, string> = {
  Kruthika: 'Krittika',
  Mrugasira: 'Mrigashira',
  Aarudra: 'Ardra',
  Punarwasu: 'Punarvasu',
  Pushyami: 'Pushya',
  Pubha: 'Purva Phalguni',
  Uttara: 'Uttara Phalguni',
  Chitta: 'Chitra',
  Visakha: 'Vishakha',
  Jyesta: 'Jyeshtha',
  'Purva-Shada': 'Purva Ashadha',
  'Uttara-Shaada': 'Uttara Ashadha',
  Sravanam: 'Shravana',
  Dhanista: 'Dhanishta',
  Satabhisham: 'Shatabhisha',
  'Purva-Bhadra': 'Purva Bhadrapada',
  'Uttara-Bhadra': 'Uttara Bhadrapada',
  Revathi: 'Revati',
};

let engine: MhahPanchang | null = null;

/**
 * mhah-panchang derives Julian date from the Date instant + host getTimezoneOffset(),
 * so pass the true UTC instant (e.g. from `new Date('…+05:30')`) — no wall-clock shim needed.
 */
export function dateForPanchangCalc(instant: Date): Date {
  return instant;
}

function normalizeNakshatra(name: string): string {
  return NAKSHATRA_ALIASES[name] ?? name;
}

function parsePhase(paksha: string | undefined): 'shukla' | 'krishna' | 'unknown' {
  if (!paksha) return 'unknown';
  const lower = paksha.toLowerCase();
  if (lower.includes('shukla') || lower.includes('waxing')) return 'shukla';
  if (lower.includes('krishna') || lower.includes('waning')) return 'krishna';
  return 'unknown';
}

function calculateMhahPanchang(instant: Date): CalculatedPanchang {
  if (!engine) engine = new MhahPanchang();

  const raw = engine.calculate(instant) as {
    Tithi?: { name_en_IN?: string; ino?: number; start?: string; end?: string };
    Paksha?: { name_en_IN?: string };
    Nakshatra?: { name_en_IN?: string; start?: string; end?: string };
    Yoga?: { name_en_IN?: string; start?: string; end?: string };
    Karna?: { name_en_IN?: string };
    Day?: { name_en_UK?: string };
  };

  const tithiCore = raw.Tithi?.name_en_IN ?? 'Unknown';
  const phase = parsePhase(raw.Paksha?.name_en_IN);
  const tithiFull = phase === 'unknown' ? tithiCore : `${phase === 'shukla' ? 'Shukla' : 'Krishna'} ${tithiCore}`;

  return {
    tithi: tithiFull,
    tithiPhase: phase,
    tithiIndex: raw.Tithi?.ino ?? 0,
    nakshatra: normalizeNakshatra(raw.Nakshatra?.name_en_IN ?? 'Unknown'),
    yoga: raw.Yoga?.name_en_IN ?? 'Unknown',
    karana: raw.Karna?.name_en_IN ?? 'Unknown',
    vara: raw.Day?.name_en_UK ?? 'Unknown',
    tithiStart: raw.Tithi?.start ? new Date(raw.Tithi.start) : undefined,
    tithiEnd: raw.Tithi?.end ? new Date(raw.Tithi.end) : undefined,
    nakshatraStart: raw.Nakshatra?.start ? new Date(raw.Nakshatra.start) : undefined,
    nakshatraEnd: raw.Nakshatra?.end ? new Date(raw.Nakshatra.end) : undefined,
    yogaStart: raw.Yoga?.start ? new Date(raw.Yoga.start) : undefined,
    yogaEnd: raw.Yoga?.end ? new Date(raw.Yoga.end) : undefined,
    source: 'mhah-panchang',
  };
}

function calculatePanchangJS(instant: Date, timezoneOffsetMinutes: number): CalculatedPanchang {
  const raw = calculateBeatnykPanchang(instant, timezoneOffsetMinutes);
  const tithiIdx = BEATNYK_TITHI_RAW.findIndex(
    (t) => t.toLowerCase() === String(raw.Tithi).toLowerCase()
  );
  const tithiNorm = normalizeBeatnykTithi(String(raw.Tithi), tithiIdx >= 0 ? tithiIdx : undefined);

  return {
    tithi: tithiNorm.name,
    tithiPhase: tithiNorm.phase,
    tithiIndex: tithiIdx >= 0 ? tithiIdx : 0,
    nakshatra: normalizeBeatnykNakshatra(String(raw.Nakshatra)),
    yoga: normalizeBeatnykYoga(String(raw.Yoga)),
    karana: String(raw.Karana),
    vara: String(raw.Vaara),
    tithiStart: raw.Tithi_Start ? new Date(raw.Tithi_Start) : undefined,
    tithiEnd: raw.Tithi_End ? new Date(raw.Tithi_End) : undefined,
    nakshatraStart: raw.Nakshatra_Start ? new Date(raw.Nakshatra_Start) : undefined,
    nakshatraEnd: raw.Nakshatra_End ? new Date(raw.Nakshatra_End) : undefined,
    yogaStart: raw.Yoga_Start ? new Date(raw.Yoga_Start) : undefined,
    yogaEnd: raw.Yoga_End ? new Date(raw.Yoga_End) : undefined,
    source: 'panchangJS',
  };
}

export function calculatePanchang(
  instant: Date,
  timezoneOffsetMinutes = IST_OFFSET_MINUTES,
  backend: PanchangBackend = readPanchangBackend()
): CalculatedPanchang {
  if (backend === 'mhah-panchang') {
    return calculateMhahPanchang(instant);
  }
  try {
    return calculatePanchangJS(instant, timezoneOffsetMinutes);
  } catch {
    return calculateMhahPanchang(instant);
  }
}
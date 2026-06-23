/**
 * Real Panchang calculator — mhah-panchang (schenna/panchangJS lineage, pure JS).
 * IST-safe: converts any instant to IST wall clock before calculation.
 */

import { MhahPanchang } from 'mhah-panchang';
import { IST_OFFSET_MINUTES } from './personalHours';

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
  source: 'mhah-panchang';
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

export function calculatePanchang(instant: Date, _timezoneOffsetMinutes = IST_OFFSET_MINUTES): CalculatedPanchang {
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
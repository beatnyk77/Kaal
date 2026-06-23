/**
 * beatnyk77/panchangJS integration — IST-safe wrapper around CalculatorService.
 * @see https://github.com/beatnyk77/panchangJS
 */

import { CalculatorService, type Panchang } from '../../../vendor/panchangJS/src/calculator.service';
import { IST_OFFSET_MINUTES } from './personalHours';

export interface PanchangJSWallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Wall clock for a fixed offset (e.g. IST +330) from a UTC instant. */
export function wallClockFromOffset(instant: Date, tzOffsetMinutes: number): PanchangJSWallClock {
  const shifted = new Date(instant.getTime() + tzOffsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** Build a Date shim so panchangJS reads IST wall clock + offset correctly on any host TZ. */
export function dateShimForOffset(wall: PanchangJSWallClock, tzOffsetMinutes: number): Date {
  return {
    getDate: () => wall.day,
    getMonth: () => wall.month - 1,
    getFullYear: () => wall.year,
    getHours: () => wall.hour,
    getMinutes: () => wall.minute,
    getTimezoneOffset: () => -tzOffsetMinutes,
  } as Date;
}

const TITHI_WAXING = [
  'Pratipada',
  'Dwitiya',
  'Tritiya',
  'Chaturthi',
  'Panchami',
  'Shashthi',
  'Saptami',
  'Ashtami',
  'Navami',
  'Dashami',
  'Ekadashi',
  'Dwadashi',
  'Trayodashi',
  'Chaturdashi',
  'Purnima',
];

const TITHI_WANING = [
  'Pratipada',
  'Dwitiya',
  'Tritiya',
  'Chaturthi',
  'Panchami',
  'Shashthi',
  'Saptami',
  'Ashtami',
  'Navami',
  'Dashami',
  'Ekadashi',
  'Dwadashi',
  'Trayodashi',
  'Chaturdashi',
  'Amavasya',
];

const NAKSHATRA_ALIASES: Record<string, string> = {
  Kruthika: 'Krittika',
  Mrugasira: 'Mrigashira',
  Aarudra: 'Ardra',
  Punarwasu: 'Punarvasu',
  Pushyami: 'Pushya',
  Aslesha: 'Ashlesha',
  Makha: 'Magha',
  Pubha: 'Purva Phalguni',
  Uttara: 'Uttara Phalguni',
  Chitta: 'Chitra',
  Visakha: 'Vishakha',
  Jyesta: 'Jyeshtha',
  Mula: 'Mula',
  'Purva-Shada': 'Purva Ashadha',
  'Uttara-Shaada': 'Uttara Ashadha',
  Sravanam: 'Shravana',
  Dhanista: 'Dhanishta',
  Satabhisham: 'Shatabhisha',
  'Purva-Bhadra': 'Purva Bhadrapada',
  'Uttara-Bhadra': 'Uttara Bhadrapada',
  Revathi: 'Revati',
};

const YOGA_ALIASES: Record<string, string> = {
  Prithi: 'Priti',
  Sobhana: 'Shobhana',
  Soola: 'Shula',
  Vridhi: 'Vriddhi',
  Subha: 'Shubha',
  Sukla: 'Shukla',
  Bramha: 'Brahma',
};

let service: CalculatorService | null = null;

function getService(): CalculatorService {
  if (!service) service = new CalculatorService();
  return service;
}

export function calculateBeatnykPanchang(
  instant: Date,
  tzOffsetMinutes = IST_OFFSET_MINUTES
): Panchang {
  const wall = wallClockFromOffset(instant, tzOffsetMinutes);
  const shim = dateShimForOffset(wall, tzOffsetMinutes);
  return getService().calculate(shim);
}

export function normalizeBeatnykTithi(rawTithi: string, tithiIndex?: number): {
  name: string;
  phase: 'shukla' | 'krishna' | 'unknown';
  core: string;
} {
  if (tithiIndex != null && tithiIndex >= 0 && tithiIndex < 30) {
    const phase = tithiIndex < 15 ? 'shukla' : 'krishna';
    const core = phase === 'shukla' ? TITHI_WAXING[tithiIndex] : TITHI_WANING[tithiIndex - 15];
    const prefix = phase === 'shukla' ? 'Shukla' : 'Krishna';
    return { name: `${prefix} ${core}`, phase, core };
  }

  const lower = rawTithi.toLowerCase();
  if (lower.includes('punnami') || lower === 'purnima') {
    return { name: 'Shukla Purnima', phase: 'shukla', core: 'Purnima' };
  }
  if (lower.includes('amavasya')) {
    return { name: 'Krishna Amavasya', phase: 'krishna', core: 'Amavasya' };
  }

  return { name: rawTithi, phase: 'unknown', core: rawTithi };
}

export function normalizeBeatnykNakshatra(name: string): string {
  return NAKSHATRA_ALIASES[name] ?? name;
}

export function normalizeBeatnykYoga(name: string): string {
  return YOGA_ALIASES[name] ?? name;
}


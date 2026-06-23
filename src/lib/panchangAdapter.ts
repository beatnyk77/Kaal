/**
 * PanchangAdapter — wrapper for panchangJS (schenna/panchangJS or your fork)
 *
 * Replace getPanchang() body with:
 *   import { CalculatorService } from 'panchangJS/src/calculator.service';
 *   const calc = new CalculatorService();
 *   const raw = calc.calculate(date);
 */

export type TithiPhase = 'shukla' | 'krishna' | 'unknown';

export interface PanchangElement {
  name: string;
  start?: Date;
  end?: Date;
}

export interface PanchangData {
  tithi: PanchangElement & { phase: TithiPhase; index?: number };
  nakshatra: PanchangElement;
  yoga: PanchangElement & { strength?: 'strong' | 'moderate' | 'weak' };
  karana: PanchangElement;
  vara: string;
  /** Legacy boolean — derived from muhurta score >= 60 */
  isAuspicious: boolean;
  note: string;
  muhurta: MuhurtaQuality;
}

export interface MuhurtaQuality {
  /** 0–100 aggregate auspiciousness for actionable muhurta */
  score: number;
  label: 'excellent' | 'good' | 'mixed' | 'caution';
  factors: Array<{ factor: string; impact: number; note: string }>;
}

const AUSPICIOUS_YOGAS = new Set(['Siddhi', 'Sadhya', 'Shubha', 'Brahma', 'Indra', 'Ayushman', 'Saubhagya']);
const CAUTION_YOGAS = new Set(['Atiganda', 'Vyatipata', 'Vaidhruthi', 'Parigha', 'Ganda']);
const AUSPICIOUS_NAKSHATRAS = new Set(['Rohini', 'Pushya', 'Hasta', 'Revati', 'Abhijit', 'Ashwini']);
const AUSPICIOUS_TITHIS = new Set(['Ekadashi', 'Dwitiya', 'Panchami', 'Dashami', 'Trayodashi', 'Purnima']);

function parseTithiPhase(name: string): TithiPhase {
  if (name.toLowerCase().startsWith('shukla')) return 'shukla';
  if (name.toLowerCase().startsWith('krishna')) return 'krishna';
  return 'unknown';
}

function computeMuhurta(
  tithiName: string,
  nakshatraName: string,
  yogaName: string,
  vara: string
): MuhurtaQuality {
  let score = 50;
  const factors: MuhurtaQuality['factors'] = [];

  const phase = parseTithiPhase(tithiName);
  if (phase === 'shukla') {
    score += 8;
    factors.push({ factor: 'tithi_phase', impact: 8, note: 'Shukla paksha — growth-oriented lunar phase' });
  } else if (phase === 'krishna') {
    score -= 5;
    factors.push({ factor: 'tithi_phase', impact: -5, note: 'Krishna paksha — waning; better for closure than starts' });
  }

  const tithiCore = tithiName.replace(/^(Shukla|Krishna)\s+/i, '');
  if (AUSPICIOUS_TITHIS.has(tithiCore)) {
    score += 10;
    factors.push({ factor: 'tithi', impact: 10, note: `${tithiCore} traditionally favorable` });
  }
  if (tithiCore.includes('Amavasya') || tithiCore.includes('Chaturthi')) {
    score -= 8;
    factors.push({ factor: 'tithi', impact: -8, note: `${tithiCore} — caution on new beginnings` });
  }

  if (AUSPICIOUS_NAKSHATRAS.has(nakshatraName)) {
    score += 12;
    factors.push({ factor: 'nakshatra', impact: 12, note: `${nakshatraName} supportive for activities` });
  }

  if (AUSPICIOUS_YOGAS.has(yogaName)) {
    score += 10;
    factors.push({ factor: 'yoga', impact: 10, note: `${yogaName} yoga — auspicious` });
  }
  if (CAUTION_YOGAS.has(yogaName)) {
    score -= 12;
    factors.push({ factor: 'yoga', impact: -12, note: `${yogaName} yoga — exercise caution` });
  }

  if (vara === 'Thursday' || vara === 'Friday') {
    score += 4;
    factors.push({ factor: 'vara', impact: 4, note: `${vara} — Jupiter/Venus tones` });
  }
  if (vara === 'Tuesday' && phase === 'krishna') {
    score -= 4;
    factors.push({ factor: 'vara', impact: -4, note: 'Tuesday + Krishna — martial/waning mix' });
  }

  score = Math.max(10, Math.min(95, Math.round(score)));

  let label: MuhurtaQuality['label'];
  if (score >= 75) label = 'excellent';
  else if (score >= 60) label = 'good';
  else if (score >= 45) label = 'mixed';
  else label = 'caution';

  return { score, label, factors };
}

import { calculatePanchang } from './panchangJS/calculator';
import { IST_OFFSET_MINUTES } from './panchangJS/personalHours';

export interface PanchangOptions {
  timezoneOffsetMinutes?: number;
}

/**
 * Real panchang via mhah-panchang (schenna/panchangJS astronomical core).
 */
export function getPanchang(date: Date, options: PanchangOptions = {}): PanchangData {
  const tz = options.timezoneOffsetMinutes ?? IST_OFFSET_MINUTES;
  const raw = calculatePanchang(date, tz);

  const muhurta = computeMuhurta(raw.tithi, raw.nakshatra, raw.yoga, raw.vara);
  const yoga = raw.yoga;

  return {
    tithi: { name: raw.tithi, phase: raw.tithiPhase, index: raw.tithiIndex, start: raw.tithiStart, end: raw.tithiEnd },
    nakshatra: { name: raw.nakshatra, start: raw.nakshatraStart, end: raw.nakshatraEnd },
    yoga: {
      name: yoga,
      strength: AUSPICIOUS_YOGAS.has(yoga) ? 'strong' : CAUTION_YOGAS.has(yoga) ? 'weak' : 'moderate',
      start: raw.yogaStart,
      end: raw.yogaEnd,
    },
    karana: { name: raw.karana },
    vara: raw.vara,
    isAuspicious: muhurta.score >= 60,
    note:
      muhurta.label === 'excellent' || muhurta.label === 'good'
        ? 'Traditionally favorable for important actions.'
        : muhurta.label === 'caution'
          ? 'Caution muhurta — protect foundation, defer high-stakes moves.'
          : 'Mixed — routine work favored over high-stakes moves.',
    muhurta,
  };
}

/** Legacy day-seed stub — tests only */
export function getPanchangStub(date: Date): PanchangData {
  const tithiNames = [
    'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
    'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
    'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima/Amavasya',
  ];
  const nakshatraNames = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta',
    'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ];
  const yogaNames = [
    'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
    'Sukarman', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva',
    'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan',
    'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla',
    'Brahma', 'Indra', 'Vaidhruthi',
  ];

  const daySeed = date.getDate() + date.getMonth();
  const tithiIdx = daySeed % tithiNames.length;
  const nakIdx = (daySeed * 3) % nakshatraNames.length;
  const yogaIdx = (daySeed * 7) % yogaNames.length;

  const isShukla = date.getDate() % 2 === 0;
  const tithiCore = tithiNames[tithiIdx];
  const tithiFull = `${isShukla ? 'Shukla' : 'Krishna'} ${tithiCore}`;
  const nakshatra = nakshatraNames[nakIdx];
  const yoga = yogaNames[yogaIdx];
  const vara = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });

  const muhurta = computeMuhurta(tithiFull, nakshatra, yoga, vara);

  return {
    tithi: { name: tithiFull, phase: parseTithiPhase(tithiFull), index: tithiIdx },
    nakshatra: { name: nakshatra },
    yoga: {
      name: yoga,
      strength: AUSPICIOUS_YOGAS.has(yoga) ? 'strong' : CAUTION_YOGAS.has(yoga) ? 'weak' : 'moderate',
    },
    karana: { name: 'Bava' },
    vara,
    isAuspicious: muhurta.score >= 60,
    note: 'Stub panchang',
    muhurta,
  };
}

/**
 * Real panchangJS integration (uncomment when library is linked):
 *
 * ```ts
 * import { CalculatorService } from '../path/to/panchangJS/src/calculator.service';
 *
 * export function getPanchangFromJS(date: Date): PanchangData {
 *   const calc = new CalculatorService();
 *   const p = calc.calculate(date);
 *   const tithiFull = p.Tithi; // map field names to your fork
 *   const muhurta = computeMuhurta(tithiFull, p.Nakshatra, p.Yoga, p.Vaara);
 *   return { ... };
 * }
 * ```
 */
export { calculatePanchang, dateForPanchangCalc, type CalculatedPanchang } from './calculator';

/**
 * panchangJS extension entry — Personal Hours
 *
 * Drop-in for schenna/panchangJS or Kaal panchangAdapter.
 *
 * Integration pattern (TypeScript fork of panchangJS):
 *
 * ```ts
 * import { CalculatorService } from './calculator.service';
 * import { calculatePersonalHour, DEFAULT_PERSONAL_HOUR_PROFILE } from './personalHours';
 *
 * const panchang = calculator.calculate(new Date());
 * const ph = calculatePersonalHour({
 *   profile: DEFAULT_PERSONAL_HOUR_PROFILE,
 *   targetDateTime: new Date(),
 * });
 *
 * return { ...panchang, PersonalHour: ph };
 * ```
 *
 * Legacy JS (panchang.js) — append to calculate() return:
 *
 * ```js
 * // after building panchang JSON:
 * if (typeof calculatePersonalHour === 'function') {
 *   panchang.PersonalHour = calculatePersonalHour({
 *     birthTime: '20:20',
 *     targetDateTime: d
 *   });
 * }
 * ```
 */

export {
  calculatePersonalHour,
  getCurrentPersonalHour,
  getPersonalHoursForDay,
  debugPersonalHourCalc,
  parseBirthTime,
  computeBirthTimeNumber,
  profileFromBirthTime,
  reduceUnlessMaster,
  isMasterNumber,
  getPersonalHourQuality,
  getPrevious11PM,
  getActiveClockHour,
  getWallClock,
  wallClockToDate,
  IST_OFFSET_MINUTES,
  DEFAULT_PERSONAL_HOUR_PROFILE,
  type PersonalHourProfile,
  type PersonalHourInput,
  type PersonalHourResult,
  type PersonalHourQuality,
  type RecommendationsSeed,
} from './personalHours';
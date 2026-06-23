// Run with: bun run scripts/verify-personal-hours.ts
import {
  calculatePersonalHour,
  debugPersonalHourCalc,
  DEFAULT_PERSONAL_HOUR_PROFILE,
  IST_OFFSET_MINUTES,
  getWallClock,
} from '../src/lib/panchangJS/personalHours';

const TZ = IST_OFFSET_MINUTES;

const SAMPLE_TIMES = [
  '2026-06-23T15:28:00+05:30',
  '2026-06-23T20:20:00+05:30',
  '2026-06-23T23:25:00+05:30',
  '2026-06-23T23:19:59+05:30',
  '2026-06-24T00:25:00+05:30',
  '2026-06-24T06:25:00+05:30',
  '2026-06-24T08:25:00+05:30',
  '2026-06-24T20:20:00+05:30',
  '2026-06-24T20:19:59+05:30',
];

console.log('panchangJS Personal Hours — birth 20:20 (BTN=4), transition :20, IST samples\n');
console.log('Time (IST)                  PH  Mstr  Quality    ClkH  Active  Window (local)     hourCount  rawSum');
console.log('--------------------------------------------------------------------------------------------------------');

SAMPLE_TIMES.forEach((iso) => {
  const d = new Date(iso);
  const r = calculatePersonalHour({ profile: DEFAULT_PERSONAL_HOUR_PROFILE, targetDateTime: d, timezoneOffsetMinutes: TZ });
  const dbg = debugPersonalHourCalc({ profile: DEFAULT_PERSONAL_HOUR_PROFILE, targetDateTime: d, timezoneOffsetMinutes: TZ });
  const ws = getWallClock(r.windowStart, TZ);
  const we = getWallClock(r.windowEnd, TZ);
  const pad = (n: number) => String(n).padStart(2, '0');
  const win = `${pad(ws.hour)}:${pad(ws.minute)}-${pad(we.hour)}:${pad(we.minute)}`;
  console.log(
    `${iso}  ${String(r.personalHour).padStart(2)}   ${r.isMaster ? 'Y' : 'n'}    ${r.quality.padEnd(9)}  ${String(r.clockHour).padStart(2)}    ${String(r.isActive).padEnd(5)}  ${win.padEnd(17)}  ${String(dbg.hourCount).padStart(2)}        ${dbg.rawSum}`
  );
});

console.log('\nCalibration: set profile.calibrationOffset if hand-count from 11 PM differs.');

import type { DayPlan, PlannerWindow } from './types';

function formatIcsUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function windowToEvent(w: PlannerWindow, dateIso: string, idx: number): string {
  const tier = w.isMaster ? 'master' : w.quality;
  const summary = `Kaal PH ${w.personalHour} (${tier})`;
  const desc = [
    `Personal Hour ${w.personalHour} — ${w.quality}${w.isMaster ? ' master' : ''}`,
    'High-conviction deal window per arthouse33 tiers.',
    w.learnedAvgOutcome != null ? `Your avg outcome: ${w.learnedAvgOutcome.toFixed(1)}/10 (n=${w.learnedSampleCount})` : '',
  ]
    .filter(Boolean)
    .join('\\n');

  return [
    'BEGIN:VEVENT',
    `UID:kaal-${dateIso}-ph${w.personalHour}-${w.clockHour}-${idx}@vibecode.kala`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(w.windowStart)}`,
    `DTEND:${formatIcsUtc(w.windowEnd)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(desc)}`,
    'END:VEVENT',
  ].join('\r\n');
}

/** Export best + master windows from one or more day plans as .ics */
export function buildIcsCalendar(plans: DayPlan[], onlyHighConviction = true): string {
  const events: string[] = [];

  for (const plan of plans) {
    const pool = onlyHighConviction ? plan.dealWindows : plan.windows;
    pool.forEach((w, idx) => {
      events.push(windowToEvent(w, plan.dateIso, idx));
    });
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kala//Deal Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
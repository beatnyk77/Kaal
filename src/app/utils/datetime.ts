import { IST_OFFSET_MINUTES } from '../../lib/panchangJS/personalHours';

/** Format a Date as datetime-local value in IST wall clock */
export function toIstDatetimeLocalValue(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const h = String(shifted.getUTCHours()).padStart(2, '0');
  const min = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Parse datetime-local string as IST wall time → UTC Date */
export function istDateFromLocalInput(value: string): Date {
  const normalized = value.length === 16 ? `${value}:00` : value;
  return new Date(`${normalized}+05:30`);
}

export function formatIstWall(d: Date): string {
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Noon IST on the calendar day containing `instant` (for day-boundary PH math) */
export function anchorDateForIstDay(instant = new Date()): Date {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T12:00:00+05:30`);
}

export function addIstDays(anchor: Date, days: number): Date {
  const shifted = new Date(anchor.getTime() + IST_OFFSET_MINUTES * 60_000);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T12:00:00+05:30`);
}

export function formatIstTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)} IST`;
}

export function formatTimeWindow(iso: string): string {
  const dt = new Date(iso);
  return dt.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
}
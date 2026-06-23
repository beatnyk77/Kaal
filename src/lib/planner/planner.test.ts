import { describe, it, expect } from 'vitest';
import { createKartikayProfile } from '../intelligence/profileFactory';
import { buildDayPlan, buildWeekPlans } from './buildDayPlan';
import { buildIcsCalendar } from './icsExport';

describe('Deal Planner', () => {
  const profile = createKartikayProfile();
  const anchor = new Date('2026-06-24T12:00:00+05:30');

  it('builds 24 PH windows for an IST day', () => {
    const plan = buildDayPlan(anchor, profile);
    expect(plan.windows.length).toBe(24);
    expect(plan.bestWindows.length).toBeGreaterThan(0);
    expect(plan.masterWindows.some((w) => w.personalHour === 11)).toBe(true);
  });

  it('marks deal windows as high conviction', () => {
    const plan = buildDayPlan(anchor, profile);
    expect(plan.dealWindows.length).toBeGreaterThan(0);
    plan.dealWindows.forEach((w) => {
      expect(w.isHighConviction).toBe(true);
      expect(w.quality === 'best' || w.isMaster).toBe(true);
    });
  });

  it('exports ICS with VEVENT blocks', () => {
    const week = buildWeekPlans(anchor, profile, [], 3);
    const ics = buildIcsCalendar(week, true);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:');
    expect(ics.split('BEGIN:VEVENT').length).toBeGreaterThan(2);
  });
});
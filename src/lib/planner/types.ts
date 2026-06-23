import type { PersonalHourQuality } from '../panchangJS/personalHours';

export interface PlannerWindow {
  personalHour: number;
  quality: PersonalHourQuality;
  isMaster: boolean;
  clockHour: number;
  windowStart: Date;
  windowEnd: Date;
  isHighConviction: boolean;
  learnedAvgOutcome: number | null;
  learnedSampleCount: number;
}

export interface DayPlan {
  dateLabel: string;
  dateIso: string;
  windows: PlannerWindow[];
  bestWindows: PlannerWindow[];
  masterWindows: PlannerWindow[];
  dealWindows: PlannerWindow[];
}

export interface AlertPreferences {
  enabled: boolean;
  minutesBefore: number;
  notifyBest: boolean;
  notifyMaster: boolean;
}

export const DEFAULT_ALERT_PREFS: AlertPreferences = {
  enabled: false,
  minutesBefore: 5,
  notifyBest: true,
  notifyMaster: true,
};
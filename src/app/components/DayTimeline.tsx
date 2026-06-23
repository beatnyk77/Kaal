import type { PlannerWindow } from '../../lib/planner/types';
import { formatIstTimeRange } from '../utils/datetime';

interface DayTimelineProps {
  windows: PlannerWindow[];
  now?: Date;
}

function qualityClass(q: PlannerWindow['quality'], isMaster: boolean): string {
  if (isMaster) return 'kala-timeline-row--master';
  if (q === 'best') return 'kala-timeline-row--best';
  if (q === 'friendly') return 'kala-timeline-row--friendly';
  if (q === 'caution') return 'kala-timeline-row--caution';
  return 'kala-timeline-row--neutral';
}

function isActive(w: PlannerWindow, now: Date): boolean {
  return now >= w.windowStart && now < w.windowEnd;
}

export function DayTimeline({ windows, now = new Date() }: DayTimelineProps) {
  return (
    <div className="kala-timeline">
      {windows.map((w) => {
        const active = isActive(w, now);
        return (
          <div
            key={`${w.clockHour}-${w.personalHour}`}
            className={`kala-timeline-row ${qualityClass(w.quality, w.isMaster)}${active ? ' kala-timeline-row--active' : ''}`}
          >
            <div className="kala-timeline-row__time">
              <span className="kala-timeline-row__hour">{String(w.clockHour).padStart(2, '0')}:20</span>
              <span className="kala-muted">{formatIstTimeRange(w.windowStart, w.windowEnd)}</span>
            </div>
            <div className="kala-timeline-row__ph">
              <strong>PH {w.personalHour}</strong>
              <span className="kala-timeline-row__tier">
                {w.isMaster ? 'master' : w.quality}
                {w.isHighConviction && ' · deal'}
              </span>
            </div>
            <div className="kala-timeline-row__meta">
              {w.learnedSampleCount > 0 ? (
                <span className={w.learnedAvgOutcome! >= 7 ? 'kala-pos' : 'kala-neg'}>
                  You: {w.learnedAvgOutcome!.toFixed(1)}/10 (n={w.learnedSampleCount})
                </span>
              ) : (
                <span className="kala-muted">No logs yet</span>
              )}
              {active && <span className="kala-timeline-live">LIVE</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
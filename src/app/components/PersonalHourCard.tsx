import type { PersonalHourEnriched } from '../../lib/hybridTimingAdvisor';
import { formatTimeWindow } from '../utils/datetime';

interface PersonalHourCardProps {
  personalHour: PersonalHourEnriched;
}

export function PersonalHourCard({ personalHour }: PersonalHourCardProps) {
  const ph = personalHour;

  return (
    <section className="kala-card kala-card--ph">
      <h2>Personal Hour</h2>
      <div className="kala-ph-hero">
        <span className="kala-ph-number">{ph.personalHour}</span>
        <span className={`kala-ph-quality kala-ph-quality--${ph.quality}`}>
          {ph.quality}
          {ph.isMaster ? ' · master' : ''}
        </span>
      </div>
      <p className="kala-muted">
        Window {formatTimeWindow(ph.windowStart)} → {formatTimeWindow(ph.windowEnd)} IST
      </p>
      <p className="kala-body">{ph.coreContext.whyItMatters}</p>
      {ph.coreContext.bestActions.length > 0 && (
        <div className="kala-chip-row">
          {ph.coreContext.bestActions.slice(0, 4).map((a) => (
            <span key={a} className="kala-chip kala-chip--good">
              {a}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
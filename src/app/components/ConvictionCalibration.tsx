import type { IntelligenceDashboard } from '../../lib/intelligence/analytics';

interface ConvictionCalibrationProps {
  calibration: IntelligenceDashboard['conviction_calibration'];
}

export function ConvictionCalibration({ calibration }: ConvictionCalibrationProps) {
  const bands = [
    { label: 'High', value: calibration.high_avg_outcome, color: 'high' },
    { label: 'Medium', value: calibration.medium_avg_outcome, color: 'medium' },
    { label: 'Low', value: calibration.low_avg_outcome, color: 'low' },
  ];

  return (
    <section className="kala-card">
      <h2>Conviction calibration</h2>
      <p className="kala-muted">Do High-conviction moments actually outperform for you?</p>

      <div className="kala-conv-bars">
        {bands.map((b) => (
          <div key={b.label} className="kala-conv-row">
            <span className="kala-conv-row__label">{b.label}</span>
            <div className="kala-conv-row__track">
              <div
                className={`kala-conv-row__fill kala-conv-row__fill--${b.color}`}
                style={{ width: b.value != null ? `${(b.value / 10) * 100}%` : '0%' }}
              />
            </div>
            <span className="kala-conv-row__value">
              {b.value != null ? `${b.value.toFixed(1)}/10` : '—'}
            </span>
          </div>
        ))}
      </div>

      {calibration.advisor_trust_score != null && (
        <p className="kala-body">
          Advisor trust delta:{' '}
          <strong className={calibration.advisor_trust_score >= 0 ? 'kala-pos' : 'kala-neg'}>
            {calibration.advisor_trust_score >= 0 ? '+' : ''}
            {calibration.advisor_trust_score.toFixed(1)}
          </strong>{' '}
          when you followed guidance vs not
        </p>
      )}
    </section>
  );
}
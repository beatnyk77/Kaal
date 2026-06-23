import type { DomainComboMetric } from '../../lib/intelligence/analytics';

interface ComboHeatmapProps {
  combosByDomain: Record<string, DomainComboMetric[]>;
}

function outcomeClass(avg: number): string {
  if (avg >= 7.5) return 'kala-combo-cell--high';
  if (avg >= 5.5) return 'kala-combo-cell--mid';
  return 'kala-combo-cell--low';
}

export function ComboHeatmap({ combosByDomain }: ComboHeatmapProps) {
  const domains = Object.keys(combosByDomain);

  if (domains.length === 0) {
    return (
      <section className="kala-card">
        <h2>Combo patterns</h2>
        <p className="kala-muted">Need more tagged logs per domain to surface winning timing combos.</p>
      </section>
    );
  }

  return (
    <section className="kala-card">
      <h2>Top combos by domain</h2>
      <p className="kala-muted">PH + panchang + GG33 fingerprint ranked by your outcomes</p>

      <div className="kala-combo-grid">
        {domains.map((domain) => (
          <div key={domain} className="kala-combo-domain">
            <h3>{domain}</h3>
            <ul>
              {combosByDomain[domain].map((c) => (
                <li key={c.combo_key} className={`kala-combo-cell ${outcomeClass(c.avg_outcome)}`}>
                  <div className="kala-combo-cell__top">
                    <strong>PH {c.personal_hour}</strong>
                    <span>{c.avg_outcome.toFixed(1)}/10</span>
                  </div>
                  <span className="kala-combo-cell__key">{c.combo_key}</span>
                  <span className="kala-muted">n={c.sample_count} · {Math.round(c.success_rate * 100)}% success</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
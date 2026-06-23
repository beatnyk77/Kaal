import type { PhComparisonMetric } from '../../lib/intelligence/analytics';

const TRACK_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];

function barClass(avg: number | null, hasData: boolean): string {
  if (!hasData || avg === null) return 'kala-ph-bar--empty';
  if (avg >= 7.5) return 'kala-ph-bar--excellent';
  if (avg >= 6) return 'kala-ph-bar--good';
  if (avg >= 4.5) return 'kala-ph-bar--mixed';
  return 'kala-ph-bar--poor';
}

interface PhHeatmapProps {
  comparisons: PhComparisonMetric[];
  globalAvg: number;
}

export function PhHeatmap({ comparisons, globalAvg }: PhHeatmapProps) {
  const byPh = new Map(comparisons.map((c) => [c.personal_hour, c]));
  const maxCount = Math.max(1, ...comparisons.map((c) => c.sample_count));

  return (
    <section className="kala-card">
      <h2>Personal Hour performance</h2>
      <p className="kala-muted">Outcome avg vs your global {globalAvg.toFixed(1)}/10 · bar height = sample size</p>

      <div className="kala-ph-heatmap">
        {TRACK_HOURS.map((ph) => {
          const m = byPh.get(ph);
          const height = m ? Math.max(12, (m.sample_count / maxCount) * 100) : 8;
          const avg = m?.avg_outcome ?? null;

          return (
            <div key={ph} className="kala-ph-bar-wrap" title={m ? `n=${m.sample_count} · ${m.avg_outcome.toFixed(1)}/10` : 'No data'}>
              <div
                className={`kala-ph-bar ${barClass(avg, Boolean(m))}`}
                style={{ height: `${height}%` }}
              />
              <span className="kala-ph-bar__label">{ph}</span>
              {m && <span className="kala-ph-bar__score">{m.avg_outcome.toFixed(1)}</span>}
            </div>
          );
        })}
      </div>

      {comparisons.length === 0 && (
        <p className="kala-muted">Log actions across different Personal Hours to populate this chart.</p>
      )}
    </section>
  );
}
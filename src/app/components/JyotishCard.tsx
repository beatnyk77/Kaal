import type { JyotishEnriched } from '../../lib/hybridTimingAdvisor';
import type { JyotishSource } from '../../lib/jyotishAdapter';

const SOURCE_LABEL: Record<JyotishSource, { text: string; className: string }> = {
  live: { text: 'Live API', className: 'kala-source--live' },
  stub: { text: 'Stub', className: 'kala-source--stub' },
  fallback: { text: 'Fallback', className: 'kala-source--fallback' },
};

interface JyotishCardProps {
  jyotish: JyotishEnriched;
}

export function JyotishCard({ jyotish }: JyotishCardProps) {
  const source = SOURCE_LABEL[jyotish.source];

  return (
    <section className="kala-card">
      <div className="kala-card__title-row">
        <h2>Jyotish</h2>
        <span className={`kala-source ${source.className}`}>{source.text}</span>
      </div>

      <div className="kala-grid-2">
        <div>
          <span className="kala-muted">Dasha</span>
          <p>
            <strong>
              {jyotish.dasha.maha}
              {jyotish.dasha.antar ? ` / ${jyotish.dasha.antar}` : ''}
            </strong>{' '}
            <span className={`kala-nature kala-nature--${jyotish.dasha.nature}`}>
              {jyotish.dasha.nature}
            </span>
          </p>
        </div>
        <div>
          <span className="kala-muted">Score</span>
          <p>
            <strong>{jyotish.score}</strong>/100
          </p>
        </div>
      </div>

      <p className="kala-body">{jyotish.dasha.note}</p>
      <p className="kala-muted">{jyotish.summary}</p>

      {jyotish.transits.length > 0 && (
        <ul className="kala-transit-list">
          {jyotish.transits.map((t, i) => (
            <li key={i} className={`kala-transit kala-transit--${t.nature}`}>
              <strong>
                {t.planet} {t.aspect} {t.target}
              </strong>
              <span>{t.note}</span>
            </li>
          ))}
        </ul>
      )}

      {jyotish.personalHourInteraction && (
        <p className="kala-muted" style={{ marginTop: 10 }}>
          PH interaction: {jyotish.personalHourInteraction}
        </p>
      )}

      {jyotish.error && (
        <p className="kala-error-inline">API fallback: {jyotish.error}</p>
      )}
    </section>
  );
}
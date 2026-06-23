import type { LearnedRule } from '../../lib/intelligence/types';

interface LearnedRulesListProps {
  rules: LearnedRule[];
}

const RULE_LABEL: Record<LearnedRule['rule_type'], string> = {
  boost_ph: 'Boost PH',
  avoid_ph: 'Avoid PH',
  boost_combo: 'Boost combo',
  domain_hint: 'Domain hint',
};

export function LearnedRulesList({ rules }: LearnedRulesListProps) {
  const active = rules.filter((r) => r.active);

  return (
    <section className="kala-card">
      <h2>Learned rules</h2>
      <p className="kala-muted">Promoted from your logs — fed back into the advisor</p>

      {active.length === 0 ? (
        <p className="kala-muted">Need ~5+ samples per pattern before rules activate (8+ logs for full learning).</p>
      ) : (
        <ul className="kala-rules">
          {active.map((r) => (
            <li key={r.id} className={`kala-rule kala-rule--${r.rule_type}`}>
              <div className="kala-rule__head">
                <span className="kala-rule__type">{RULE_LABEL[r.rule_type]}</span>
                <span className={r.effect.score_delta >= 0 ? 'kala-pos' : 'kala-neg'}>
                  {r.effect.score_delta >= 0 ? '+' : ''}
                  {r.effect.score_delta} score
                </span>
              </div>
              <p>{r.effect.message}</p>
              <span className="kala-muted">
                n={r.sample_count} · confidence {Math.round(r.confidence * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
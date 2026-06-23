import { useMemo } from 'react';
import { buildIntelligenceDashboard } from '../../lib/intelligence/analytics';
import type { IntelligenceStore } from '../../lib/intelligence/memoryStore';
import { ComboHeatmap } from '../components/ComboHeatmap';
import { ConvictionCalibration } from '../components/ConvictionCalibration';
import { LearnedRulesList } from '../components/LearnedRulesList';
import { MetricTiles } from '../components/MetricTiles';
import { PhHeatmap } from '../components/PhHeatmap';
import { RecentLogsList } from '../components/RecentLogsList';

interface DashboardPageProps {
  store: IntelligenceStore;
  userId: string;
  onGoToLog: () => void;
}

export function DashboardPage({ store, userId, onGoToLog }: DashboardPageProps) {
  const profile = store.getProfile(userId);
  const logs = store.getLogs(userId);
  const rules = store.getRules(userId);

  const dashboard = useMemo(() => buildIntelligenceDashboard(logs), [logs]);
  const phase = profile?.intelligence_state?.phase ?? 'cold_start';
  const coldStart = dashboard.total_logs < 8;

  const phaseLabel: Record<string, string> = {
    cold_start: 'Cold start',
    phase1_rules: 'Rules active',
    phase2_bayesian: 'Bayesian (preview)',
  };

  return (
    <div className="kala-page">
      <header className="kala-page__header">
        <div>
          <h1>Intelligence</h1>
          <p className="kala-subtitle">
            {profile?.identity.display_name ?? 'User'} · {phaseLabel[phase] ?? phase} ·{' '}
            {dashboard.total_logs} logged actions
          </p>
        </div>
        <button type="button" className="kala-btn kala-btn--primary" onClick={onGoToLog}>
          + Log action
        </button>
      </header>

      {coldStart && (
        <section className="kala-card kala-card--insights">
          <h2>Unlock personalized patterns</h2>
          <p>
            Log <strong>{8 - dashboard.total_logs}</strong> more action
            {8 - dashboard.total_logs === 1 ? '' : 's'} to exit cold start. Rules promote at ~5 samples per
            Personal Hour.
          </p>
        </section>
      )}

      <MetricTiles
        tiles={[
          {
            label: 'Avg outcome',
            value: dashboard.total_logs ? `${dashboard.overall_avg_outcome.toFixed(1)}/10` : '—',
          },
          {
            label: 'Success rate',
            value: dashboard.total_logs ? `${Math.round(dashboard.overall_success_rate * 100)}%` : '—',
            hint: 'score ≥ 7',
          },
          {
            label: 'Best deal PH',
            value: dashboard.best_ph_for_deals
              ? `PH ${dashboard.best_ph_for_deals.personal_hour}`
              : '—',
            hint: dashboard.best_ph_for_deals
              ? `${dashboard.best_ph_for_deals.avg_outcome.toFixed(1)}/10 · n=${dashboard.best_ph_for_deals.sample_count}`
              : undefined,
          },
          {
            label: 'Active rules',
            value: String(rules.filter((r) => r.active).length),
          },
        ]}
      />

      {dashboard.insights.length > 0 && (
        <section className="kala-card kala-card--insights">
          <h2>Insights</h2>
          <ul>
            {dashboard.insights.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </section>
      )}

      <PhHeatmap comparisons={dashboard.ph_comparisons} globalAvg={dashboard.overall_avg_outcome} />

      <div className="kala-dashboard-split">
        <ConvictionCalibration calibration={dashboard.conviction_calibration} />
        <LearnedRulesList rules={rules} />
      </div>

      <ComboHeatmap combosByDomain={dashboard.top_combos_by_domain} />

      <RecentLogsList logs={logs} />
    </div>
  );
}
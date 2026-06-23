import { useCallback, useEffect, useState } from 'react';
import { getHybridTimingAdviceWithLearning } from '../../lib/intelligence/advisorWithLearning';
import type { EnrichedAdvisorResponse } from '../../lib/intelligence/feedbackBridge';
import type { IntelligenceStore } from '../../lib/intelligence/memoryStore';
import { ConvictionBadge } from '../components/ConvictionBadge';
import { PersonalHourCard } from '../components/PersonalHourCard';
import { JyotishCard } from '../components/JyotishCard';
import { getDefaultJyotishOptions, isJyotishLiveEnabled } from '../../lib/jyotishConfig';
import { formatIstWall, istDateFromLocalInput, toIstDatetimeLocalValue } from '../utils/datetime';

interface AdvisorPageProps {
  store: IntelligenceStore;
  userId: string;
  logCount: number;
  onAdviceReady: (advice: EnrichedAdvisorResponse) => void;
  onGoToLog: () => void;
}

export function AdvisorPage({ store, userId, logCount, onAdviceReady, onGoToLog }: AdvisorPageProps) {
  const [useLive, setUseLive] = useState(true);
  const [customTime, setCustomTime] = useState('');
  const [advice, setAdvice] = useState<EnrichedAdvisorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profile = store.getProfile(userId);
  const jyotishLive = isJyotishLiveEnabled(getDefaultJyotishOptions());

  const resolveTarget = useCallback((): Date => {
    if (!useLive && customTime) return istDateFromLocalInput(customTime);
    return new Date();
  }, [useLive, customTime]);

  const fetchAdvice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHybridTimingAdviceWithLearning({
        targetDateTime: resolveTarget(),
        store,
        userProfile: profile,
      });
      setAdvice(result);
      onAdviceReady(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load advice');
    } finally {
      setLoading(false);
    }
  }, [resolveTarget, store, profile, onAdviceReady]);

  useEffect(() => {
    void fetchAdvice();
  }, [fetchAdvice]);

  useEffect(() => {
    if (!useLive) return;
    const id = setInterval(() => void fetchAdvice(), 60_000);
    return () => clearInterval(id);
  }, [useLive, fetchAdvice]);

  const targetLabel = useLive ? formatIstWall(new Date()) : customTime ? formatIstWall(resolveTarget()) : '—';

  return (
    <div className="kala-page">
      <header className="kala-page__header">
        <div>
          <h1>Kaal</h1>
          <p className="kala-subtitle">
            {profile?.identity.display_name ?? 'User'} · Core {profile?.numerology.core_number ?? 4} · IST +330
            {jyotishLive ? ' · Jyotish live' : ' · Jyotish stub'}
          </p>
        </div>
        <div className="kala-stats">
          <span className="kala-stat">
            <strong>{logCount}</strong> actions logged
          </span>
        </div>
      </header>

      <div className="kala-time-bar">
        <label className="kala-field kala-field--inline">
          <input
            type="checkbox"
            checked={useLive}
            onChange={(e) => {
              setUseLive(e.target.checked);
              if (e.target.checked) setCustomTime('');
            }}
          />
          Live now
        </label>
        {!useLive && (
          <label className="kala-field kala-field--inline">
            <span>IST time</span>
            <input
              type="datetime-local"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
            />
          </label>
        )}
        <button type="button" className="kala-btn" onClick={() => void fetchAdvice()} disabled={loading}>
          Refresh
        </button>
        <span className="kala-muted">Target: {targetLabel}</span>
        {!useLive && (
          <button
            type="button"
            className="kala-btn kala-btn--ghost"
            onClick={() => setCustomTime(toIstDatetimeLocalValue(new Date('2026-06-23T15:28:00+05:30')))}
          >
            15:28 IST
          </button>
        )}
        {!useLive && (
          <button
            type="button"
            className="kala-btn kala-btn--ghost"
            onClick={() => setCustomTime(toIstDatetimeLocalValue(new Date('2026-06-24T06:25:00+05:30')))}
          >
            06:25 IST
          </button>
        )}
      </div>

      {loading && !advice && <p className="kala-loading">Reading timing signals…</p>}
      {error && <p className="kala-error">{error}</p>}

      {advice && (
        <>
          <ConvictionBadge
            level={advice.conviction.level}
            score={advice.conviction.score}
            summary={advice.conviction.summary}
            learningDelta={advice.pattern.adjusted_conviction.delta_from_learning}
          />

          {advice.pattern.insights.length > 0 && (
            <section className="kala-card kala-card--insights">
              <h2>Learning</h2>
              <ul>
                {advice.pattern.insights.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </section>
          )}

          <PersonalHourCard personalHour={advice.personalHour} />

          <section className="kala-card">
            <h2>Panchang</h2>
            <div className="kala-grid-2">
              <div>
                <span className="kala-muted">Tithi</span>
                <p>{advice.panchang.tithi.name}</p>
              </div>
              <div>
                <span className="kala-muted">Nakshatra</span>
                <p>{advice.panchang.nakshatra.name}</p>
              </div>
              <div>
                <span className="kala-muted">Muhurta</span>
                <p>
                  {advice.panchang.muhurta.label} ({advice.panchang.muhurta.score})
                </p>
              </div>
              <div>
                <span className="kala-muted">Vara</span>
                <p>{advice.panchang.vara}</p>
              </div>
            </div>
          </section>

          <JyotishCard jyotish={advice.jyotish} />

          <section className="kala-card">
            <h2>GG33</h2>
            <p>
              Personal Year <strong>{advice.gg33.personalYear}</strong> · Day{' '}
              <strong>{advice.gg33.personalDay}</strong> · {advice.gg33.synergy} synergy
            </p>
            <p className="kala-muted">{advice.gg33.themeNote}</p>
          </section>

          <section className="kala-card kala-card--synthesis">
            <h2>Synthesis</h2>
            <div className="kala-columns">
              <div>
                <h3>Do</h3>
                <ul>
                  {advice.synthesis.dos.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Avoid</h3>
                <ul>
                  {advice.synthesis.donts.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            {advice.synthesis.highConvictionActions ? (
              <div className="kala-high-conviction">
                <h3>High-conviction actions</h3>
                <ul>
                  {advice.synthesis.highConvictionActions.map((a, i) => (
                    <li key={i}>
                      <strong>{a.domain}</strong> — {a.recommendation}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="kala-muted">High-conviction deal actions unlock on best/master Personal Hours.</p>
            )}
          </section>

          <details className="kala-card kala-details">
            <summary>Scoring breakdown</summary>
            <ul className="kala-breakdown">
              {advice.synthesis.scoringBreakdown.map((item, i) => (
                <li key={i}>
                  <span>{item.label}</span>
                  <span className={item.delta >= 0 ? 'kala-pos' : 'kala-neg'}>
                    {item.delta >= 0 ? '+' : ''}
                    {item.delta}
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <div className="kala-cta-row">
            <button type="button" className="kala-btn kala-btn--primary" onClick={onGoToLog}>
              Log this moment →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
import { useState } from 'react';
import type { ActionDomain } from '../../lib/intelligence/types';
import type { EnrichedAdvisorResponse } from '../../lib/intelligence/feedbackBridge';

const DOMAINS: { value: ActionDomain; label: string }[] = [
  { value: 'deal', label: 'Deal' },
  { value: 'build', label: 'Build' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'trading', label: 'Trading' },
  { value: 'launch', label: 'Launch' },
  { value: 'creative', label: 'Creative' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
];

export interface ActionLogFormValues {
  summary: string;
  domain: ActionDomain;
  outcomeScore: number;
  notes: string;
  followedAdvisor: boolean;
}

interface ActionLogFormProps {
  advice: EnrichedAdvisorResponse;
  onSubmit: (values: ActionLogFormValues) => void;
  disabled?: boolean;
}

export function ActionLogForm({ advice, onSubmit, disabled }: ActionLogFormProps) {
  const [summary, setSummary] = useState('');
  const [domain, setDomain] = useState<ActionDomain>('deal');
  const [outcomeScore, setOutcomeScore] = useState(7);
  const [notes, setNotes] = useState('');
  const [followedAdvisor, setFollowedAdvisor] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    onSubmit({ summary: summary.trim(), domain, outcomeScore, notes: notes.trim(), followedAdvisor });
    setSummary('');
    setNotes('');
    setOutcomeScore(7);
  };

  return (
    <form className="kala-form" onSubmit={handleSubmit}>
      <div className="kala-form__snapshot">
        <span className="kala-muted">Timing at log</span>
        <strong>
          PH {advice.personalHour.personalHour} ({advice.personalHour.quality}) ·{' '}
          {advice.conviction.level} {Math.round(advice.conviction.score)}
        </strong>
      </div>

      <label className="kala-field">
        <span>What did you do?</span>
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Sent term sheet to Acme Corp"
          required
          disabled={disabled}
        />
      </label>

      <label className="kala-field">
        <span>Domain</span>
        <select value={domain} onChange={(e) => setDomain(e.target.value as ActionDomain)} disabled={disabled}>
          {DOMAINS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <label className="kala-field">
        <span>
          Outcome score: <strong>{outcomeScore}</strong>/10
        </span>
        <input
          type="range"
          min={0}
          max={10}
          value={outcomeScore}
          onChange={(e) => setOutcomeScore(Number(e.target.value))}
          disabled={disabled}
        />
        <span className="kala-muted">7+ counts as success for pattern learning</span>
      </label>

      <label className="kala-field">
        <span>Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Context, surprises, what you'd repeat…"
          disabled={disabled}
        />
      </label>

      <label className="kala-checkbox">
        <input
          type="checkbox"
          checked={followedAdvisor}
          onChange={(e) => setFollowedAdvisor(e.target.checked)}
          disabled={disabled}
        />
        Followed advisor guidance
      </label>

      <button type="submit" className="kala-btn kala-btn--primary" disabled={disabled || !summary.trim()}>
        Log action
      </button>
    </form>
  );
}
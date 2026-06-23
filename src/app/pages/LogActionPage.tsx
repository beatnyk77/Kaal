import { useState } from 'react';
import type { EnrichedAdvisorResponse } from '../../lib/intelligence/feedbackBridge';
import { ActionLogForm, type ActionLogFormValues } from '../components/ActionLogForm';

interface LogActionPageProps {
  advice: EnrichedAdvisorResponse | null;
  onSubmit: (values: ActionLogFormValues) => void | Promise<void>;
  onBack: () => void;
}

export function LogActionPage({ advice, onSubmit, onBack }: LogActionPageProps) {
  const [saved, setSaved] = useState(false);

  if (!advice) {
    return (
      <div className="kala-page">
        <h1>Log Action</h1>
        <p className="kala-muted">Get timing advice first, then log what you did.</p>
        <button type="button" className="kala-btn kala-btn--primary" onClick={onBack}>
          ← Back to Advisor
        </button>
      </div>
    );
  }

  const handleSubmit = (values: ActionLogFormValues) => {
    onSubmit(values);
    setSaved(true);
  };

  return (
    <div className="kala-page">
      <header className="kala-page__header">
        <div>
          <h1>Log Action</h1>
          <p className="kala-subtitle">Capture outcome to train your personal timing patterns</p>
        </div>
        <button type="button" className="kala-btn" onClick={onBack}>
          ← Advisor
        </button>
      </header>

      {saved ? (
        <section className="kala-card kala-card--success">
          <h2>Saved</h2>
          <p>Action logged with full timing snapshot. Patterns update on next advisor refresh.</p>
          <button type="button" className="kala-btn kala-btn--primary" onClick={onBack}>
            Back to Advisor
          </button>
        </section>
      ) : (
        <section className="kala-card">
          <ActionLogForm advice={advice} onSubmit={handleSubmit} />
        </section>
      )}
    </div>
  );
}
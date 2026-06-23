import type { ActionLogEntry } from '../../lib/intelligence/types';

interface RecentLogsListProps {
  logs: ActionLogEntry[];
}

export function RecentLogsList({ logs }: RecentLogsListProps) {
  const recent = [...logs].sort((a, b) => b.action_at.localeCompare(a.action_at)).slice(0, 8);

  return (
    <section className="kala-card">
      <h2>Recent actions</h2>
      {recent.length === 0 ? (
        <p className="kala-muted">No actions logged yet.</p>
      ) : (
        <ul className="kala-recent-logs">
          {recent.map((log) => (
            <li key={log.id} className="kala-recent-log">
              <div className="kala-recent-log__main">
                <strong>{log.action.summary}</strong>
                <span className={`kala-outcome kala-outcome--${log.outcome.score >= 7 ? 'good' : 'low'}`}>
                  {log.outcome.score}/10
                </span>
              </div>
              <span className="kala-muted">
                PH {log.timing_snapshot.personal_hour.number} · {log.conviction.level} ·{' '}
                {log.action.domain ?? 'other'} ·{' '}
                {new Date(log.action_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
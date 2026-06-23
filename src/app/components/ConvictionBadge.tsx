import type { ConvictionLevel } from '../../lib/hybridTimingAdvisor';

const LEVEL_STYLES: Record<ConvictionLevel, { bg: string; border: string; label: string }> = {
  High: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.5)', label: 'High conviction' },
  Medium: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.5)', label: 'Medium conviction' },
  Low: { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)', label: 'Low conviction' },
};

interface ConvictionBadgeProps {
  level: ConvictionLevel;
  score: number;
  summary?: string;
  learningDelta?: number;
}

export function ConvictionBadge({ level, score, summary, learningDelta }: ConvictionBadgeProps) {
  const style = LEVEL_STYLES[level];

  return (
    <div
      className="kala-conviction"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="kala-conviction__main">
        <span className="kala-conviction__level">{level}</span>
        <span className="kala-conviction__score">{Math.round(score)}</span>
      </div>
      <span className="kala-conviction__label">{style.label}</span>
      {summary && <p className="kala-conviction__summary">{summary}</p>}
      {learningDelta !== undefined && learningDelta !== 0 && (
        <span className="kala-conviction__delta">
          Learning {learningDelta >= 0 ? '+' : ''}
          {learningDelta}
        </span>
      )}
    </div>
  );
}
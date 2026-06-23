interface MetricTile {
  label: string;
  value: string;
  hint?: string;
}

interface MetricTilesProps {
  tiles: MetricTile[];
}

export function MetricTiles({ tiles }: MetricTilesProps) {
  return (
    <div className="kala-metrics">
      {tiles.map((t) => (
        <div key={t.label} className="kala-metric">
          <span className="kala-muted">{t.label}</span>
          <strong className="kala-metric__value">{t.value}</strong>
          {t.hint && <span className="kala-metric__hint">{t.hint}</span>}
        </div>
      ))}
    </div>
  );
}
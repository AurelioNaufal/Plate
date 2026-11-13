type RingProps = { value: number; target: number | null; color: string; label: string };

/** A progress ring. Without a target it shows an empty track. */
export function Ring({ value, target, color, label }: RingProps) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const share = target ? Math.min(value / target, 1) : 0;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={label} style={{ flex: "none" }}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--track)" strokeWidth="9" />
      {share > 0 && (
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
          transform="rotate(-90 42 42)"
        />
      )}
    </svg>
  );
}

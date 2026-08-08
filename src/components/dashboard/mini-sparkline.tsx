/** Tiny inline trend line for a stat card — same polyline technique as
 * TrendPanel, scaled down and without axes/labels. */
export function MiniSparkline({
  values,
  color = "var(--accent-500)",
}: {
  values: number[];
  color?: string;
}) {
  if (values.length < 2) return null;

  const width = 100;
  const height = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

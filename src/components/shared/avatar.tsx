/**
 * Renders the user's uploaded photo, or a gradient initials circle when
 * there isn't one — the fallback every avatar spot in the app used before
 * uploads existed. `src`/`alt` are plain <img> props: avatars live in a
 * public Supabase Storage bucket, not the local origin, so next/image would
 * need a remotePatterns entry per project instead of just working.
 */
export function Avatar({
  src,
  name,
  size = 40,
  className = "",
  gradient = "from-accent-500 to-purple-500",
  /** Raw background (e.g. a per-card gradient) — takes over from `gradient`
   * when set, for the few spots that don't use the shared brand gradient. */
  background,
  /** Set when the caller already renders the name as visible text next to
   * this avatar — otherwise it is the only identifier on screen (e.g. a
   * kanban card's assignee dot) and needs its own accessible name. */
  decorative = false,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  gradient?: string;
  background?: string;
  decorative?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  if (src) {
    return (
      <img
        src={src}
        alt={decorative ? "" : name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden={decorative}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      title={decorative ? undefined : name}
      style={{ width: size, height: size, fontSize: size * 0.4, background }}
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${
        background ? "" : `bg-gradient-to-br ${gradient}`
      } ${className}`}
    >
      {initials}
    </span>
  );
}

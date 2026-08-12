// No "use client"/"use server" directive on purpose: this is called both
// from a Server Component (welcome-banner.tsx, for the initial/SSR value)
// and from a client component (live-greeting.tsx, to correct it to the
// browser's own local time after mount). A plain function exported from a
// "use client" file is treated as a client-only reference by Next's
// compiler - calling it directly from a Server Component throws
// "Attempted to call X() from the server but X is on the client" at
// request time (passed the build, only failed once actually rendered).

export function greetingFor(hour: number): string {
  if (hour < 12) return "صباح الخير";
  if (hour < 18) return "مساء الخير";
  return "مساء النور";
}

export function formatDateLabel(d: Date): string {
  return new Intl.DateTimeFormat("ar", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

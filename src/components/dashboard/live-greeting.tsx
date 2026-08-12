"use client";

import { useEffect, useState } from "react";
import { formatDateLabel, greetingFor } from "@/lib/greeting";

/**
 * The server always computes "now" in the deployment's own clock (UTC on
 * Vercel), which can land on the wrong side of noon/6pm for a viewer in a
 * different timezone - "2pm" for the user showing "صباح الخير". `initial`
 * is the server-computed value so the very first client render still
 * matches SSR output exactly (no hydration warning); the effect then
 * corrects it to the browser's own local time right after mount.
 */
export function LiveGreeting({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    // deferred rather than a direct call in the effect body itself, so this
    // is a correction reacting to "mount happened" rather than a
    // synchronous render-time state change
    queueMicrotask(() => setText(greetingFor(new Date().getHours())));
  }, []);
  return <>{text}</>;
}

export function LiveDateLabel({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    queueMicrotask(() => setText(formatDateLabel(new Date())));
  }, []);
  return <>{text}</>;
}

/**
 * Base URL for the Next.js web app's API routes that the mobile app also
 * needs (currently just /api/ai/chat - the AI assistant's Gemini call and
 * tool-execution loop live server-side only, there's no local equivalent).
 * Everything else the app does goes straight to Supabase (src/lib/supabase.ts).
 *
 * Points at the real Vercel production deployment (see PROJECT.md) - this
 * is a public HTTPS endpoint reachable from any device, unlike Metro's
 * localhost-only dev server.
 */
export const API_BASE_URL = "https://taskflow-pro-kappa-ruddy.vercel.app";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Unset on Vercel (served at the domain root) - only set for the VPS trial
  // instance, which lives under https://abukotsh.tech/taskflow behind Nginx.
  basePath: process.env.BASE_PATH || undefined,
  experimental: {
    // Server Action requests are capped at 1MB by default. Several features
    // (chat/task/workflow attachments) advertise a 20MB client-side limit,
    // so the cap must cover that - not just the smaller avatar/logo uploads -
    // or every attachment past this value silently fails with no server-side
    // error ever reached (Next rejects the request before the action runs).
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Action requests are capped at 1MB by default - below both the
    // avatar (3MB) and organization logo (2MB) upload limits, so any file
    // past ~1MB failed with a 500 ("Body exceeded 1 MB limit") no matter
    // how small the client-side limit said it should be.
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;

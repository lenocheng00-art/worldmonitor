import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      "/portfolio-overview",
      "/portfolio",
      "/portfolio/:path*",
      "/balance-sheet",
      "/cash-flow",
      "/portfolio-settings",
      "/industry-chains",
      "/asset-todos",
    ].map((source) => ({
      source,
      destination: "/signal-inbox",
      permanent: false,
    })).concat([
      { source: "/alan-chan", destination: "/signal-monitor", permanent: false },
      { source: "/stocks", destination: "/watchlist", permanent: false },
    ]);
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev overlay indicator: it throws a noisy
  // "releasePointerCapture ... No active pointer with the given id" error
  // in the browser console while navigating. Dev-only, no effect on production.
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

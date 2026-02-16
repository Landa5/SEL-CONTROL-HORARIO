import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: false,
  serverExternalPackages: ['pdf-parse'],
};

import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: false, // Enable in dev for testing if needed, or process.env.NODE_ENV === "development"
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);

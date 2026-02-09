import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: false,
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;

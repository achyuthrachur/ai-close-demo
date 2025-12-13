import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Helps local builds fetch fonts when corporate TLS interception is present.
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;

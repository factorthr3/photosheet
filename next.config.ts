import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory otherwise confuses root detection.
  turbopack: { root: __dirname },
};

export default nextConfig;

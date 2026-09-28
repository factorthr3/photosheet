import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory otherwise confuses root detection.
  turbopack: { root: __dirname },
  poweredByHeader: false,
  // Native / worker-thread packages must stay out of the server bundle.
  serverExternalPackages: ["pg-boss", "pg", "heic-decode", "libheif-js"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// Conservative security headers applied to every response. Deliberately no Content-Security-Policy
// here — a wrong CSP silently breaks the app, and adding one warrants its own review.
const securityHeaders = [
  // This app is never meant to be framed; deny it outright to prevent clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

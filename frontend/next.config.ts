import type { NextConfig } from "next";

// Conservative security headers applied to every response. The Content-Security-Policy is NOT
// here — it lives in proxy.ts, because it embeds a per-request nonce that a static config can't.
const securityHeaders = [
  // This app is never meant to be framed; deny it outright to prevent clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Allow the microphone for our own origin only — the dictation feature (Web Speech API)
  // needs it. camera/geolocation stay fully disabled.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

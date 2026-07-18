import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "connect-src 'self' https:",
              "font-src 'self' data:",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "object-src 'none'",
              "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

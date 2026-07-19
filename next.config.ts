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
              // 'blob:' cobre o fetch do binário .wasm que o onnxruntime-web
              // pode servir a partir de uma URL blob durante a transcrição.
              "connect-src 'self' https: blob:",
              "font-src 'self' data:",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "object-src 'none'",
              // 'blob:' é necessário para o onnxruntime-web (backend WASM do
              // Whisper via transformers.js), que instancia scripts/worker a
              // partir de URLs blob durante a transcrição no navegador.
              "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
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

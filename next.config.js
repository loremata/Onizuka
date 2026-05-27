/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

function buildSecurityHeaders() {
  /** @type {{ key: string; value: string }[]} */
  const headers = [
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  const connectSrc = isProd ? "'self' https:" : "'self' https: http: ws: wss:";

  headers.push({
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
    ]
      .join("; ")
      .replace(/\s+/g, " "),
  });

  return headers;
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },

  /** In dev disabilita cache webpack su disco (fix refresh / chunk 1682.js mancante). */
  webpack(config, { dev }) {
    if (dev) {
      config.cache = false;
    }
    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ];
  },

  async redirects() {
    const primaryHost = process.env.ONIZUKA_PRIMARY_HOST?.trim();
    if (!primaryHost || !isProd) return [];

    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${primaryHost}` }],
        destination: `https://${primaryHost}/:path*`,
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;

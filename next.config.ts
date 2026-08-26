import type { NextConfig } from "next";

/**
 * هاست‌های مجاز برای next/image. هاست‌های رایجِ ذخیره‌سازی را به‌صورت صریح
 * نگه می‌داریم و علاوه‌برآن از envهای مختلفِ سازگار با استقرار هم hostname
 * استخراج می‌کنیم تا تغییر دامنه‌ی عمومیِ storage باعث 400 از image optimizer
 * نشود.
 */
const ARVAN_STORAGE_HOST = "qafaseh-prod.s3.ir-thr-at1.arvanstorage.ir";

function resolveImageHosts(): string[] {
  const hosts = new Set<string>([
    ARVAN_STORAGE_HOST,
    "qafaseh-prod.s3.ir-thr-at1.liara.space",
  ]);

  const candidates = [
    process.env.S3_PUBLIC_BASE_URL,
    process.env.S3_PUBLIC_URL,
    process.env.STORAGE_PUBLIC_URL,
    process.env.ARVAN_PUBLIC_URL,
    process.env.ARVAN_ENDPOINT,
    process.env.S3_ENDPOINT,
  ];

  for (const value of candidates) {
    if (!value) continue;
    try {
      hosts.add(new URL(value).hostname);
    } catch {
      // اگر مقدار نامعتبر بود، فقط fallbackها استفاده می‌شوند.
    }
  }

  return [...hosts];
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https://*.arvanstorage.ir https://*.liara.space https://www.iranketab.ir https://iranketab.ir https://img.iranketab.ir https://lh3.googleusercontent.com",
      "font-src 'self' data: https://cdn.jsdelivr.net",
      "connect-src 'self' https://*.arvanstorage.ir https://*.liara.space https://www.iranketab.ir",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["@ghafaseh/iranketab-extractor"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    qualities: [60, 75, 78],
    remotePatterns: [
      ...resolveImageHosts().map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/**",
      })),

      // Explicit IranKetab patterns برای اطمینان بیشتر
      {
        protocol: "https",
        hostname: "www.iranketab.ir",
        pathname: "/Images/ProductImages/**",
      },
      {
        protocol: "https",
        hostname: "iranketab.ir",
        pathname: "/Images/ProductImages/**",
      },
      ...["www.iranketab.ir", "iranketab.ir", "img.iranketab.ir"].map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/Files/AttachFiles/**",
      })),
      {
        protocol: "https",
        hostname: "img.iranketab.ir",
        pathname: "/Images/ProductImages/**",
      },
    ],
  },
};
export default nextConfig;

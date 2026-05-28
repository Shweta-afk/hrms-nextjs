import type { NextConfig } from "next";

/**
 * HTTP security headers applied to every response.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.s3.amazonaws.com https://*.s3.ap-south-1.amazonaws.com https://api.razorpay.com https://*.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Gzip/Brotli compression for all responses
  compress: true,

  // Allow next/image to optimize images from S3 and external org logos
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.ap-south-1.amazonaws.com",
      },
      // Fallback for any other https image source (org logos, avatars)
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // Modern formats — Vercel serves WebP/AVIF automatically
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      // Security headers on every route
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Long-lived cache for static assets that Next.js content-hashes
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Public folder assets (logos, favicons) — 1 hour, revalidate in background
      {
        source: "/:file(.*\\.(?:png|jpg|jpeg|svg|ico|webp|avif|woff2?))",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

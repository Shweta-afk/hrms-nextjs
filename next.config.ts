import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

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
      // unsafe-eval is only permitted in development (Next.js hot-reload needs it).
      // It is intentionally stripped from production builds.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com https://*.razorpay.com`,
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

  // Rewrite barrel imports (`import { X } from 'pkg'`) into direct deep
  // imports at compile time. These packages each re-export hundreds of
  // modules from one entry point; without this, importing a single icon or
  // one Radix primitive pulls the whole barrel into the route's module graph.
  // Result: fewer modules compiled per route (faster cold builds + HMR) and
  // smaller client JS — with zero change in behavior.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@tanstack/react-query",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
    ],
  },

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

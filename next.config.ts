import type { NextConfig } from "next";

/**
 * HTTP security headers applied to every response.
 *
 * - `Strict-Transport-Security`: tells browsers to only ever talk HTTPS to us.
 *   includeSubDomains + preload-ready (1 year). Skip if you don't yet own the
 *   apex/subdomains you list here.
 * - `X-Frame-Options: DENY`: blocks clickjacking by refusing to render inside
 *   any iframe.
 * - `X-Content-Type-Options: nosniff`: prevents the browser from guessing
 *   MIME types (defends against MIME-confusion attacks).
 * - `Referrer-Policy`: don't leak the full URL when navigating to third parties.
 * - `Permissions-Policy`: deny browser features we don't use.
 * - `Content-Security-Policy`: tight default. Allows self-served scripts,
 *   inline styles (Tailwind needs them), Razorpay checkout, and AWS S3 for
 *   uploads. Adjust the connect-src list when you add new third-party APIs.
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
      // Razorpay checkout loads its own JS + needs inline + eval.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // S3 presigned URLs, Razorpay API, our own API.
      "connect-src 'self' https://*.s3.amazonaws.com https://*.s3.ap-south-1.amazonaws.com https://api.razorpay.com https://*.razorpay.com",
      // Razorpay opens a payment iframe.
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

/**
 * @type {import('next').NextConfig}
 *
 * Static export site (output: 'export') — headers set here apply at build time
 * but are typically served by the underlying static host (nginx/Caddy). When
 * the host rewrites/strips headers, surface them via host config instead.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https://blog.hansendong.top",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

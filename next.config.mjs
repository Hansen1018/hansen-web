/**
 * @type {import('next').NextConfig}
 *
 * Static export site (output: 'export'). Response headers (CSP, X-Frame-Options,
 * Referrer-Policy, etc.) are NOT applied by Next.js under output: 'export' —
 * they must be configured at the static host (nginx/Caddy). See deploy host
 * config for the equivalent ruleset.
 */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
};

export default nextConfig;

/**
 * @type {import('next').NextConfig}
 *
 * Static export site (output: 'export'). Response headers (CSP, X-Frame-Options,
 * Referrer-Policy, Permissions-Policy) are NOT applied by Next.js under
 * output: 'export' — they must be configured at the static host (nginx/Caddy).
 *
 * See deploy/nginx-security-headers.conf for the recommended nginx snippet
 * (the header values match what was previously declared here). deploy.sh
 * verifies these headers are present on the live site after every deploy and
 * prints a warning (not an error) if any are missing.
 */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
};

export default nextConfig;

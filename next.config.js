'use strict';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The UI calls the API routes from the same origin, so no CORS headers are
  // sent. That keeps other websites from using this deployment as a proxy
  // from their visitors' browsers.
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
  ],
};

module.exports = nextConfig;

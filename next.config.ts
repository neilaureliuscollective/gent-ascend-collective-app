import type { NextConfig } from 'next';
import { parseEnvironment } from './src/platform/environment';
parseEnvironment(process.env);
const config: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }] },
  async redirects() {
    return [
      // Retained installation URLs resolve to the approved current mobile artwork.
      ...[192, 512].flatMap((size) =>
        [`/brand/icon-${size}.png`, `/brand/icon-v2-${size}.png`].map((source) => ({
          source,
          destination: `/brand/aethelios-app-20261008-${size}.png`,
          permanent: false,
        })),
      ),
      ...['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'].map((source) => ({
        source,
        destination: '/brand/aethelios-app-20261008-apple-180.png',
        permanent: false,
      })),
      ...['conversation', 'starter', 'link'].map((key) => ({
        source: '/aethelios',
        has: [{ type: 'query' as const, key }],
        destination: '/app/aethelios',
        permanent: false,
      })),
      ...[
        'world',
        'progress',
        'you',
        'welcome',
        'founder',
        'goals',
        'captures',
        'ascend-profile',
      ].map((path) => ({
        source: `/${path}/:path*`,
        destination: `/app/${path}/:path*`,
        permanent: true,
      })),
      { source: '/aurelius/:path*', destination: '/app/aethelios/:path*', permanent: true },
      { source: '/aethelios/meet', destination: '/app/aethelios/meet', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;

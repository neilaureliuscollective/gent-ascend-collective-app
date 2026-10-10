import type { NextConfig } from 'next';
import { parseEnvironment } from './src/platform/environment';
parseEnvironment(process.env);
const config: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }] },
  async redirects() {
    return [
      // Retained installation URLs resolve to the founder-approved text-free crest.
      ...[192, 512].flatMap((size) =>
        [
          `/brand/icon-${size}.png`,
          `/brand/icon-v2-${size}.png`,
          `/brand/app-crest-20261004-${size}.png`,
          `/brand/deep-green-20261006-${size}.png`,
          `/brand/aethelios-official-20261008-${size}.png`,
          `/brand/aethelios-imperial-steel-20261009-${size}.png`,
        ].map((source) => ({
          source,
          destination: `/brand/aethelios-imperial-obsidian-20261010-${size}.png`,
          permanent: false,
        })),
      ),
      ...[
        'app-crest-20261004',
        'deep-green-20261006',
        'aethelios-official-20261008',
        'aethelios-imperial-steel-20261009',
      ].map((version) => ({
        source: `/brand/${version}-maskable-512.png`,
        destination: '/brand/aethelios-imperial-obsidian-20261010-maskable-512.png',
        permanent: false,
      })),
      ...['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'].map((source) => ({
        source,
        destination: '/apple-icon.png',
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

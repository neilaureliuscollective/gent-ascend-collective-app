import type { MetadataRoute } from 'next';
import { brand } from '@/platform/brand';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    id: '/',
    scope: '/',
    start_url: '/app',
    shortcuts: [
      { name: 'Aethelios', url: '/app/aethelios' },
      { name: 'Company work', url: '/app/work' },
    ],
    display: 'standalone',
    background_color: brand.themeColor,
    theme_color: brand.themeColor,
    icons: [
      {
        src: '/brand/aether-20261007-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/aether-20261007-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/aether-20261007-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

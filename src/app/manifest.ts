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
      { name: 'Command', url: '/app' },
      { name: 'Aethelios', url: '/app/aethelios' },
      { name: 'Company work', url: '/app/work' },
    ],
    display: 'standalone',
    background_color: brand.themeColor,
    theme_color: brand.themeColor,
    icons: [
      {
        src: '/brand/aethelios-official-20261015-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/aethelios-official-20261015-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/aethelios-official-20261015-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/brand/aethelios-official-20261015-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

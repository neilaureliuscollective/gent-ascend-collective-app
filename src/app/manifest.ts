import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aurelius Collective',
    short_name: 'Aurelius',
    description: 'Your personal operating environment.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09080D',
    theme_color: '#09080D',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}

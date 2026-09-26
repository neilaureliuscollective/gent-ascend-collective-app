import type { SceneMedia } from '@/components/public/media-scene';
/** Editorial configuration. Availability is explicit and never inferred from a link. */
export const publicWorld = {
  reserveUrl: process.env.NEXT_PUBLIC_RESERVE_URL || null,
  reserveMedia: undefined as SceneMedia | undefined,
  ritualMedia: undefined as SceneMedia | undefined,
  hero: {
    poster: '/media/louisiana-dawn.webp',
    alt: 'Golden dawn through an ancient Louisiana live oak — concept imagery',
    credit: 'Louisiana dawn · concept study',
    // Add locally hosted or CDN film sources here when approved. Layouts stay unchanged.
    video: undefined as string | undefined,
    mobileVideo: undefined as string | undefined,
    focalPoint: '68% center',
  },
};

export function reserveDestination() {
  try {
    const url = new URL(publicWorld.reserveUrl ?? '');
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

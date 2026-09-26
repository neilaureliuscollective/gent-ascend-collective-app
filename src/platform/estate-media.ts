import type { SceneMedia } from '@/components/public/media-scene';
/** Replace approved posters/film sources here without changing scene choreography.
 * Films: muted MP4, short seamless loop, portrait mobileVideo + landscape video.
 * Do not publish concept architecture as documentary Reserve photography.
 */
export const estateMedia: Record<'arrival' | 'ritual' | 'legacy', SceneMedia> = {
  arrival: {
    poster: '/media/world/arrival.webp',
    alt: 'An imagined emerald pavilion opening onto a Louisiana live oak at dawn',
    credit: 'Architectural brand visualization',
    focalPoint: '62% center',
  },
  ritual: {
    poster: '/media/world/ritual.webp',
    mobilePoster: '/media/world/ritual-mobile.webp',
    alt: 'Vitalis hair and beard oil in an emerald stone ritual setting; campaign visualization',
    credit: 'Vitalis campaign visualization',
    focalPoint: '72% center',
  },
  legacy: {
    poster: '/media/louisiana-dawn.webp',
    alt: 'Louisiana live oak in warm light — concept imagery',
    credit: 'Louisiana concept imagery',
    focalPoint: '65% center',
  },
};

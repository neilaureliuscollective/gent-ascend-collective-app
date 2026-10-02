'use client';

import { useEffect, useRef } from 'react';
import { useWorldStill } from '@/components/public/cinematic-world';

/** Native scroll, scoped timelines and no per-frame React updates. */
export function CommerceMotion({ revision = '' }: { revision?: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const still = useWorldStill();
  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>('.reserve-commerce');
    if (!root || still) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([module, plugin]) => {
        if (disposed) return;
        const gsap = module.default;
        gsap.registerPlugin(plugin.ScrollTrigger);
        const media = gsap.matchMedia();
        const context = gsap.context(() => {
          media.add(
            {
              motion: '(prefers-reduced-motion: no-preference)',
              narrow: '(max-width: 759px)',
              wide: '(min-width: 760px)',
            },
            (match) => {
              if (!match.conditions?.motion) return;
              root.dataset.commerceMotion = 'active';
              const narrow = Boolean(match.conditions?.narrow);
              const sections = root.querySelectorAll<HTMLElement>(
                '.reserve-editorial-section, .reserve-shelf-heading, .reserve-discovery',
              );
              sections.forEach((section) => {
                gsap.fromTo(
                  section,
                  { y: narrow ? 22 : 45, opacity: 0.5 },
                  {
                    y: 0,
                    opacity: 1,
                    duration: 0.9,
                    ease: 'power2.out',
                    scrollTrigger: {
                      trigger: section,
                      start: 'top 94%',
                      toggleActions: 'play none none reverse',
                    },
                  },
                );
              });
              Array.from(root.querySelectorAll<HTMLElement>('.reserve-collection-object'))
                .slice(0, 36)
                .forEach((item) => {
                  gsap.fromTo(
                    item,
                    { y: narrow ? 24 : 55 },
                    {
                      y: 0,
                      duration: 1,
                      ease: 'power3.out',
                      scrollTrigger: {
                        trigger: item,
                        start: 'top 98%',
                        toggleActions: 'play none none reverse',
                      },
                    },
                  );
                });
              root.querySelectorAll<HTMLElement>('.reserve-scene-light').forEach((light) => {
                gsap.fromTo(
                  light,
                  { xPercent: -15, rotate: -18, opacity: 0.35 },
                  {
                    xPercent: 15,
                    rotate: 8,
                    opacity: 0.75,
                    ease: 'none',
                    scrollTrigger: {
                      trigger: light.parentElement,
                      start: 'top bottom',
                      end: 'bottom top',
                      scrub: 0.9,
                    },
                  },
                );
              });
              const hero = root.querySelector('.reserve-shop-hero, .reserve-product-intro');
              if (hero) {
                gsap.fromTo(
                  hero.querySelector('.reserve-shop-headline, .reserve-product-copy'),
                  { y: 28, opacity: 0.5 },
                  { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out' },
                );
                const image = hero.querySelector(
                  '.reserve-hero-object .reserve-photo-frame, .reserve-image-button',
                );
                if (image)
                  gsap.fromTo(
                    image,
                    { y: -12, scale: 0.96 },
                    {
                      y: narrow ? 8 : 14,
                      scale: 1.01,
                      ease: 'none',
                      scrollTrigger: {
                        trigger: hero,
                        start: 'top top',
                        end: 'bottom top',
                        scrub: 0.7,
                      },
                    },
                  );
              }
              return () => {
                delete root.dataset.commerceMotion;
              };
            },
          );
        }, root);
        cleanup = () => {
          media.revert();
          context.revert();
          delete root.dataset.commerceMotion;
        };
      })
      .catch(() => {
        /* Full product content remains readable without animation. */
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [still, revision]);
  return <span ref={marker} hidden aria-hidden="true" />;
}

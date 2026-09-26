'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useWorldStill } from './cinematic-world';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Native document scroll remains the source of truth. Text stays in the DOM. */
export function WorldJourney({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const still = useWorldStill();
  useGSAP(
    () => {
      if (still || !root.current) return;
      const node = root.current;
      const hero = node.querySelector<HTMLElement>('.estate-hero-copy');
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        node.dataset.choreographed = 'true';
        const arrival = gsap.timeline({
          scrollTrigger: {
            trigger: '.estate-opening',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.35,
            onUpdate: (self) => {
              if (hero) hero.inert = self.progress > 0.38;
            },
          },
        });
        arrival
          .to('.estate-landscape', { scale: 1.28, transformOrigin: '65% 50%', ease: 'none' }, 0)
          .to('.estate-hero-copy', { y: -65, opacity: 0, duration: 0.24 }, 0.14)
          .fromTo(
            '.estate-threshold',
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.2 },
            0.38,
          )
          .to('.estate-threshold', { opacity: 0, y: -30, duration: 0.16 }, 0.74)
          .fromTo('.estate-veil', { opacity: 0 }, { opacity: 0.9, duration: 0.25 }, 0.75);
        for (const scene of root.current!.querySelectorAll<HTMLElement>('.estate-act')) {
          const art = scene.querySelector('.estate-art');
          if (art)
            gsap.fromTo(
              art,
              { yPercent: -5, scale: 1.08 },
              {
                yPercent: 5,
                scale: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: scene,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 0.4,
                },
              },
            );
        }
        for (const scene of node.querySelectorAll<HTMLElement>(
          '.estate-act, .estate-collection, .estate-invitation',
        )) {
          const environment = scene.querySelector('.atmosphere-environment');
          if (environment)
            gsap.fromTo(
              environment,
              { scale: 1.08, yPercent: -2 },
              {
                scale: 1.02,
                yPercent: 2,
                ease: 'none',
                scrollTrigger: {
                  trigger: scene,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 0.5,
                },
              },
            );
        }
        gsap.fromTo(
          '.estate-orbit',
          { rotateZ: -22, rotateY: -20 },
          {
            rotateZ: 32,
            rotateY: 30,
            ease: 'none',
            scrollTrigger: {
              trigger: '#the-intelligence',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.4,
            },
          },
        );
        gsap.fromTo(
          '.estate-reserve-frame',
          { clipPath: 'inset(12% 20% round 160px 160px 0 0)' },
          {
            clipPath: 'inset(0% 0% round 0px)',
            ease: 'none',
            scrollTrigger: {
              trigger: '#the-reserve',
              start: 'top 80%',
              end: 'center center',
              scrub: 0.35,
            },
          },
        );
      });
      return () => {
        media.revert();
        delete node.dataset.choreographed;
        if (hero) hero.inert = false;
      };
    },
    { scope: root, dependencies: [still], revertOnUpdate: true },
  );

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const scenes = [...node.querySelectorAll<HTMLElement>('[data-chapter]')];
    const links = [...node.querySelectorAll<HTMLAnchorElement>('.estate-index a')];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            const chapter = (entry.target as HTMLElement).dataset.chapter;
            links.forEach((link) => {
              if (link.dataset.chapterLink === chapter)
                link.setAttribute('aria-current', 'location');
              else link.removeAttribute('aria-current');
            });
          }
      },
      { rootMargin: '-25% 0px -45% 0px' },
    );
    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className="estate-journey" data-still={still}>
      {children}
    </div>
  );
}

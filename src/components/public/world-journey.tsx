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
        const inset = () =>
          (document.querySelector('.world-header')?.getBoundingClientRect().height ?? 78) +
          (node.querySelector('.estate-index')?.getBoundingClientRect().height ?? 44);
        for (const scene of node.querySelectorAll<HTMLElement>(
          '.estate-act, .estate-collection, .estate-invitation',
        )) {
          const stage = scene.querySelector<HTMLElement>('.estate-scene-stage');
          const held = () => !!stage && getComputedStyle(stage).position === 'sticky';
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: scene,
              start: () => (held() ? `top ${inset()}` : 'top 88%'),
              end: () => (held() ? `+=${innerHeight * 0.4}` : 'top 38%'),
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
          // Architecture remains stable. Only bounded foreground elements move.
          const copy = scene.querySelector(
            '.estate-scene-copy, .estate-legacy-copy, .estate-collection-heading',
          );
          if (copy) timeline.fromTo(copy, { y: 22 }, { y: 0, duration: 0.6, ease: 'none' }, 0);
          const subject = scene.querySelector('.estate-sculpture, .estate-product-stage');
          if (subject)
            timeline.fromTo(subject, { y: 28 }, { y: -8, duration: 0.65, ease: 'none' }, 0);
          const light = scene.querySelector('.atmosphere-light');
          if (light)
            timeline.fromTo(
              light,
              { opacity: 0.25 },
              { opacity: 0.8, duration: 0.6, ease: 'none' },
              0,
            );
          // The last portion is a composed hold, not an animation that finishes on exit.
          timeline.to({}, { duration: 0.35 });
        }
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
    const bars = [document.querySelector('.world-header'), node.querySelector('.estate-index')];
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = bars.reduce(
          (sum, bar) => sum + (bar?.getBoundingClientRect().height ?? 0),
          0,
        );
        node.style.setProperty('--scene-inset', `${height}px`);
        ScrollTrigger.refresh();
      });
    };
    const observer = new ResizeObserver(measure);
    bars.forEach((bar) => {
      if (bar) observer.observe(bar);
    });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

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

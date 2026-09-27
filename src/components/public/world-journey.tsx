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
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        node.dataset.choreographed = 'true';
        media.add('(min-width: 901px) and (min-height: 721px)', () => {
          const threshold = gsap.timeline({
            scrollTrigger: {
              trigger: '.ascend-threshold',
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
            },
          });
          threshold
            .fromTo(
              '.ascend-depth i',
              { scale: 1.3, opacity: 0 },
              { scale: 1, opacity: 0.6, duration: 0.36, stagger: 0.05, ease: 'none' },
              0,
            )
            .fromTo(
              '.ascend-threshold-mark',
              { scale: 0.45, opacity: 0 },
              { scale: 1, opacity: 0.9, duration: 0.36, ease: 'none' },
              0.22,
            )
            .to(
              '.ascend-threshold-copy',
              { y: -35, opacity: 0.12, duration: 0.26, ease: 'none' },
              0.63,
            )
            .to('.ascend-depth', { scale: 1.24, duration: 0.37, ease: 'none' }, 0.63);
          const man = gsap.timeline({
            scrollTrigger: {
              trigger: '.ascend-man',
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
            },
          });
          man
            .fromTo(
              '.ascend-man-image',
              { scale: 1.08 },
              { scale: 1, duration: 1, ease: 'none' },
              0,
            )
            .fromTo(
              '.ascend-signals span',
              {
                opacity: 0,
                x: 25,
              },
              { opacity: 0.75, x: 0, duration: 0.35, stagger: 0.04, ease: 'none' },
              0.14,
            )
            .fromTo(
              '.ascend-man-resolution',
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 0.22, ease: 'none' },
              0.65,
            )
            .to('.ascend-signals span', { opacity: 0.3, duration: 0.2, ease: 'none' }, 0.72);
          const emergence = gsap.timeline({
            scrollTrigger: {
              trigger: '.ascend-emergence',
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
            },
          });
          emergence
            .fromTo(
              '.ascend-emergence .estate-sculpture',
              { scale: 0.68, opacity: 0.1 },
              { scale: 1, opacity: 1, duration: 0.55, ease: 'none' },
              0,
            )
            .fromTo(
              '.ascend-connections span',
              { opacity: 0, scale: 0.8 },
              { opacity: 1, scale: 1, duration: 0.3, stagger: 0.055, ease: 'none' },
              0.36,
            )
            .fromTo(
              '.ascend-emergence-copy',
              { y: 20, opacity: 0.55 },
              { y: 0, opacity: 1, duration: 0.35, ease: 'none' },
              0.1,
            );
          const system = gsap.timeline({
            scrollTrigger: {
              trigger: '.ascend-system',
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
            },
          });
          system
            .fromTo(
              '.ascend-loop-orbit',
              { rotate: -35, opacity: 0.15 },
              { rotate: 0, opacity: 1, duration: 0.5, ease: 'none' },
              0,
            )
            .fromTo(
              '.ascend-loop-system li',
              { opacity: 0.18, scale: 0.88 },
              { opacity: 1, scale: 1, duration: 0.18, stagger: 0.1, ease: 'none' },
              0.14,
            )
            .fromTo(
              '.ascend-loop-center',
              { opacity: 0.4, scale: 0.8 },
              { opacity: 1, scale: 1, duration: 0.3, ease: 'none' },
              0.48,
            );
          return () => {
            threshold.kill();
            man.kill();
            emergence.kill();
            system.kill();
          };
        });
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

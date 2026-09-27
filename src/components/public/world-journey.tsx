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
        // The narrative belongs to every viewport. Native scrolling drives a bounded
        // sticky composition; the narrow layout changes the framing, not the story.
        media.add('(min-width: 0px)', () => {
          const threshold = gsap.timeline({
            scrollTrigger: {
              trigger: '.ascend-threshold',
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
          threshold
            .fromTo(
              '.ascend-threshold-environment',
              { scale: 1.03, xPercent: 0 },
              { scale: 1.53, xPercent: -4, duration: 1, ease: 'none' },
              0,
            )
            .fromTo(
              '.ascend-threshold-mark',
              { scale: 0.3, opacity: 0 },
              { scale: 1, opacity: 0.95, duration: 0.16, ease: 'none' },
              0.37,
            )
            .to(
              '.ascend-threshold-mark',
              { scale: 3.2, opacity: 0, duration: 0.28, ease: 'none' },
              0.54,
            )
            .to(
              '.ascend-threshold-copy',
              { y: -60, opacity: 0, duration: 0.17, ease: 'none' },
              0.18,
            )
            .fromTo(
              '.ascend-threshold-bloom',
              { opacity: 0, scale: 0.45 },
              { opacity: 0.8, scale: 1.7, duration: 0.31, ease: 'none' },
              0.66,
            )
            .fromTo(
              '.ascend-threshold-veil',
              { opacity: 0.78 },
              { opacity: 0.45, duration: 0.7, ease: 'none' },
              0,
            );
          threshold.fromTo(
            '.ascend-light',
            { scale: 0.3, opacity: 0.35 },
            { scale: 2.3, opacity: 0.85, duration: 0.8, ease: 'none' },
            0.12,
          );
          const man = gsap.timeline({
            scrollTrigger: {
              trigger: '.ascend-man',
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
          man
            .fromTo(
              '.ascend-man-wide',
              { scale: 1.16 },
              { scale: 1.02, duration: 0.4, ease: 'none' },
              0,
            )
            .fromTo(
              '.ascend-man-portrait',
              { opacity: 0, scale: 1.2, xPercent: 5 },
              { opacity: 1, scale: 1.04, xPercent: 0, duration: 0.2, ease: 'none' },
              0.26,
            )
            .fromTo(
              '.ascend-man-burden',
              { opacity: 0, y: 50 },
              { opacity: 1, y: 0, duration: 0.16, ease: 'none' },
              0.38,
            )
            .to('.ascend-man-opening', { opacity: 0, y: -55, duration: 0.12, ease: 'none' }, 0.22)
            .to('.ascend-man-burden', { opacity: 0, y: -40, duration: 0.12, ease: 'none' }, 0.59)
            .fromTo(
              '.ascend-man-decision',
              { opacity: 0, scale: 1.19, xPercent: -5 },
              { opacity: 1, scale: 1, xPercent: 0, duration: 0.18, ease: 'none' },
              0.64,
            )
            .fromTo(
              '.ascend-man-choice',
              { opacity: 0, y: 45 },
              { opacity: 1, y: 0, duration: 0.13, ease: 'none' },
              0.79,
            )
            .fromTo(
              '.ascend-man-edge',
              { opacity: 0, scaleY: 0.2 },
              { opacity: 0.8, scaleY: 1, duration: 0.25, ease: 'none' },
              0.68,
            )
            .to({}, { duration: 0.13 }, 0.92);
          const emergence = gsap.timeline({
            scrollTrigger: {
              trigger: '.ascend-emergence',
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
              invalidateOnRefresh: true,
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
            )
            .fromTo(
              '.ascend-intelligence-field',
              { scale: 0.62, opacity: 0.2 },
              { scale: 1, opacity: 1, duration: 0.6, ease: 'none' },
              0.05,
            );
          return () => {
            threshold.kill();
            man.kill();
            emergence.kill();
          };
        });
        for (const scene of node.querySelectorAll<HTMLElement>(
          '.estate-act, .estate-collection, .reserve-world, .collective-world, .estate-invitation',
        )) {
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: scene,
              start: 'top 88%',
              end: 'top 38%',
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
          // Architecture remains stable. Only bounded foreground elements move.
          const copy = scene.querySelector(
            '.estate-scene-copy, .estate-legacy-copy, .estate-collection-heading, .reserve-world-copy, .collective-world-copy',
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

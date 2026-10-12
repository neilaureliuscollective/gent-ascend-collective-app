'use client';
import { useEffect, useRef, type RefObject } from 'react';
export function useTalkViewport(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (!root.current) return;
      // Do not interfere with accessibility zoom. Keyboard height is progressive enhancement.
      const useVisual = viewport && viewport.scale === 1;
      root.current.style.setProperty(
        '--conversation-height',
        `${useVisual ? viewport.height : window.innerHeight}px`,
      );
      root.current.style.setProperty(
        '--conversation-top',
        `${useVisual ? viewport.offsetTop : 0}px`,
      );
    };
    let frame: number | null = null;
    const schedule = () => {
      if (frame === null)
        frame = requestAnimationFrame(() => {
          frame = null;
          resize();
        });
    };
    resize();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [root]);
}
export function ConversationViewport({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useTalkViewport(root);
  return (
    <div ref={root} className="aethelios-page talk-page">
      {children}
    </div>
  );
}

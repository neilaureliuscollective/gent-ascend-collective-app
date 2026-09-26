'use client';
import { useEffect, useRef } from 'react';
export function ConversationViewport({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
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
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <div ref={root} className="aethelios-page">
      {children}
    </div>
  );
}

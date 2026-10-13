'use client';
import { useEffect, useRef, type RefObject } from 'react';
export function useTalkViewport(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const viewport = window.visualViewport;
    let restingHeight = window.innerHeight;
    let restingWidth = window.innerWidth;
    const resize = () => {
      // Do not interfere with accessibility zoom. Keyboard height is progressive enhancement.
      const useVisual = viewport && viewport.scale === 1;
      const active = document.activeElement;
      // Progressive heuristic, not a VirtualKeyboard API dependency. Browser chrome alone
      // must not hide navigation; require a focused editor and a substantial visual shrink.
      const editing =
        active instanceof HTMLElement &&
        node.contains(active) &&
        active.matches(
          'textarea, input:not([type="checkbox"]):not([type="radio"]), [contenteditable="true"]',
        );
      if (!editing || Math.abs(window.innerWidth - restingWidth) > 80) {
        restingHeight = window.innerHeight;
        restingWidth = window.innerWidth;
      }
      const keyboardOpen = !!(
        editing &&
        ((useVisual && window.innerHeight - viewport.height > 80) ||
          restingHeight - window.innerHeight > 80)
      );
      node.setAttribute('data-keyboard', keyboardOpen ? 'open' : 'closed');
      if (keyboardOpen) node.style.setProperty('--interaction-nav-space', '0px');
      else node.style.removeProperty('--interaction-nav-space');
      node.style.setProperty(
        '--conversation-height',
        `${useVisual ? viewport.height : window.innerHeight}px`,
      );
      node.style.setProperty('--conversation-top', `${useVisual ? viewport.offsetTop : 0}px`);
      node.dispatchEvent(new Event('talk-viewport'));
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
    node.addEventListener('focusin', schedule);
    node.addEventListener('focusout', schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      node.removeEventListener('focusin', schedule);
      node.removeEventListener('focusout', schedule);
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

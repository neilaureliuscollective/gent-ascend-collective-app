'use client';
import { useEffect, useRef, type RefObject } from 'react';
type Anchor = { id: string; offset: number } | null;
function capture(node: HTMLDivElement, following: boolean): Anchor {
  if (following) return null;
  const top = node.getBoundingClientRect().top;
  const row = [...node.querySelectorAll<HTMLElement>('[data-turn-id]')].find(
    (item) => item.getBoundingClientRect().bottom > top,
  );
  return row?.dataset.turnId
    ? { id: row.dataset.turnId, offset: row.getBoundingClientRect().top - top }
    : null;
}
/** Keep the same saved message/offset through width and keyboard reflow while reading history. */
export function useReadingAnchor(
  root: RefObject<HTMLDivElement | null>,
  followRef: RefObject<boolean>,
  ready: boolean,
) {
  const anchor = useRef<Anchor>(null);
  const size = useRef({ width: 0, height: 0, scrollHeight: 0 });
  function remember() {
    const node = root.current;
    if (!node) return followRef.current;
    if (node.clientWidth !== size.current.width || node.clientHeight !== size.current.height) {
      // Reflow can move the bottom without a reading gesture. A deliberate jump far
      // beyond that geometry change still leaves follow mode immediately.
      const reflow =
        Math.abs(node.clientHeight - size.current.height) +
        Math.abs(node.scrollHeight - size.current.scrollHeight);
      if (
        !followRef.current ||
        node.scrollHeight - node.scrollTop - node.clientHeight <= reflow + 24
      )
        return followRef.current;
    }
    followRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
    anchor.current = capture(node, followRef.current);
    return followRef.current;
  }
  useEffect(() => {
    const node = root.current;
    if (!node || !ready) return;
    size.current = {
      width: node.clientWidth,
      height: node.clientHeight,
      scrollHeight: node.scrollHeight,
    };
    let frame = 0;
    const restore = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const saved = anchor.current;
        if (!followRef.current && saved) {
          const row = [...node.querySelectorAll<HTMLElement>('[data-turn-id]')].find(
            (item) => item.dataset.turnId === saved.id,
          );
          if (row)
            node.scrollTop +=
              row.getBoundingClientRect().top - node.getBoundingClientRect().top - saved.offset;
        } else if (followRef.current) node.scrollTop = node.scrollHeight;
        size.current = {
          width: node.clientWidth,
          height: node.clientHeight,
          scrollHeight: node.scrollHeight,
        };
        anchor.current = capture(node, followRef.current);
      });
    };
    const observer = new ResizeObserver(restore);
    const observeContent = () => {
      observer.disconnect();
      observer.observe(node);
      node.querySelectorAll<HTMLElement>('[data-turn-id]').forEach((row) => observer.observe(row));
      restore();
    };
    // Streamed text, lazy images and artifact insertion can grow a row without resizing the viewport.
    const mutations = new MutationObserver(observeContent);
    mutations.observe(node, { childList: true, subtree: true });
    observeContent();
    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [root, followRef, ready]);
  return remember;
}

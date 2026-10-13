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
  follow: RefObject<boolean>,
  ready: boolean,
) {
  const anchor = useRef<Anchor>(null);
  const size = useRef({ width: 0, height: 0 });
  function remember() {
    const node = root.current;
    if (!node) return;
    if (node.clientWidth !== size.current.width || node.clientHeight !== size.current.height)
      return;
    anchor.current = capture(node, follow.current);
  }
  useEffect(() => {
    const node = root.current;
    if (!node || !ready) return;
    size.current = { width: node.clientWidth, height: node.clientHeight };
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === size.current.width && node.clientHeight === size.current.height)
        return;
      const saved = anchor.current;
      if (!follow.current && saved) {
        const row = [...node.querySelectorAll<HTMLElement>('[data-turn-id]')].find(
          (item) => item.dataset.turnId === saved.id,
        );
        if (row)
          node.scrollTop +=
            row.getBoundingClientRect().top - node.getBoundingClientRect().top - saved.offset;
      } else if (follow.current) node.scrollTop = node.scrollHeight;
      size.current = { width: node.clientWidth, height: node.clientHeight };
      anchor.current = capture(node, follow.current);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root, follow, ready]);
  return remember;
}

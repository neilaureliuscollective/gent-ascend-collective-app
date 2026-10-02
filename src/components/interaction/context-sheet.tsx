'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
/** Native modality with retained children: closing pauses drafts rather than discarding them. */
export function ContextSheet({
  open,
  title,
  busy = false,
  fullScreen = false,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  busy?: boolean;
  fullScreen?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    id = useId();
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current,
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null,
      overflow = document.documentElement.style.overflow;
    const viewport = window.visualViewport;
    const size = () => {
      const visual = viewport?.scale === 1;
      dialog.style.setProperty('--task-height', `${visual ? viewport!.height : innerHeight}px`);
      dialog.style.setProperty('--task-top', `${visual ? viewport!.offsetTop : 0}px`);
    };
    size();
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    heading.current?.focus();
    viewport?.addEventListener('resize', size);
    viewport?.addEventListener('scroll', size);
    window.addEventListener('resize', size);
    return () => {
      dialog.close();
      document.documentElement.style.overflow = overflow;
      viewport?.removeEventListener('resize', size);
      viewport?.removeEventListener('scroll', size);
      window.removeEventListener('resize', size);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <dialog
      className={`context-sheet${fullScreen ? ' context-sheet-full' : ''}`}
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length > 0 && !el.closest('fieldset:disabled'));
        const first = controls[0],
          last = controls.at(-1);
        if (!first) {
          e.preventDefault();
          heading.current?.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="context-sheet-surface">
        <header>
          <h2 tabIndex={-1} ref={heading} id={id}>
            {title}
          </h2>
          <button type="button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>
        <div className="context-sheet-body">{children}</div>
      </div>
    </dialog>
  );
}

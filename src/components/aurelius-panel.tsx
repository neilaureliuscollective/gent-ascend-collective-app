'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AureliusPresence } from './visual/aurelius-presence';
const Workspace = dynamic(
  () => import('./aurelius/workspace').then((module) => module.AureliusWorkspace),
  { loading: () => <p role="status">Opening Aurelius…</p>, ssr: false },
);
export function AureliusPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    dialog.current?.close();
  }, [path]);
  if (path === '/aurelius')
    return (
      <Link className="aurelius-trigger is-current" href="/aurelius" aria-current="page">
        <AureliusPresence />
        <span>Aurelius</span>
      </Link>
    );
  return (
    <>
      <button
        className="aurelius-trigger"
        ref={trigger}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-haspopup="dialog"
      >
        <AureliusPresence />
        <span>Aurelius</span>
      </button>
      <dialog
        ref={dialog}
        className="aurelius-dialog live-dialog"
        aria-labelledby="aurelius-title"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        <div className="dialog-top">
          <h2 id="aurelius-title">Aurelius</h2>
          <Link href="/aurelius" onClick={() => dialog.current?.close()}>
            Open full space ↗
          </Link>
          <button aria-label="Close Aurelius" onClick={() => dialog.current?.close()}>
            ×
          </button>
        </div>
        {open && <Workspace compact />}
      </dialog>
    </>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AureliusPresence } from './visual/aurelius-presence';
const Workspace = dynamic(
  () => import('./aurelius/workspace').then((module) => module.AureliusWorkspace),
  { loading: () => <p role="status">Opening Aethelios…</p>, ssr: false },
);
export function AureliusPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    dialog.current?.close();
  }, [path]);
  if (path === '/app/aethelios')
    return (
      <Link className="aurelius-trigger is-current" href="/app/aethelios" aria-current="page">
        <AureliusPresence />
        <span>Aethelios</span>
      </Link>
    );
  return (
    <>
      <button
        className="aurelius-trigger"
        ref={trigger}
        onClick={() => {
          if (window.matchMedia('(max-width: 1100px)').matches) { router.push('/app/aethelios'); return; }
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-haspopup="dialog"
      >
        <AureliusPresence />
        <span>Aethelios</span>
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
          <h2 id="aurelius-title">Aethelios</h2>
          <Link href="/app/aethelios" onClick={() => dialog.current?.close()}>
            Open full space ↗
          </Link>
          <button aria-label="Close Aethelios" onClick={() => dialog.current?.close()}>
            ×
          </button>
        </div>
        {open && <Workspace compact />}
      </dialog>
    </>
  );
}

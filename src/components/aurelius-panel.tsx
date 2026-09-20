'use client';
import { useRef } from 'react';
import { usePathname } from 'next/navigation';
export function AureliusPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  return (
    <>
      <button
        className="aurelius-trigger"
        ref={trigger}
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
      >
        <span className="orb" aria-hidden="true" />
        <span>Aurelius</span>
        <span aria-hidden="true">↗</span>
      </button>
      <dialog
        ref={dialog}
        className="aurelius-dialog"
        aria-labelledby="aurelius-title"
        onClose={() => trigger.current?.focus()}
      >
        <div className="dialog-top">
          <span className="eyebrow">Your intelligence</span>
          <button aria-label="Close Aurelius" onClick={() => dialog.current?.close()}>
            ×
          </button>
        </div>
        <span className="orb large" aria-hidden="true" />
        <h2 id="aurelius-title">Aurelius</h2>
        <p>
          One perspective.
          <br />
          Your whole world.
        </p>
        <div className="panel">
          <span className="eyebrow">Foundation preview</span>
          <p>Your personal intelligence will connect your goals, routines and progress here.</p>
          <p className="muted">
            AI conversations are not active yet. No personal data has been sent to a model.
          </p>
        </div>
        <small>Current space: {path === '/' ? 'Command' : path.slice(1)}</small>
      </dialog>
    </>
  );
}

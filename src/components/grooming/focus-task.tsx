'use client';
import { useState, type ReactNode } from 'react';
import { ContextSheet } from '@/components/interaction/context-sheet';
/** Secondary configuration stays out of the world until requested. */
export function GroomingTask({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        {title}
      </button>
      <ContextSheet title={title} open={open} onClose={() => setOpen(false)}>
        {children}
      </ContextSheet>
    </>
  );
}

'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { AppearanceControls } from '@/components/visual/appearance';
import { ContextSheet } from '@/components/interaction/context-sheet';
export type CapabilityItem = { title: string; href: string; status: string };
export function CapabilityMenu({ items }: { items: CapabilityItem[] }) {
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = items.filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="capability-menu" onKeyDownCapture={event => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}><button type="button" className="text-button" onClick={() => setOpen(true)} aria-haspopup="dialog">Capabilities</button><ContextSheet open={open} title="Capabilities" onClose={() => setOpen(false)}>
    <AppearanceControls />
    <label htmlFor={searchId}>Find a capability</label><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Create, Presence, Performance…" />
    <nav aria-label="Capabilities" className="capability-links">{filtered.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.title}<small>{item.status}</small></Link>)}</nav>
    {!filtered.length && <p>No capability matches that name.</p>}<p>Council specialists are inside Aethelios. Creation allowances follow your existing account.</p>
  </ContextSheet></div>;
}

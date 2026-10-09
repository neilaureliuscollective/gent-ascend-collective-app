'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { brand } from '@/platform/brand';
import { Icon } from '@/components/visual/icon';
const links = [
  ['/app/aethelios', 'Talk'],
  ['/app/work', 'Company work'],
  ['/app/studio', 'Studio'],
] as const;
export function WorldHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  return (
    <header className="world-header">
      <Link
        href="/"
        className="world-wordmark"
        aria-label="Aethelios home"
        onClick={() => setOpen(false)}
      >
        <Image src={brand.crest} alt="" width={48} height={48} />
        <span>
          AETHELIOS<small>PERSONAL INTELLIGENCE OS</small>
        </span>
      </Link>
      <button
        ref={toggle}
        className="world-menu-toggle"
        aria-expanded={open}
        aria-controls="world-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? 'Close' : 'Explore'} <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <nav
        id="world-navigation"
        aria-label="Public navigation"
        className={open ? 'world-nav is-open' : 'world-nav'}
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href || path.startsWith(href + '/') ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
        <Link className="world-enter" href="/enter" onClick={() => setOpen(false)}>
          Open Aethelios <Icon name="arrow" />
        </Link>
      </nav>
    </header>
  );
}

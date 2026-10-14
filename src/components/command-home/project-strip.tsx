'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { sourceLabel, type CommandItem } from '@/domains/command-home/model';

export function CommandProjects({
  items,
  selectedKey,
  onSelect,
}: {
  items: CommandItem[];
  selectedKey: string | null;
  onSelect: (item: CommandItem) => void;
}) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.detail.toLowerCase().includes(needle) ||
        sourceLabel(item.source).toLowerCase().includes(needle),
    );
  }, [items, query]);

  if (!items.length) {
    return (
      <section className="command-library" aria-label="Other projects">
        <p>No other saved projects yet.</p>
        <nav className="command-library-links" aria-label="All projects">
          <Link href="/app/architect">Architect</Link>
          <Link href="/app/work">Work</Link>
          <Link href="/app/studio">Studio</Link>
        </nav>
      </section>
    );
  }

  return (
    <section className="command-library" aria-label="Other projects">
      <header>
        <h2>Other work</h2>
        <label className="command-search">
          <span className="sr-only">Search saved work</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search saved work"
          />
        </label>
      </header>
      <ul>
        {visible.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={item.key === selectedKey}
              onClick={() => onSelect(item)}
            >
              <span>{sourceLabel(item.source)}</span>
              <strong>{item.title}</strong>
            </button>
          </li>
        ))}
      </ul>
      {!visible.length && <p role="status">No saved work matches that search.</p>}
      <nav className="command-library-links" aria-label="All projects">
        <Link href="/app/architect">All Architect projects</Link>
        <Link href="/app/work">All company work</Link>
        <Link href="/app/studio">All Studio projects</Link>
      </nav>
    </section>
  );
}

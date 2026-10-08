'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { readSavedWork } from '@/domains/workspace/service';
type Data = Awaited<ReturnType<typeof readSavedWork>>;
export function SavedWork({ missionsOnly = false }: { missionsOnly?: boolean }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('All');
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/workspace', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData(result);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Saved work unavailable.');
      }
    })();
    return () => controller.abort();
  }, []);
  const items = (data?.items ?? []).filter(
    (item) =>
      (!missionsOnly || item.kind === 'Mission') &&
      (kind === 'All' || item.kind === kind) &&
      `${item.title} ${item.scope} ${item.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section
      className="company-rooms"
      aria-label={missionsOnly ? 'Your personal Missions' : 'Saved work finder'}
    >
      <h2>{missionsOnly ? 'Your personal Missions' : 'Saved work'}</h2>
      <p>
        {missionsOnly
          ? 'Keep a personal project moving with its reviewed direction and next action.'
          : 'Find saved conversations, documents and visual projects. Personal and company records retain their own context boundaries.'}
      </p>
      <div className="company-work-links">
        <Link href="/app/missions">{missionsOnly ? 'All Missions' : 'Missions'}</Link>
        <Link href="/app/missions/deliverables">Saved deliverables</Link>
        {missionsOnly && <Link href="/app/library">All saved work</Link>}
      </div>
      {!missionsOnly && (
        <>
          <label>
            Find saved work
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            Work type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {['All', 'Mission', 'Document', 'Conversation', 'Visual project', 'Company work'].map(
                (k) => (
                  <option key={k}>{k}</option>
                ),
              )}
            </select>
          </label>
        </>
      )}
      {error ? (
        <p role="alert">
          {error} <Link href="/enter">Sign in</Link> or reload this page.
        </p>
      ) : !data ? (
        <p role="status">Loading saved work…</p>
      ) : !items.length ? (
        <p>
          {query
            ? 'No matching saved work.'
            : 'Start in Talk and save meaningful work as a Mission.'}
        </p>
      ) : (
        <div className="company-job-list">
          {items.slice(0, missionsOnly ? 6 : 100).map((item) => (
            <Link className="company-job" key={`${item.kind}:${item.id}`} href={item.href}>
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.kind} · {item.scope}
                </p>
                <p>{item.detail}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      )}
      {!missionsOnly && (
        <p className="quiet-label">
          Shows up to 100 matches from recent saved records. Full conversation, Studio and
          deliverable histories remain available in their workspaces. Opening work never sends an AI
          request.
        </p>
      )}
    </section>
  );
}

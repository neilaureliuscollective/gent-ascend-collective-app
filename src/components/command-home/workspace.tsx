'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FOCUS_PARAM, type CommandHomeData, type CommandItem } from '@/domains/command-home/model';
import { CommandArtifactStage } from './artifact-stage';
import { CommandAttention } from './attention';
import { CommandConversation } from './conversation-entry';
import { CommandProjects } from './project-strip';

export function CommandHome({
  initial,
  founderOffice = false,
  signedOut = false,
  message,
}: {
  initial?: CommandHomeData;
  founderOffice?: boolean;
  signedOut?: boolean;
  message?: string;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(message ?? '');
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const ownerId = data?.ownerId ?? '';

  const writeFocus = useCallback((key: string | null) => {
    const url = new URL(location.href);
    if (key) url.searchParams.set(FOCUS_PARAM, key);
    else url.searchParams.delete(FOCUS_PARAM);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);

  const load = useCallback(
    async (focus: string | null, previous: string | null) => {
      const generation = ++request.current;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (focus) params.set('focus', focus);
        if (previous) params.set('previous', previous);
        const response = await fetch(`/api/command-home?${params}`, { cache: 'no-store' });
        const result = (await response.json()) as CommandHomeData & { error?: string };
        if (generation !== request.current) return;
        if (!response.ok) throw new Error(result.error ?? 'Command could not load your saved work.');
        if (ownerId && result.ownerId && result.ownerId !== ownerId) {
          setError('This account changed. Reload Command before continuing.');
          return;
        }
        setData(result);
        setError('');
        writeFocus(result.selectedKey);
      } catch (caught) {
        if (generation !== request.current) return;
        setError(caught instanceof Error ? caught.message : 'Command could not load your saved work.');
      } finally {
        if (generation === request.current) setLoading(false);
      }
    },
    [ownerId, writeFocus],
  );

  useEffect(() => {
    const onPop = () => {
      const focus = new URL(location.href).searchParams.get(FOCUS_PARAM);
      void load(focus, data?.selectedKey ?? null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [data?.selectedKey, load]);

  const select = (item: CommandItem) => {
    if (item.key === data?.selectedKey) return;
    writeFocus(item.key);
    void load(item.key, data?.selectedKey ?? null);
  };

  const selected = data?.selected ?? null;

  return (
    <div className="command-continuity">
      <header className="command-heading">
        <p className="eyebrow">AETHELIOS / HOME</p>
        <h1>Command</h1>
        <p className="command-orientation">
          {signedOut
            ? 'Sign in to see your saved work. Command never invents activity to feel alive.'
            : data?.orientation.line}
          {data?.orientation.freshness ? ` ${data.orientation.freshness}.` : ''}
        </p>
        {loading && (
          <p role="status" className="command-status">
            Updating saved work…
          </p>
        )}
        {error && (
          <p role="alert" className="command-status">
            {error}
          </p>
        )}
      </header>
      <div className="command-layout">
        <CommandArtifactStage selected={selected} artifact={data?.artifact ?? unsignedArtifact()} />
        <aside className="command-context">
          <CommandConversation
            ownerId={ownerId}
            selected={selected}
            recent={data?.recentConversation ?? null}
            signedOut={signedOut}
          />
          <CommandAttention items={data?.attention ?? []} />
          {(founderOffice || data?.founderOffice) && (
            <section className="command-founder" aria-label="Founder operations">
              <p className="eyebrow">Private founder operations</p>
              <p>
                Platform status, Connections and consequential approvals stay in Founder Office.
                Command does not open those records.
              </p>
              <nav>
                <Link href="/app/founder">Founder Office</Link>
                <Link href="/app/founder/connections">Connections</Link>
              </nav>
            </section>
          )}
        </aside>
      </div>
      <CommandProjects
        items={data?.items.filter((item) => item.key !== selected?.key) ?? []}
        selectedKey={selected?.key ?? null}
        onSelect={select}
      />
      {data?.sources.some((source) => source.state !== 'ready') && (
        <ul className="command-sources" aria-label="Source availability">
          {data.sources
            .filter((source) => source.state !== 'ready')
            .map((source) => (
              <li key={source.id}>
                {source.message}{' '}
                {source.id === 'architect' && <Link href="/app/architect">Open Architect</Link>}
                {source.id === 'studio' && <Link href="/app/studio">Open Studio</Link>}
                {source.id === 'work' && <Link href="/app/work">Open Work</Link>}
                {source.id === 'talk' && <Link href="/app/aethelios">Open Talk</Link>}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function unsignedArtifact() {
  return {
    kind: 'none' as const,
    title: 'Your work will appear here',
    excerpt: '',
    imageHref: null,
    htmlPreview: null,
    fallback: 'Sign in to load saved projects, documents and images you already own.',
    provenance: 'No account session',
  };
}

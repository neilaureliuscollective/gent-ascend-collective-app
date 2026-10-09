'use client';
import { useState } from 'react';
import { consumeReply } from '@/domains/intelligence/consume';
import type { WebsiteSource } from '@/domains/business-connections/website-schema';
export function WebsiteEditor({ connectionId }: { connectionId: string }) {
  const [source, setSource] = useState<WebsiteSource | null>(null),
    [headline, setHeadline] = useState(''),
    [about, setAbout] = useState(''),
    [services, setServices] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [prompt, setPrompt] = useState(''),
    [consent, setConsent] = useState(false),
    [reply, setReply] = useState(''),
    [saved, setSaved] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [proposalKey, setProposalKey] = useState(''),
    [writeUncertain, setWriteUncertain] = useState(false);
  const changed = () => {
    setProposalKey('');
    setNotice('');
  };
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Website unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    await run(async () => {
      const r = await fetch('/api/business-connections/website?id=' + connectionId, {
          cache: 'no-store',
        }),
        v = await r.json();
      if (!r.ok) throw Error(v.error);
      setSource(v.source);
      setHeadline(v.source.content.headline);
      setAbout(v.source.content.about);
      setServices(
        Object.fromEntries(
          v.source.services.map((s: { id: string; description: string }) => [s.id, s.description]),
        ),
      );
      setWriteUncertain(false);
      changed();
      setUncertain(false);
      setSaved(false);
      setReply('');
    });
  }
  async function ask() {
    await run(async () => {
      setReply('');
      setSaved(false);
      setConsent(false);
      setUncertain(true);
      const r = await fetch('/api/business-connections/ask-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          conversationId: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          text: prompt,
          consent: true,
        }),
      });
      if (!r.ok) {
        const v = await r.json();
        throw Error(v.error);
      }
      await consumeReply(r, (event) => {
        if (event.type === 'delta') setReply((v) => v + event.text);
        if (event.type === 'saved') {
          setSaved(true);
          setUncertain(false);
        }
        if (event.type === 'error') throw Error(event.message);
      });
    });
  }
  async function propose() {
    await run(async () => {
      if (!source) return;
      const requestId = proposalKey || crypto.randomUUID();
      setProposalKey(requestId);
      setWriteUncertain(true);
      const r = await fetch('/api/business-connections/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          requestId,
          websiteId: source.websiteId,
          baseRevision: source.revision,
          content: { headline, about },
          serviceChanges: source.services
            .filter((s) => services[s.id] !== s.description)
            .map((s) => ({ id: s.id, baseRevision: s.revision, description: services[s.id] })),
        }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      setWriteUncertain(false);
      setNotice('Proposal saved for review. Public website unchanged. Proposal ' + v.id);
      setProposalKey('');
      await load();
      setNotice('Proposal saved for review. Public website unchanged. Proposal ' + v.id);
    });
  }
  return (
    <article>
      <h2>Fix It Shop · Website</h2>
      <p>
        Edit the registered text fields. Each proposal requires approval in Legacy Reserve Studio
        before publication.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Load current website copy
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {source && (
        <>
          <p>
            Source version {source.revision} · Retrieved{' '}
            {new Date(source.fetchedAt).toLocaleString()}
          </p>
          <label>
            Headline
            <input
              disabled={busy || writeUncertain}
              maxLength={120}
              value={headline}
              onChange={(e) => {
                changed();
                setHeadline(e.target.value);
              }}
            />
          </label>
          <label>
            About Fix It Shop
            <textarea
              disabled={busy || writeUncertain}
              maxLength={1200}
              value={about}
              onChange={(e) => {
                changed();
                setAbout(e.target.value);
              }}
            />
          </label>
          {source.services.map((s) => (
            <label key={s.id}>
              {s.name} · Description
              <textarea
                disabled={busy || writeUncertain}
                maxLength={600}
                value={services[s.id] ?? ''}
                onChange={(e) => {
                  changed();
                  setServices((v) => ({ ...v, [s.id]: e.target.value }));
                }}
              />
            </label>
          ))}
          <button
            disabled={busy || writeUncertain || !headline.trim() || !about.trim()}
            onClick={() => void propose()}
          >
            Save proposal for approval
          </button>
          {writeUncertain && (
            <p role="status">
              Save unconfirmed. Load the current copy and check proposal receipts before preparing
              another change.
            </p>
          )}
          <h3>Prepare wording with Aethelios</h3>
          <label>
            Writing request
            <textarea
              disabled={busy || uncertain}
              maxLength={3000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <label>
            <input
              style={{ width: 'auto' }}
              disabled={busy || uncertain}
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Allow current published website copy, service descriptions and this company room’s
            history to be sent for this reply.
          </label>
          <button
            disabled={busy || uncertain || !consent || !prompt.trim()}
            onClick={() => void ask()}
          >
            Prepare website wording
          </button>
          {reply && <pre>{reply}</pre>}
          {saved && (
            <p role="status">
              Draft reply saved in your company room. Review and copy the wording you want into the
              editable fields above.
            </p>
          )}
          {uncertain && !busy && (
            <p>Reply unconfirmed. Check your company room before trying again.</p>
          )}
          <h3>Recent proposals</h3>
          {source.proposals.length ? (
            <ul>
              {source.proposals.map((p) => (
                <li key={p.id}>
                  {p.id} · {p.state}
                </li>
              ))}
            </ul>
          ) : (
            <p>No proposals for this connection.</p>
          )}
        </>
      )}
    </article>
  );
}

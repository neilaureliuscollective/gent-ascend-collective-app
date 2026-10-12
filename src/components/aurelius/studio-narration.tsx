'use client';
import { useEffect, useRef, useState } from 'react';
import type { NarrationRecord } from '@/domains/studio/narration';
import { downloadStudio } from './studio-download';
type Item = Pick<
  NarrationRecord,
  'id' | 'title' | 'script' | 'voice' | 'tone' | 'status' | 'duration' | 'created_at' | 'model'
>;
type Workspace = { available: boolean; enabled: boolean; canCreate: boolean; items: Item[] };
export function StudioNarration({
  projectId,
  scenes,
  onUse,
}: {
  projectId: string;
  scenes: { position: number; message: string }[];
  onUse: (id: string) => void;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [title, setTitle] = useState('Campaign narration'),
    [script, setScript] = useState(''),
    [voice, setVoice] = useState<'alloy' | 'ash' | 'coral'>('alloy'),
    [tone, setTone] = useState<'clear' | 'calm' | 'confident'>('clear'),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState<string | null>(null);
  const alive = useRef(true),
    submitted = useRef(false);
  async function refresh(requestId?: string) {
    const response = await fetch(`/api/studio/narration?project=${projectId}`, {
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Narrations could not be opened.');
    if (alive.current) {
      setData(result);
      if (
        requestId &&
        result.items.some((item: Item) => item.id === requestId && item.status !== 'pending')
      )
        setUncertain(null);
    }
  }
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    fetch(`/api/studio/narration?project=${projectId}`, {
      cache: 'no-store',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'Narrations could not be opened.');
        if (alive.current) setData(value);
      })
      .catch((cause) => {
        if (alive.current && !controller.signal.aborted) setError(cause.message);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [projectId]);
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (
      submitted.current ||
      busy ||
      !approved ||
      !data?.enabled ||
      !data.canCreate ||
      uncertain ||
      data.items.some((item) => item.status === 'pending')
    )
      return;
    submitted.current = true;
    setBusy(true);
    setError('');
    const id = crypto.randomUUID();
    try {
      const response = await fetch('/api/studio/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, projectId, title, script, voice, tone, approved: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Narration could not be saved.');
      if (alive.current) setApproved(false);
      await refresh(id);
    } catch (cause) {
      if (alive.current) {
        setError((cause as Error).message);
        setUncertain(id);
      }
      try {
        await refresh(id);
      } catch {
        /* Keep the uncertain request locked until its receipt can be read. */
      }
    } finally {
      submitted.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function recover(id: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/studio/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover', id, projectId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Recovery could not be confirmed.');
      await refresh(id);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/studio/narration/audio?id=${id}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('This narration could not be downloaded.');
      downloadStudio(await response.blob(), 'aethelios-ai-narration.wav');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="studio-narration-room studio-motion-room" aria-label="Narration production">
      <p className="eyebrow">THE NARRATION ROOM</p>
      <h3>A voice for the story.</h3>
      <p>
        Write a short script, choose its delivery, then create a private voiceover. These are
        AI-generated voices. Listen and review before sharing; disclose their synthetic origin to
        your audience.
      </p>
      {!data && !error && <p role="status">Opening saved narrations…</p>}
      {data && (!data.available || !data.enabled) && (
        <p className="studio-notice">
          AI narration generation is awaiting activation. You can prepare and export a script now.
        </p>
      )}
      {data && !data.canCreate && data.enabled && (
        <p className="studio-notice">Narration creation requires eligible Studio access.</p>
      )}
      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={generate}>
        <div className="studio-motion-controls">
          <label>
            Clip title
            <input
              aria-label="Clip title"
              value={title}
              maxLength={80}
              required
              disabled={busy}
              onChange={(e) => {
                setTitle(e.target.value);
                setApproved(false);
              }}
            />
          </label>
          <label>
            Voice
            <select
              aria-label="Narration voice"
              value={voice}
              disabled={busy}
              onChange={(e) => {
                setVoice(e.target.value as typeof voice);
                setApproved(false);
              }}
            >
              <option value="alloy">Alloy</option>
              <option value="ash">Ash</option>
              <option value="coral">Coral</option>
            </select>
          </label>
          <label>
            Delivery
            <select
              aria-label="Narration delivery"
              value={tone}
              disabled={busy}
              onChange={(e) => {
                setTone(e.target.value as typeof tone);
                setApproved(false);
              }}
            >
              <option value="clear">Clear</option>
              <option value="calm">Calm</option>
              <option value="confident">Confident</option>
            </select>
          </label>
        </div>
        <label className="studio-narration-script">
          Narration script
          <textarea
            aria-label="Narration script"
            value={script}
            maxLength={600}
            minLength={3}
            required
            rows={6}
            disabled={busy}
            onChange={(e) => {
              setScript(e.target.value);
              setApproved(false);
            }}
            placeholder="The words you want your audience to hear…"
          />
        </label>
        <p className="muted">
          {script.length} / 600 characters · one clip per request · up to one minute · three
          generation attempts per rolling day. Each attempt uses your Studio allowance, including
          failed attempts. No automatic retries.
        </p>
        <button
          type="button"
          disabled={busy || !scenes.some((s) => s.message)}
          onClick={() => {
            const prepared = [...scenes]
              .sort((a, b) => a.position - b.position)
              .map((s) => s.message)
              .filter(Boolean)
              .join(' ');
            if (prepared.length > 600) {
              setError(
                'Campaign copy exceeds 600 characters. Write a shorter reviewed narration script.',
              );
              return;
            }
            setScript(prepared);
            setError('');
            setApproved(false);
          }}
        >
          Prepare from campaign copy
        </button>
        <label className="studio-narration-approval">
          <input
            type="checkbox"
            checked={approved}
            disabled={busy}
            onChange={(e) => setApproved(e.target.checked)}
          />
          I approve this script and authorize one AI narration request.
        </label>
        <div className="studio-finish-actions">
          <button
            type="submit"
            className="button"
            disabled={
              busy ||
              !data?.enabled ||
              !data.canCreate ||
              !approved ||
              script.trim().length < 3 ||
              !title.trim() ||
              Boolean(uncertain) ||
              data.items.some((item) => item.status === 'pending')
            }
          >
            {busy ? 'Working…' : 'Generate approved narration'}
          </button>
          <button
            type="button"
            disabled={busy || !script.trim()}
            onClick={() =>
              downloadStudio(
                new Blob(
                  [
                    `# ${title}\n\n${script}\n\nAI narration draft. Review before recording and disclose synthetic voice output.\n`,
                  ],
                  { type: 'text/markdown' },
                ),
                'narration-script.md',
              )
            }
          >
            Export script ↗
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void refresh(uncertain ?? undefined).catch((cause) => setError(cause.message))
            }
          >
            Refresh saved clips
          </button>
        </div>
        {uncertain && (
          <p className="studio-notice">
            This request needs a confirmed receipt. Refresh saved clips or recover its pending
            record before another generation.
          </p>
        )}
      </form>
      <div className="studio-narration-library">
        {data?.items.map((item) => (
          <article className="studio-narration-clip" key={item.id}>
            <h4>{item.title}</h4>
            <p>
              {item.status === 'complete'
                ? `AI-generated · ${item.voice} · ${Math.round(item.duration ?? 0)} seconds`
                : item.status === 'pending'
                  ? 'Saving status uncertain or request still running'
                  : 'Generation failed · script retained'}
            </p>
            <details>
              <summary>Reviewed script</summary>
              <p>{item.script}</p>
            </details>
            {item.status === 'complete' ? (
              <>
                <audio
                  controls
                  preload="none"
                  src={`/api/studio/narration/audio?id=${item.id}`}
                  aria-label={`AI narration: ${item.title}`}
                />
                <div className="studio-finish-actions">
                  <button type="button" disabled={busy} onClick={() => void download(item.id)}>
                    Download WAV ↗
                  </button>
                  <button type="button" disabled={busy} onClick={() => onUse(item.id)}>
                    Use in campaign film
                  </button>
                </div>
              </>
            ) : item.status === 'pending' ? (
              <button type="button" disabled={busy} onClick={() => void recover(item.id)}>
                Recover saved request
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import type { FootageItem } from '@/domains/studio/footage';
import { downloadStudio } from './studio-download';
type Workspace = { available: boolean; enabled: boolean; canCreate: boolean; items: FootageItem[] };
export function StudioFootage({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [title, setTitle] = useState('Campaign atmosphere');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [ratio, setRatio] = useState<'1280:720' | '720:1280'>('1280:720');
  const [quote, setQuote] = useState<FootageItem | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Lost acknowledgements keep the exact request identity; never replace it with a paid retry.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/studio/footage?project=${projectId}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error || 'Footage could not be opened.');
        return value;
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [projectId]);
  function changed() {
    setQuote(null);
    setApproved(false);
  }
  async function refresh() {
    const r = await fetch(`/api/studio/footage?project=${projectId}`, { cache: 'no-store' });
    const value = await r.json();
    if (!r.ok) throw new Error(value.error || 'Footage could not be refreshed.');
    setData(value);
    setLocked(
      value.items.some((item: FootageItem) =>
        ['submitting', 'uncertain', 'queued'].includes(item.status),
      ),
    );
  }
  async function request(action: 'quote' | 'start' | 'check', id?: string) {
    if (action === 'start' && (!approved || !quote || Date.parse(quote.expires_at) <= Date.now())) {
      setApproved(false);
      setError('This estimate expired. Review a fresh estimate.');
      return;
    }
    setBusy(true);
    setError('');
    if (action === 'start') {
      setLocked(true);
      setApproved(false);
    }
    try {
      const body =
        action === 'quote'
          ? { action, projectId, title, prompt, duration, ratio }
          : action === 'start'
            ? { action, projectId, id: quote?.id, estimate: quote?.estimate, approved: true }
            : { action, projectId, id };
      const r = await fetch('/api/studio/footage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Footage request could not be confirmed.');
      if (action === 'quote') setQuote(result);
      else if (action === 'start') setQuote(null);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Footage could not be confirmed. Refresh saved requests before another render.',
      );
    } finally {
      setBusy(false);
    }
  }
  const pending =
    locked || data?.items.some((i) => ['submitting', 'uncertain', 'queued'].includes(i.status));
  const enabled = Boolean(data?.available && data.enabled && data.canCreate && !pending);
  return (
    <section
      className="studio-motion-room studio-footage-room"
      aria-label="AI footage production"
      aria-busy={busy}
    >
      <div className="studio-production-intro">
        <div>
          <span className="eyebrow">THE FOOTAGE ROOM</span>
          <h3>Give your vision movement.</h3>
        </div>
        <p>
          Short AI-generated atmospheric clips. Review before publishing.{' '}
          <a href="https://runway.com" target="_blank" rel="noopener noreferrer">
            Powered by Runway ↗
          </a>
        </p>
      </div>
      {!data && !error && <p role="status">Opening saved footage…</p>}
      {data && !data.enabled && (
        <p className="studio-notice">
          AI footage awaits verified activation. Prepare and export your film brief now.
        </p>
      )}
      {data && !data.canCreate && (
        <p className="studio-notice">Generation requires eligible Studio access.</p>
      )}
      <div className="studio-motion-controls">
        <label>
          Clip title
          <input
            value={title}
            maxLength={80}
            disabled={busy}
            onChange={(e) => {
              setTitle(e.target.value);
              changed();
            }}
          />
        </label>
        <label>
          Duration
          <select
            aria-label="Footage duration"
            value={duration}
            disabled={busy}
            onChange={(e) => {
              setDuration(Number(e.target.value) as 5 | 10);
              changed();
            }}
          >
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
          </select>
        </label>
        <label>
          Frame
          <select
            aria-label="Footage frame"
            value={ratio}
            disabled={busy}
            onChange={(e) => {
              setRatio(e.target.value as typeof ratio);
              changed();
            }}
          >
            <option value="1280:720">Landscape · 720p</option>
            <option value="720:1280">Portrait · 720p</option>
          </select>
        </label>
      </div>
      <label className="studio-narration-script">
        Film direction
        <textarea
          aria-label="Film direction"
          value={prompt}
          maxLength={1000}
          rows={6}
          disabled={busy}
          placeholder="Describe the subject, movement, camera and atmosphere. Avoid text, exact product claims or logos that AI may distort."
          onChange={(e) => {
            setPrompt(e.target.value);
            changed();
          }}
        />
        <span>{prompt.length}/1000 · Gen-4.5 · synthetic video</span>
      </label>
      <p className="studio-notice">
        Only this reviewed brief goes to Runway. Do not include confidential or personal
        information. Real product photography belongs in Create and Campaign; this pilot does not
        animate uploaded products or clone people.
      </p>
      {quote && (
        <div className="studio-narration-clip" aria-label="Reviewed footage estimate">
          <h4>Review one render</h4>
          <p>
            {quote.duration}s · {quote.ratio} · {quote.estimate} provider credits · estimated $
            {(quote.estimate / 100).toFixed(2)} USD before tax
          </p>
          <p>
            Provider estimate, not an invoice or member charge. Expires{' '}
            {new Date(quote.expires_at).toLocaleTimeString()}. Leaving Studio does not cancel a
            submitted render.
          </p>
          <label className="studio-narration-approval">
            <input
              type="checkbox"
              checked={approved}
              disabled={busy || pending}
              onChange={(e) => setApproved(e.target.checked)}
            />
            I authorize one render of this brief and its provider usage.
          </label>
        </div>
      )}
      <div className="studio-finish-actions">
        <button
          type="button"
          disabled={busy || !enabled || prompt.trim().length < 3 || !title.trim()}
          onClick={() => void request('quote')}
        >
          Review render estimate
        </button>
        {quote && (
          <button
            type="button"
            disabled={busy || !enabled || !approved}
            onClick={() => void request('start')}
          >
            Generate approved footage
          </button>
        )}
        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={() =>
            downloadStudio(
              new Blob(
                [
                  JSON.stringify(
                    {
                      title,
                      prompt,
                      duration,
                      ratio,
                      model: 'gen4.5',
                      status: 'draft; no generation authorized',
                    },
                    null,
                    2,
                  ),
                ],
                { type: 'application/json' },
              ),
              'aethelios-film-brief.json',
            )
          }
        >
          Export film brief
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            refresh()
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Refresh saved requests
        </button>
      </div>
      {pending && (
        <p role="status">
          A submitted request is reserved. Check its status; no new render will be submitted
          automatically.
        </p>
      )}
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      <div className="studio-narration-library">
        {data?.items
          .filter((i) => i.status !== 'quoted')
          .map((item) => (
            <article className="studio-narration-clip" key={item.id}>
              <h4>{item.title}</h4>
              <p>
                AI-generated · {item.duration}s ·{' '}
                {item.status === 'complete'
                  ? 'Privately saved'
                  : item.status === 'queued'
                    ? 'Submitted · check render status'
                    : item.status}
              </p>
              <details>
                <summary>Reviewed direction</summary>
                <p>{item.prompt}</p>
                <p>
                  Reserved estimate: {item.estimate} credits
                  {item.provider_credits !== null
                    ? ` · latest provider receipt: ${item.provider_credits} credits`
                    : ''}
                </p>
              </details>
              {item.status === 'queued' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void request('check', item.id)}
                >
                  Check render status
                </button>
              )}
              {['uncertain', 'submitting'].includes(item.status) && (
                <p>
                  Submission needs reconciliation. Contact support; do not generate this request
                  again.
                </p>
              )}
              {item.status === 'failed' && (
                <p>
                  Provider reported failure or cancellation. Reserved allowance is retained; refunds
                  are not inferred.
                </p>
              )}
              {item.status === 'complete' && (
                <>
                  <video
                    controls
                    preload="none"
                    playsInline
                    src={`/api/studio/footage/video?id=${item.id}`}
                    aria-label={`AI footage: ${item.title}`}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const r = await fetch(`/api/studio/footage/video?id=${item.id}`, {
                          cache: 'no-store',
                        });
                        if (!r.ok) throw new Error('The saved clip could not be downloaded.');
                        downloadStudio(await r.blob(), 'aethelios-ai-footage.mp4');
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Download MP4
                  </button>
                </>
              )}
            </article>
          ))}
      </div>
      <p>
        Private standalone clips, not a campaign timeline. Check submitted jobs promptly to preserve
        outputs before provider retention expires. No automatic publishing or regeneration.
      </p>
    </section>
  );
}

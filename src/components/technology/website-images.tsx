'use client';
import { useEffect, useState } from 'react';
import type { Brief } from '@/domains/technology/schema';
type Source = { id: string; kind: 'reference' | 'version'; label: string };
type Receipt = {
  id: string;
  source_id: string;
  source_kind: 'reference' | 'version';
  status: string;
  attempts: number;
};
export function WebsiteImages({
  projectId,
  revision,
  image,
  onChange,
}: {
  projectId: string;
  revision: number;
  image: Brief['image'];
  onChange: (image: Brief['image']) => void;
}) {
  const [sources, setSources] = useState<Source[]>([]),
    [receipts, setReceipts] = useState<Receipt[]>([]),
    [selection, setSelection] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch(`/api/technology/images?project=${projectId}`, { cache: 'no-store' });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error || 'Images unavailable');
    if (!Array.isArray(b.sources) || !Array.isArray(b.images))
      throw new Error('Website image choices unavailable.');
    setSources(b.sources);
    setReceipts(b.images);
  }
  useEffect(() => {
    void Promise.resolve()
      .then(() => load())
      .catch((e) => setError(e.message));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function prepare(source: Source, id = crypto.randomUUID()) {
    if (
      !confirm(
        'Save a private website copy of this personal Studio image? No AI generation is requested. Only saving and exporting a website with it makes that copy part of the website.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/technology/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          projectId,
          expected: revision,
          sourceId: source.id,
          kind: source.kind,
          consent: true,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Image completion uncertain. Reload its receipt.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image unavailable');
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Website imagery</summary>
      <p>
        Choose a personal Studio image and describe it for visitors using screen readers. The
        private website copy stays with saved versions, even if its Studio source is removed. One
        homepage image; no new AI charge.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        Personal Studio image
        <select value={selection} disabled={busy} onChange={(e) => setSelection(e.target.value)}>
          <option value="">Choose an image</option>
          {sources.map((s) => (
            <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={
          busy ||
          !selection ||
          receipts.length >= 4 ||
          receipts.some((r) => `${r.source_kind}:${r.source_id}` === selection)
        }
        onClick={() => {
          const s = sources.find((s) => `${s.kind}:${s.id}` === selection);
          if (s) void prepare(s);
        }}
      >
        Prepare selected image
      </button>
      <button disabled={busy} onClick={() => load().catch((e) => setError(e.message))}>
        Reload image receipts
      </button>
      {!sources.length && <p>Add your imagery in personal Studio, then reload these choices.</p>}
      {receipts
        .filter((r) => r.status !== 'ready')
        .map((r) => (
          <p key={r.id}>
            Image preparation · {r.status} · attempt {r.attempts}/3{' '}
            <button
              disabled={busy || r.attempts >= 3}
              onClick={() =>
                void prepare({ id: r.source_id, kind: r.source_kind, label: '' }, r.id)
              }
            >
              Resume image preparation
            </button>
          </p>
        ))}
      <label>
        Homepage image
        <select
          value={image?.assetId ?? ''}
          disabled={busy}
          onChange={(e) =>
            onChange(
              e.target.value ? { assetId: e.target.value, alt: image?.alt ?? '' } : undefined,
            )
          }
        >
          <option value="">No image</option>
          {receipts
            .filter((r) => r.status === 'ready')
            .map((r, i) => (
              <option value={r.id} key={r.id}>
                Prepared image {i + 1} · {r.id.slice(0, 8)}
              </option>
            ))}
        </select>
      </label>
      {image && (
        <label>
          Image description
          <input
            maxLength={160}
            value={image.alt}
            onChange={(e) => onChange({ ...image, alt: e.target.value })}
          />
        </label>
      )}
      <p>
        Preparing an image does not change your website. Save a new version after selecting it. Four
        prepared imports per project; failed imports count toward that limit.
      </p>
    </details>
  );
}

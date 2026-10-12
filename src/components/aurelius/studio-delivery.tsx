'use client';
import { IntelligenceActivity } from '../intelligence-motion/presence';
import { observedOperation } from '@/platform/visual/operation-adapters';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { DeliveryAsset } from '@/domains/studio/delivery';
import type { CampaignScene } from '@/domains/studio/campaign';
import { downloadStudio } from './studio-download';
type Item = {
  id: string;
  title: string;
  status: string;
  duration: 5 | 10;
  ratio: '1280:720' | '720:1280';
};
export function StudioDelivery({
  projectId,
  title,
  scenes,
  versions,
}: {
  projectId: string;
  title: string;
  scenes: CampaignScene[];
  versions: { id: string; status: string }[];
}) {
  const [extras, setExtras] = useState<DeliveryAsset[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const [approvalReceipt, setApproved] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [seconds, setSeconds] = useState<2 | 4 | 6>(4),
    [progress, setProgress] = useState({ done: 0, total: 0 });
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    Promise.allSettled(
      ['footage', 'narration'].map(async (kind) => {
        const r = await fetch(`/api/studio/${kind}?project=${projectId}`, {
          cache: 'no-store',
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
        });
        if (!r.ok) throw new Error('Saved media could not be loaded.');
        const data = await r.json();
        return (data.items ?? [])
          .filter((i: Item) => i.status === 'complete')
          .map((i: Item): DeliveryAsset =>
            kind === 'footage'
              ? { kind: 'video', id: i.id, title: i.title, duration: i.duration, ratio: i.ratio }
              : { kind: 'audio', id: i.id, title: i.title },
          );
      }),
    ).then((results) => {
      if (abort.signal.aborted) return;
      setExtras(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
      if (results.some((r) => r.status === 'rejected'))
        setNotice(
          'Some saved media could not be loaded. Images remain available; reopen Delivery to refresh other sources.',
        );
    });
    return () => abort.abort();
  }, [projectId]);
  const images: DeliveryAsset[] = versions
    .filter((v) => v.status === 'complete')
    .map((v, i) => ({ kind: 'image', id: v.id, title: `Saved image ${i + 1}` }));
  const assets = [...images, ...extras];
  const key = (asset: DeliveryAsset) => `${asset.kind}:${asset.id}`;
  const fingerprint = JSON.stringify([
    projectId,
    title,
    scenes,
    selected,
    seconds,
    selected.map((id) => assets.find((asset) => key(asset) === id)),
  ]);
  const approved = approvalReceipt === fingerprint;
  function toggle(asset: DeliveryAsset) {
    setSelected((previous) =>
      previous.includes(key(asset))
        ? previous.filter((id) => id !== key(asset))
        : previous.length < 8
          ? [...previous, key(asset)]
          : previous,
    );
    setApproved(null);
  }
  async function exportPackage() {
    if (!approved || busy) return;
    const picked = selected.map((id) => assets.find((a) => key(a) === id));
    if (picked.some((a) => !a)) {
      setError('A selected asset changed. Reopen Delivery and review again.');
      setApproved(null);
      return;
    }
    setProgress({ done: 0, total: picked.length });
    setBusy(true);
    setError('');
    setNotice('');
    setApproved(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const { deliveryPack } = await import('@/domains/studio/delivery');
      const bytes = await deliveryPack(
        { title, assets: picked as DeliveryAsset[], scenes, seconds, approved: true },
        AbortSignal.any([abort.signal, AbortSignal.timeout(120000)]),
        (done, total) => {
          if (alive.current) setProgress({ done, total });
        },
      );
      if (!alive.current || abort.signal.aborted) return;
      downloadStudio(
        new Blob([bytes as BlobPart], { type: 'application/zip' }),
        'aethelios-campaign-delivery.zip',
      );
      setNotice('Package downloaded. Nothing was published or generated.');
    } catch (e) {
      if (alive.current)
        setError(
          abort.signal.aborted
            ? 'Export cancelled. No partial package was downloaded.'
            : e instanceof Error
              ? e.message
              : 'The package could not be prepared.',
        );
    } finally {
      if (alive.current) setBusy(false);
      controller.current = null;
    }
  }
  return (
    <section className="studio-motion-room" aria-label="Campaign delivery" aria-busy={busy}>
      {busy && (
        <IntelligenceActivity operation={observedOperation('studio-delivery', 'processing')} />
      )}
      <span className="eyebrow">THE DELIVERY ROOM</span>
      <h3>From creation to a considered handoff.</h3>
      <p>
        Select up to eight saved assets. Download original images, AI footage and narration together
        with campaign copy, scene captions and an integrity manifest.
      </p>
      <p className="studio-notice">
        This is an editable handoff package, not an assembled film. Scene captions require retiming
        in your editor. Export performs no publishing, payment or AI generation.
      </p>
      <fieldset disabled={busy} className="studio-brand-kit">
        <legend>Choose saved media · {selected.length}/8</legend>
        <div className="studio-narration-library">
          {assets.map((asset) => (
            <article className="studio-narration-clip" key={key(asset)}>
              <label className="studio-narration-approval">
                <input
                  type="checkbox"
                  checked={selected.includes(key(asset))}
                  disabled={busy || (!selected.includes(key(asset)) && selected.length >= 8)}
                  onChange={() => toggle(asset)}
                />
                <span>
                  {asset.title}
                  <small>
                    {' '}
                    ·{' '}
                    {asset.kind === 'audio'
                      ? 'AI narration'
                      : asset.kind === 'video'
                        ? `AI footage · ${asset.duration}s`
                        : 'Saved image'}
                  </small>
                </span>
              </label>
              {selected.includes(key(asset)) &&
                (asset.kind === 'image' ? (
                  <Image
                    className="studio-delivery-preview"
                    unoptimized
                    src={`/api/studio/image?id=${asset.id}&kind=version`}
                    alt={asset.title}
                    width={160}
                    height={120}
                  />
                ) : asset.kind === 'video' ? (
                  <video
                    className="studio-delivery-preview"
                    controls
                    playsInline
                    preload="none"
                    src={`/api/studio/footage/video?id=${asset.id}`}
                    aria-label={`Review footage: ${asset.title}`}
                  />
                ) : (
                  <audio
                    className="studio-delivery-preview"
                    controls
                    preload="none"
                    src={`/api/studio/narration/audio?id=${asset.id}`}
                    aria-label={`Review narration: ${asset.title}`}
                  />
                ))}
            </article>
          ))}
          {!assets.length && (
            <p>
              No completed assets yet. Save an image, narration or clip in the other Studio rooms
              first.
            </p>
          )}
        </div>
      </fieldset>
      <div className="studio-motion-controls">
        <label>
          Storyboard scene timing
          <select
            aria-label="Delivery scene timing"
            value={seconds}
            disabled={busy}
            onChange={(e) => {
              setSeconds(Number(e.target.value) as 2 | 4 | 6);
              setApproved(null);
            }}
          >
            <option value={2}>2 seconds per scene</option>
            <option value={4}>4 seconds per scene</option>
            <option value={6}>6 seconds per scene</option>
          </select>
        </label>
        <p>
          {scenes.length} storyboard scenes · captions use scene copy, not speech transcription.
        </p>
      </div>
      <details>
        <summary>Review campaign copy</summary>
        {[...scenes]
          .sort((a, b) => a.position - b.position)
          .map((scene) => (
            <div key={scene.id}>
              <h4>{scene.title}</h4>
              <p>{scene.message || 'No copy written yet.'}</p>
            </div>
          ))}
      </details>
      <label className="studio-narration-approval">
        <input
          type="checkbox"
          checked={approved}
          disabled={busy || !selected.length}
          onChange={(e) => setApproved(e.target.checked ? fingerprint : null)}
        />
        I reviewed selected media, factual claims, usage rights and AI disclosures for this handoff.
      </label>
      <div className="studio-finish-actions">
        <button
          type="button"
          disabled={busy || !selected.length || !approved}
          onClick={() => void exportPackage()}
        >
          Download reviewed delivery package
        </button>
        {busy && (
          <button type="button" onClick={() => controller.current?.abort()}>
            Cancel export
          </button>
        )}
      </div>
      {busy && (
        <p role="status">
          Preparing selected assets · {progress.done}/{progress.total}
        </p>
      )}
      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <p>
        Maximum 50 MB total; large campaigns can download individual assets. Your review is recorded
        in the local manifest, not certified as independent rights or claims verification.
      </p>
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import type { BuildSummary } from '@/domains/technology/build-schema';
import { WebsiteReleaseReview } from './website-release';
export function VerifiedBuilds({
  projectId,
  versionId,
  eligible,
}: {
  projectId: string;
  versionId: string;
  eligible: boolean;
}) {
  const [builds, setBuilds] = useState<BuildSummary[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function load() {
    const r = await fetch('/api/technology/builds', { cache: 'no-store' });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error || 'Builds unavailable');
    if (!Array.isArray(b.builds)) throw new Error('Build receipts unavailable.');
    setBuilds(b.builds);
  }
  useEffect(() => {
    void Promise.resolve()
      .then(() => load())
      .catch((e) => setError(e.message));
  }, [projectId]);
  async function send(body: unknown) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/technology/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Build request uncertain');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build request uncertain');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Verified builds">
      <h2>Verified builds</h2>
      <p>
        Create a portable website from this reviewed version. No AI spend. Builds are saved; resume
        explicitly after interruption.
      </p>
      <button
        disabled={!eligible || busy}
        onClick={() => send({ action: 'queue', id: crypto.randomUUID(), projectId, versionId })}
      >
        Prepare website build
      </button>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => load().catch((e) => setError(e.message))}>
        Reload build receipts
      </button>
      {preview && (
        <>
          <button onClick={() => setPreview('')}>Close website inspection</button>
          <iframe
            title="Isolated built website"
            sandbox=""
            src={preview}
            style={{ width: '100%', height: 550, border: '1px solid #526068' }}
          />
        </>
      )}
      {builds
        .filter((b) => b.project_id === projectId)
        .map((b) => (
          <article key={b.id}>
            <p>
              {b.version_id === versionId ? 'Current version' : 'Earlier version'} · {b.status} ·
              attempt {b.attempts}/5
            </p>
            {b.status === 'ready' ? (
              <>
                <p>
                  Static document checks passed. Booking, forms and publication remain unverified.
                </p>
                <a href={`/api/technology/builds?export=${b.id}`}>Download website HTML</a>
                <WebsiteReleaseReview
                  key={b.id}
                  buildId={b.id}
                  sha256={b.sha256!}
                  eligible={eligible && b.version_id === versionId}
                />
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const r = await fetch(`/api/technology/builds?export=${b.id}`, {
                        cache: 'no-store',
                      });
                      if (!r.ok) throw new Error('Artifact unavailable');
                      setPreview(
                        URL.createObjectURL(new Blob([await r.text()], { type: 'text/html' })),
                      );
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Artifact unavailable');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Inspect isolated website
                </button>
                <p>
                  SHA-256: <code style={{ overflowWrap: 'anywhere' }}>{b.sha256}</code>
                </p>
              </>
            ) : (
              <button disabled={busy} onClick={() => send({ action: 'resume', id: b.id })}>
                Build / resume saved job
              </button>
            )}
          </article>
        ))}
    </section>
  );
}

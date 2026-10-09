'use client';
import { useRef, useState } from 'react';
import type { WebsiteRelease } from '@/domains/technology/release-schema';
export function WebsiteReleaseReview({
  buildId,
  sha256,
  eligible,
}: {
  buildId: string;
  sha256: string;
  eligible: boolean;
}) {
  const [open, setOpen] = useState(false),
    [receipts, setReceipts] = useState<WebsiteRelease[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [consent, setConsent] = useState(false);
  const requestId = useRef<string | null>(null);
  async function load() {
    const r = await fetch(`/api/technology/releases?build=${buildId}`, { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok || !Array.isArray(data.releases))
      throw new Error(data.error || 'Release receipts unavailable.');
    setReceipts(data.releases);
  }
  async function review() {
    setOpen(true);
    setBusy(true);
    setError('');
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Release receipts unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function send(action: 'approve' | 'revoke', id?: string) {
    setBusy(true);
    setError('');
    requestId.current ??= crypto.randomUUID();
    const body =
      action === 'approve'
        ? { action, id: requestId.current, buildId, sha256, consent }
        : { action, id };
    try {
      const r = await fetch('/api/technology/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Release request uncertain.');
      await load();
      setConsent(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Release request uncertain. Reload before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Website release preparation">
      <button disabled={busy} onClick={review}>
        {open ? 'Reload release receipt' : 'Review release package'}
      </button>
      {open && (
        <>
          <h3>Prepare for release</h3>
          <p>
            Approve these exact website files for download. Hosting remains inactive. Selected
            imagery is included in shared files. No AI or hosting charge.
          </p>
          <p>
            Forms, booking operations and payments are not connected. Live publishing needs verified
            hosting, domain ownership, an approved budget and a separate release decision.
          </p>
          {error && <p role="alert">{error}</p>}
          {!receipts.length && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy || !!error || !eligible}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I reviewed this exact build and approve preparing its downloadable files.
              </label>
              <button
                disabled={busy || !!error || !eligible || !consent}
                onClick={() => send('approve')}
              >
                Approve release package
              </button>
              {!eligible && (
                <p>Review and build the current saved version to prepare a new release.</p>
              )}
            </>
          )}
          {receipts.map((r) => (
            <article key={r.id}>
              <p>
                Version {r.revision} · {r.revoked_at ? 'Approval revoked' : 'Package approved'} ·
                Not published
              </p>
              {!r.revoked_at && (
                <>
                  <a href={`/api/technology/releases?download=${r.id}`}>Download release ZIP</a>
                  <p>
                    Revocation blocks future package downloads. It cannot recall files already
                    downloaded or shared.
                  </p>
                  <button disabled={busy} onClick={() => send('revoke', r.id)}>
                    Revoke package approval
                  </button>
                </>
              )}
              {r.revoked_at && (
                <p>
                  This receipt remains saved. Prepare a new website version for another release.
                </p>
              )}
            </article>
          ))}
          <button onClick={() => setOpen(false)}>Close release review</button>
        </>
      )}
    </section>
  );
}

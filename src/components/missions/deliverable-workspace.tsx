'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jsonRequest } from '@/components/aurelius/memory-editor';
import {
  deliverableFields,
  type Deliverable,
  type DeliverableVersion,
} from '@/domains/missions/deliverable-schema';
type State = { deliverable: Deliverable; versions: DeliverableVersion[] };
export function DeliverableWorkspace({ initial }: { initial: State }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const latest = data.versions[0]!;
  const [draft, setDraft] = useState({
    title: latest.title,
    body: latest.body,
    acceptance: latest.acceptance,
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<string | null>(null);
  const dirty =
    draft.title !== latest.title ||
    draft.body !== latest.body ||
    draft.acceptance !== latest.acceptance;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function remove() {
    if (
      !window.confirm(
        'Delete this deliverable and all its versions? The source conversation stays saved.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await jsonRequest('/api/missions/deliverables', 'POST', {
        action: 'delete',
        id: data.deliverable.id,
        expected: data.deliverable.revision,
      });
      router.push('/app/missions/deliverables');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion was not confirmed.');
      setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  const selected = data.versions.find((v) => v.id === history);
  async function refresh() {
    const response = await fetch(`/api/missions/deliverables?id=${data.deliverable.id}`, {
      cache: 'no-store',
    });
    const next = await response.json();
    if (!response.ok) throw new Error(next.error);
    setData(next);
    const version = next.versions[0] as DeliverableVersion;
    setDraft({ title: version.title, body: version.body, acceptance: version.acceptance });
    setNote('');
    setHistory(null);
    setUncertain(false);
    setError('');
  }
  async function mutate(review: boolean) {
    if (busy || uncertain) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await jsonRequest(
        '/api/missions/deliverables',
        'POST',
        review
          ? { action: 'review', id: data.deliverable.id, versionId: latest.id, note }
          : {
              action: 'save',
              id: data.deliverable.id,
              versionId: crypto.randomUUID(),
              expected: data.deliverable.revision,
              ...draft,
            },
      );
      await refresh();
      setNotice(
        review
          ? `Review recorded for version ${latest.revision}.`
          : 'New version saved. Review it before use.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save was not confirmed.');
      setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mission-editor deliverable-workspace" aria-label="Deliverable workspace">
      <p className="eyebrow">Aethelios · Saved work</p>
      <h1>{latest.title}</h1>
      <p>
        Version {latest.revision} ·{' '}
        {latest.reviewed_at ? 'Reviewed by you' : 'Draft — not reviewed'}
      </p>
      <p>
        From a completed reply · Mission direction revision {data.deliverable.source_revision}.
        Editing keeps earlier versions. Review records your assessment; it does not certify facts or
        execute work.
      </p>
      <div className="mission-actions">
        {data.deliverable.mission_id && (
          <Link href={`/app/missions?id=${data.deliverable.mission_id}`}>← Return to Mission</Link>
        )}
        <Link href="/app/missions/deliverables">All saved deliverables</Link>
        <a href={`/api/missions/deliverables?id=${data.deliverable.id}&version=${latest.id}`}>
          Export saved version (.md)
        </a>
      </div>
      <label>
        Deliverable title
        <input
          maxLength={120}
          value={draft.title}
          disabled={busy || uncertain}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label>
        Work product
        <textarea
          className="deliverable-body"
          rows={18}
          maxLength={50000}
          value={draft.body}
          disabled={busy || uncertain}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
      </label>
      <label>
        Acceptance criteria
        <textarea
          rows={3}
          maxLength={2000}
          value={draft.acceptance}
          disabled={busy || uncertain}
          placeholder="What must be true for this to be useful and ready?"
          onChange={(e) => setDraft({ ...draft, acceptance: e.target.value })}
        />
      </label>
      <p className="quiet-label">
        {dirty ? 'Unsaved edits. Export uses the saved version.' : 'You are viewing saved work.'}{' '}
        When Mission context is on, Talk receives bounded excerpts of up to three latest
        deliverables.
      </p>
      <button
        type="button"
        className="button"
        disabled={
          busy ||
          uncertain ||
          !dirty ||
          !deliverableFields.safeParse(draft).success ||
          latest.revision >= 100
        }
        onClick={() => void mutate(false)}
      >
        Save new version
      </button>
      {latest.revision >= 100 && (
        <p>
          This deliverable has reached its 100-version limit. You can review and export saved
          versions.
        </p>
      )}
      <section aria-label="Review saved version">
        <h2>Review saved version</h2>
        {latest.reviewed_at ? (
          <p>Reviewed by you · {latest.review_note}</p>
        ) : (
          <>
            <label>
              Review note
              <textarea
                rows={3}
                maxLength={2000}
                value={note}
                disabled={busy || uncertain || dirty}
                placeholder="Describe what you checked and any remaining limitations."
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={
                busy ||
                uncertain ||
                dirty ||
                note.trim().length < 3 ||
                latest.acceptance.trim().length < 3
              }
              onClick={() => void mutate(true)}
            >
              Mark this version reviewed
            </button>
            <p className="quiet-label">
              Save acceptance criteria and finish editing before recording review.
            </p>
          </>
        )}
      </section>
      {busy && <p role="status">Saving work…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <div role="alert">
          <p>{error} Your unsaved text remains visible. Copy it before reloading.</p>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Reload saved work and discard the visible unsaved edits?'))
                void refresh().catch((e) => setError(e.message));
            }}
          >
            Reload saved work
          </button>
        </div>
      )}
      <button
        type="button"
        className="text-button"
        disabled={busy || uncertain || dirty}
        onClick={() => void remove()}
      >
        Delete deliverable
      </button>
      <details>
        <summary>Version history ({data.versions.length})</summary>
        <ul>
          {data.versions.map((v) => (
            <li key={v.id}>
              <button type="button" className="text-button" onClick={() => setHistory(v.id)}>
                Version {v.revision} · {v.reviewed_at ? 'Reviewed by you' : 'Draft'}
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <article aria-label="Historical version">
            <h3>
              {selected.title} · version {selected.revision}
            </h3>
            <p className="mission-output-text">{selected.body}</p>
            <p>Acceptance: {selected.acceptance || 'Not recorded'}</p>
            <p>Review: {selected.review_note || 'Not reviewed'}</p>
            <a href={`/api/missions/deliverables?id=${data.deliverable.id}&version=${selected.id}`}>
              Export this version (.md)
            </a>
          </article>
        )}
      </details>
    </section>
  );
}

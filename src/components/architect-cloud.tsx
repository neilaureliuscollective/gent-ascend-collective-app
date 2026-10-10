'use client';
import { useState } from 'react';
import type { WebProject } from '@/domains/architect/project';
import { parseProject } from '@/domains/architect/project';
import type { CloudProject, CloudVersion, ArchitectJob } from '@/domains/architect/cloud-types';
type Library = {
  projects: CloudProject[];
  jobs: ArchitectJob[];
  executionEnabled: boolean;
  monthlyLimit: number;
  used: number;
};
async function request(path: string, body?: unknown) {
  const response = await fetch(path, {
    cache: 'no-store',
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error ?? 'Architect is unavailable.'), {
      status: response.status,
    });
  return result;
}
export function ArchitectCloud({
  project,
  onLoad,
}: {
  project: WebProject | null;
  onLoad: (p: WebProject) => void;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [selected, setSelected] = useState<{ id: string; revision: number; source: string } | null>(
    null,
  );
  const [versions, setVersions] = useState<CloudVersion[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [instruction, setInstruction] = useState('');
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<WebProject | null>(null);
  const [pending, setPending] = useState<{
    action: 'save';
    projectId: string;
    versionId: string;
    expected: number;
    content: WebProject;
  } | null>(null);
  async function inspect() {
    if (busy) return;
    setBusy(true);
    try {
      setLibrary(await request('/api/architect'));
      setMessage(
        'Cloud library loaded. Execution allowances include failed and uncertain requests.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Cloud library unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (busy || pending) return;
    if (
      project &&
      !window.confirm(
        'Replace this tab’s source with the saved cloud project? Export unsaved changes first.',
      )
    )
      return;
    setBusy(true);
    try {
      const work: { project: CloudProject; versions: CloudVersion[] } = await request(
        '/api/architect?projectId=' + id,
      );
      const source = parseProject(work.versions[0]?.content);
      setSelected({ id, revision: work.project.revision, source: JSON.stringify(source) });
      setVersions(work.versions);
      onLoad(source);
      setDraft(null);
      setMessage(
        'Saved project loaded. Restoring an older version creates a new revision when saved.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not open project.');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!project || busy) return;
    setBusy(true);
    const attempt = pending ?? {
      action: 'save',
      projectId: selected?.id ?? crypto.randomUUID(),
      versionId: crypto.randomUUID(),
      expected: selected?.revision ?? 0,
      content: project,
    };
    setPending(attempt);
    try {
      const result = await request('/api/architect', attempt);
      setSelected({
        id: attempt.projectId,
        revision: result.revision,
        source: JSON.stringify(attempt.content),
      });
      setPending(null);
      setMessage('Cloud revision confirmed. Later edits in this tab still need a separate save.');
    } catch (e) {
      if (
        e &&
        typeof e === 'object' &&
        'status' in e &&
        typeof e.status === 'number' &&
        e.status < 500
      ) {
        setPending(null);
        setMessage(e instanceof Error ? e.message : 'Save rejected. Reload the cloud project.');
        return;
      }
      setMessage(
        (e instanceof Error ? e.message : 'Save not confirmed.') +
          ' Retry sends the same saved snapshot and request IDs; do not assume it failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!selected || busy || !consent || pending) return;
    setBusy(true);
    setDraft(null);
    try {
      const result = await request('/api/architect', {
        action: 'generate',
        projectId: selected.id,
        expected: selected.revision,
        requestId: crypto.randomUUID(),
        instruction,
        consent: true,
      });
      setDraft(parseProject(result.draft));
      setMessage(
        'A proposed revision is ready. Review it before applying; the saved project is unchanged.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Inspect the job receipt before retrying.');
    } finally {
      setBusy(false);
      setConsent(false);
    }
  }
  return (
    <details className="architect-cloud">
      <summary>Cloud projects & bounded AI revisions</summary>
      <p>
        Requires sign-in and separately enabled storage. AI requires an approved server
        configuration and an explicit, unexpired execution grant. No membership purchase or
        permission upgrade happens here. Do not include credentials, medical records or private
        customer data in project source.
      </p>
      <button type="button" disabled={busy} onClick={inspect}>
        Load cloud library & usage
      </button>
      {library && (
        <>
          <p>
            {library.used} of {library.monthlyLimit} monthly reservations used (UTC). At most three
            per rolling day, with a two-minute reservation cooldown.{' '}
            {library.executionEnabled
              ? 'AI configuration and grant are available.'
              : 'AI execution is not enabled.'}
          </p>
          <ul>
            {library.projects.map((p) => (
              <li key={p.id}>
                <button type="button" disabled={busy || !!pending} onClick={() => open(p.id)}>
                  {p.name} · revision {p.revision}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {project && (
        <button type="button" disabled={busy} onClick={save}>
          {pending
            ? 'Retry same cloud save'
            : selected
              ? 'Save cloud revision'
              : 'Save new cloud project'}
        </button>
      )}
      {selected && (
        <>
          <p>Cloud revision {selected.revision}. Save edits before requesting AI.</p>
          <details>
            <summary>Saved revision history</summary>
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={busy || !!pending}
                onClick={() => {
                  onLoad(parseProject(v.content));
                  setMessage('Older source loaded locally. Save to create a new cloud revision.');
                }}
              >
                Load saved revision {v.revision}
              </button>
            ))}
            <p>Reopen the cloud project to refresh history after a save.</p>
          </details>
          <label>
            AI revision request
            <textarea
              maxLength={3000}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            I authorize one model call using only this saved project and my request. The reservation
            is consumed even if it fails.
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !!pending ||
              !consent ||
              !instruction.trim() ||
              !library?.executionEnabled ||
              JSON.stringify(project) !== selected.source
            }
            onClick={generate}
          >
            Request one AI revision
          </button>
          {draft && (
            <section aria-label="Proposed AI revision">
              <h3>Review proposed source</h3>
              <p>{draft.brief}</p>
              <details>
                <summary>Proposed HTML</summary>
                <pre>{draft.html}</pre>
              </details>
              <details>
                <summary>Proposed CSS</summary>
                <pre>{draft.css}</pre>
              </details>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onLoad(draft);
                  setDraft(null);
                  setMessage(
                    'Proposal applied locally for preview. Inspect checks, then save explicitly to create a cloud version.',
                  );
                }}
              >
                Apply proposed source locally
              </button>
              <button type="button" onClick={() => setDraft(null)}>
                Discard proposal
              </button>
            </section>
          )}
          <button
            type="button"
            disabled={busy || !!pending}
            onClick={async () => {
              if (
                !window.confirm(
                  'Delete cloud source and versions? Minimal execution reservations remain for usage accounting.',
                )
              )
                return;
              setBusy(true);
              try {
                await request('/api/architect', { action: 'delete', projectId: selected.id });
                setSelected(null);
                setVersions([]);
                setDraft(null);
                setLibrary(null);
                setMessage(
                  'Cloud source deleted. This tab’s local copy remains until you clear it.',
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Deletion not confirmed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete cloud project
          </button>
        </>
      )}
      {library && (
        <details>
          <summary>Current-month job receipts</summary>
          <ul>
            {library.jobs.map((j) => (
              <li key={j.id}>
                {j.created_at} · {j.status} · {j.id}
                {j.output && (
                  <button
                    type="button"
                    disabled={busy || !!pending || selected?.id !== j.project_id}
                    onClick={() => {
                      setDraft(parseProject(j.output));
                      setMessage(
                        'Receipt draft recovered for review. Apply locally and save explicitly.',
                      );
                    }}
                  >
                    Review receipt draft
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p>
            Receipts are not proof of code execution or security validation. Reserved requests are
            never automatically re-run.
          </p>
        </details>
      )}
      <p role="status" aria-live="polite">
        {busy ? 'Working…' : message}
      </p>
    </details>
  );
}

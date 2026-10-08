'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  briefSchema,
  initialBrief,
  type Brief,
  type Workspace,
  type Version,
} from '@/domains/technology/schema';
import { SitePreview } from './site-preview';
import './technology.css';
export function TechnologyWorkspace() {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false);
  const [id, setId] = useState<string | null>(null),
    [brief, setBrief] = useState<Brief>(initialBrief),
    [view, setView] = useState<Version | null>(null),
    [path, setPath] = useState('guided');
  const [baseline, setBaseline] = useState(JSON.stringify(initialBrief));
  const dirty = JSON.stringify(brief) !== baseline;
  async function load(selected: string | null = id) {
    setBusy(true);
    try {
      const query = new URLSearchParams(window.location.search);
      const mission = query.get('mission');
      const response = await fetch(
        `/api/technology${mission ? `?mission=${encodeURIComponent(mission)}` : ''}`,
        { cache: 'no-store' },
      );
      const value = await response.json();
      if (!response.ok) {
        setBusy(false);
        throw new Error(value.error || 'Technology unavailable.');
      }
      const workspace = value as Workspace;
      setData(workspace);
      const projectId = selected ?? query.get('project');
      const project = workspace.projects.find((p) => p.id === projectId);
      if (project) {
        const v = workspace.versions.find(
          (v) => v.project_id === project.id && v.revision === project.revision,
        )!;
        setId(project.id);
        setBrief(v.brief);
        setBaseline(JSON.stringify(v.brief));
        setView(null);
      } else {
        setId(null);
        setBrief(initialBrief);
        setBaseline(JSON.stringify(initialBrief));
        setView(null);
      }
      setLocked(false);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void Promise.resolve()
      .then(() => load(null))
      .catch((e) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const project = data?.projects.find((p) => p.id === id),
    latest = data?.versions.find((v) => v.project_id === id && v.revision === project?.revision);
  const unresolved = data?.runs.some((r) => r.status !== 'succeeded');
  async function send(body: unknown, selected = id) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/technology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Request uncertain.');
      await load(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request uncertain.');
      setLocked(true);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    const parsed = briefSchema.safeParse(brief);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
      return;
    }
    const newId = id ?? crypto.randomUUID();
    send(
      project
        ? {
            action: 'save',
            id: newId,
            versionId: crypto.randomUUID(),
            expected: project.revision,
            brief: parsed.data,
          }
        : {
            action: 'create',
            id: newId,
            versionId: crypto.randomUUID(),
            brief: parsed.data,
            missionId: data?.mission?.id ?? null,
            missionRevision: data?.mission?.revision ?? null,
          },
      newId,
    );
  }
  function patch(key: keyof Brief, value: unknown) {
    setBrief((b) => ({ ...b, [key]: value }));
    setView(null);
  }
  return (
    <section className="technology-workspace">
      <header>
        <span className="eyebrow">AETHELIOS / TECHNOLOGY · CREATION FOUNDATION</span>
        <h1>Give your vision a working shape.</h1>
        <p>
          A saved, four-page service-business preview. Review the brief, refine the copy, and
          continue from the same project.
        </p>
        <Link href="/app/work">← Your work</Link>
      </header>
      {error && (
        <p role="alert" className="technology-error">
          {error}
        </p>
      )}
      {!data ? (
        <button onClick={() => load(null).catch((e) => setError(e.message))}>
          Reload workspace
        </button>
      ) : (
        <>
          {!data.canCreate && (
            <p>
              Technology creation is an invited pilot. Your membership does not grant this
              capability.
            </p>
          )}
          {data.mission && (
            <p>
              Mission: {data.mission.title} · captured direction revision {data.mission.revision}.{' '}
              <Link href={`/app/missions?id=${data.mission.id}`}>Return to Mission ↗</Link>
            </p>
          )}
          <div className="technology-projects">
            <button
              disabled={busy}
              onClick={() => {
                if (dirty && !confirm('Discard unsaved changes?')) return;
                setId(null);
                setBrief(initialBrief);
                setBaseline(JSON.stringify(initialBrief));
                setView(null);
              }}
            >
              New project
            </button>
            {data.projects.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                aria-pressed={p.id === id}
                onClick={() => {
                  if (dirty && !confirm('Discard unsaved changes?')) return;
                  load(p.id).catch((e) => setError(e.message));
                }}
              >
                {
                  data.versions.find((v) => v.project_id === p.id && v.revision === p.revision)
                    ?.brief.name
                }{' '}
                · v{p.revision}
              </button>
            ))}
          </div>
          <div className="technology-grid">
            <div>
              <div className="technology-paths">
                {(
                  [
                    ['guided', 'Guided creation'],
                    ['vision', 'Vision to product'],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} aria-pressed={path === value} onClick={() => setPath(value)}>
                    {label}
                  </button>
                ))}
              </div>
              <p>
                {path === 'vision'
                  ? 'Describe the outcome, then confirm the supported requirements below. SaaS, stores and custom code are not supported in this foundation.'
                  : 'Choose a service category and define your business. The same reviewed brief powers both paths.'}
              </p>
              {data.mission && (
                <button
                  disabled={busy || locked || !data.canCreate}
                  onClick={() => patch('vision', data.mission!.objective)}
                >
                  Use this Mission objective in the brief
                </button>
              )}
              <fieldset disabled={busy || locked || !data.canCreate}>
                <legend>Business brief {project ? `· version ${project.revision}` : ''}</legend>
                <label>
                  Business name
                  <input
                    maxLength={100}
                    value={brief.name}
                    onChange={(e) => patch('name', e.target.value)}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={brief.industry}
                    onChange={(e) => patch('industry', e.target.value)}
                  >
                    <option value="grooming-beauty">Grooming & beauty</option>
                    <option value="professional-services">Professional services</option>
                  </select>
                </label>
                <label>
                  Your vision
                  <textarea
                    maxLength={2000}
                    value={brief.vision}
                    onChange={(e) => patch('vision', e.target.value)}
                  />
                </label>
                <label>
                  Headline
                  <input
                    maxLength={150}
                    value={brief.headline}
                    onChange={(e) => patch('headline', e.target.value)}
                  />
                </label>
                <label>
                  About your business
                  <textarea
                    maxLength={2000}
                    value={brief.about}
                    onChange={(e) => patch('about', e.target.value)}
                  />
                </label>
                {brief.services.map((s, i) => (
                  <div className="technology-service" key={i}>
                    <label>
                      Service {i + 1}
                      <input
                        maxLength={100}
                        value={s.name}
                        onChange={(e) =>
                          patch(
                            'services',
                            brief.services.map((v, n) =>
                              n === i ? { ...v, name: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        maxLength={500}
                        value={s.description}
                        onChange={(e) =>
                          patch(
                            'services',
                            brief.services.map((v, n) =>
                              n === i ? { ...v, description: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Price as displayed
                      <input
                        maxLength={50}
                        value={s.price}
                        onChange={(e) =>
                          patch(
                            'services',
                            brief.services.map((v, n) =>
                              n === i ? { ...v, price: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    {brief.services.length > 1 && (
                      <button
                        onClick={() =>
                          patch(
                            'services',
                            brief.services.filter((_, n) => n !== i),
                          )
                        }
                      >
                        Remove service {i + 1}
                      </button>
                    )}
                  </div>
                ))}
                <button
                  disabled={brief.services.length >= 12}
                  onClick={() =>
                    patch('services', [...brief.services, { name: '', description: '', price: '' }])
                  }
                >
                  Add service
                </button>
                <label>
                  Hours
                  <textarea
                    maxLength={500}
                    value={brief.hours}
                    onChange={(e) => patch('hours', e.target.value)}
                  />
                </label>
                <label>
                  Contact details
                  <textarea
                    maxLength={500}
                    value={brief.contact}
                    onChange={(e) => patch('contact', e.target.value)}
                  />
                </label>
                <label>
                  Optional HTTPS booking link
                  <input
                    type="url"
                    maxLength={500}
                    value={brief.bookingUrl}
                    onChange={(e) => patch('bookingUrl', e.target.value)}
                  />
                </label>
                <button onClick={save} disabled={!dirty || (!project && data.projects.length >= 5)}>
                  Save new version
                </button>
              </fieldset>
              <div className="technology-quality">
                <h2>Review & quality</h2>
                <p>
                  {dirty
                    ? 'Unsaved changes · preview is a draft'
                    : latest?.reviewed_at
                      ? 'Exact saved version reviewed by you'
                      : 'Saved brief needs your review'}
                </p>
                <p>
                  Schema-validated template · escaped text · four pages. User review does not
                  certify factual accuracy or production readiness.
                </p>
                <button
                  disabled={
                    !latest ||
                    dirty ||
                    busy ||
                    locked ||
                    !data.canCreate ||
                    Boolean(latest.reviewed_at)
                  }
                  onClick={() => send({ action: 'review', id, versionId: latest!.id })}
                >
                  Confirm this saved brief
                </button>
                <p>
                  AI copy refinement sends only this reviewed brief to OpenAI. At most one call,
                  85-second timeout; reserves $1 from a $10 monthly pilot allowance. It does not
                  send your personal memory or Mission history.
                </p>
                <button
                  disabled={
                    !latest?.reviewed_at ||
                    dirty ||
                    busy ||
                    locked ||
                    unresolved ||
                    !data.canCreate ||
                    !data.generationAvailable
                  }
                  onClick={() => {
                    if (
                      confirm(
                        'Send this reviewed brief to OpenAI and reserve up to $1 of your pilot allowance?',
                      )
                    )
                      send({
                        action: 'generate',
                        id,
                        runId: crypto.randomUUID(),
                        expected: project!.revision,
                        consent: true,
                      });
                  }}
                >
                  Refine copy with Aethelios
                </button>
                {!data.generationAvailable && (
                  <p>
                    AI generation is not configured; manual creation and saved previews are
                    available.
                  </p>
                )}
                {data.runs.map((r) => (
                  <p key={r.id}>
                    Run {r.id.slice(0, 8)} · {r.status} ·{' '}
                    {r.actual_micros === null
                      ? '$1 reserved'
                      : `$${(r.actual_micros / 1e6).toFixed(4)} recorded`}
                  </p>
                ))}
                {busy && (
                  <p role="status">Saving or generating… No background coworkers are running.</p>
                )}
                {locked && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (dirty && !confirm('Reload saved state and discard unsaved changes?'))
                        return;
                      load().catch((e) => setError(e.message));
                    }}
                  >
                    Reload saved state
                  </button>
                )}
              </div>
            </div>
            <div>
              <p>
                {view ? `Saved history · version ${view.revision}` : 'Working preview'} · private,
                not deployed
              </p>
              <SitePreview brief={view?.brief ?? brief} />
              {project?.mission_id && (
                <Link href={`/app/missions?id=${project.mission_id}`}>
                  Continue the originating Mission ↗
                </Link>
              )}
              <h2>Version history</h2>
              {data.versions
                .filter((v) => v.project_id === id)
                .map((v) => (
                  <button className="technology-version" key={v.id} onClick={() => setView(v)}>
                    Version {v.revision} · {v.reviewed_at ? 'Reviewed by you' : 'Draft'} ·{' '}
                    {new Date(v.created_at).toLocaleString()}
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

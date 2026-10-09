'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  briefSchema,
  defaultDesign,
  initialBrief,
  type Brief,
  type Workspace,
  type Version,
} from '@/domains/technology/schema';
import { WebsiteImages } from './website-images';
import { PageComposer } from './page-composer';
import { VerifiedBuilds } from './verified-builds';
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
  const [proposalNotice, setProposalNotice] = useState('');
  const [instruction, setInstruction] = useState('');
  const [source, setSource] = useState<{ turnId: string; revision: number } | null>(null);
  const [baseline, setBaseline] = useState(JSON.stringify(initialBrief));
  const dirty = JSON.stringify(brief) !== baseline;
  async function load(selected: string | null = id) {
    setBusy(true);
    setProposalNotice('');
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
      setSource(null);
      setInstruction('');
      if (!project && query.get('proposal') && mission) {
        const proposal = await fetch(
          `/api/technology/proposal?mission=${encodeURIComponent(mission)}&turn=${encodeURIComponent(query.get('proposal')!)}`,
          { cache: 'no-store' },
        );
        const proposed = await proposal.json();
        if (!proposal.ok || proposed.missionRevision !== workspace.mission?.revision)
          throw new Error(proposed.error || 'Source Mission changed. Reload before reviewing.');
        const parsed = briefSchema.parse(proposed.brief);
        setBrief(parsed);
        setProposalNotice(
          'Suggested website brief from Talk. Confirm every fact, service, price and design choice before saving. It has not been built or verified.',
        );
      }
      if (project && query.get('turn')) {
        const handoff = await fetch(
          `/api/technology/handoff?project=${project.id}&turn=${encodeURIComponent(query.get('turn')!)}`,
          { cache: 'no-store' },
        );
        const h = await handoff.json();
        if (!handoff.ok) throw new Error(h.error || 'Website request unavailable.');
        setInstruction(h.instruction);
        setSource({ turnId: h.turnId, revision: h.revision });
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
  const historical = Boolean(view && view.id !== latest?.id);
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
    setBrief((b) => {
      const next = { ...b, [key]: value };
      if (value === undefined) delete next[key];
      return next;
    });
    setView(null);
  }
  return (
    <section className="technology-workspace">
      <header>
        <span className="eyebrow">AETHELIOS / TECHNOLOGY · CREATION ENGINE</span>
        <h1>Give your vision a working shape.</h1>
        <p>
          A saved service-business website. Shape its design, request revisions, and continue from
          the same project.
        </p>
        <Link href="/app/work">← Your work</Link>
      </header>
      {proposalNotice && (
        <p role="status" className="technology-quality">
          {proposalNotice}
        </p>
      )}
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
                setProposalNotice('');
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
              {!project && (
                <p>
                  Start with a conversation:{' '}
                  <Link href="/app/aethelios">
                    open Talk → Tools & context → “Plan a website with Aethelios” ↗
                  </Link>
                  . Capture the conversation as a Mission to bring its proposal here for review.
                </p>
              )}
              {data.mission && (
                <button
                  disabled={busy || locked || !data.canCreate}
                  onClick={() => patch('vision', data.mission!.objective)}
                >
                  Use this Mission objective in the brief
                </button>
              )}
              {project && latest && (
                <div className="technology-quality" aria-label="Website conversation">
                  <h2>Describe the next revision.</h2>
                  <p>
                    Editing {latest.brief.name} · v{latest.revision}. Copy, design and informational
                    page changes create an unreviewed version. Review suggested text before using
                    it. Owned imagery can be selected below. Custom functionality requires future
                    work.
                  </p>
                  <label>
                    Website revision request
                    <textarea
                      maxLength={1000}
                      value={instruction}
                      disabled={busy || locked || historical}
                      placeholder="Make the homepage more luxurious with an ivory palette and a centered hero."
                      onChange={(e) => {
                        setInstruction(e.target.value);
                        setSource(null);
                      }}
                    />
                  </label>
                  {source && (
                    <p>
                      Selected completed Talk request · source {source.turnId.slice(0, 8)} · project
                      v{source.revision}. Only your selected request and this brief are sent.
                    </p>
                  )}
                  <button
                    disabled={
                      !latest.reviewed_at ||
                      dirty ||
                      busy ||
                      locked ||
                      historical ||
                      unresolved ||
                      !data.canCreate ||
                      !data.generationAvailable ||
                      instruction.trim().length < 3 ||
                      (source !== null && source.revision !== project.revision)
                    }
                    onClick={() => {
                      if (
                        confirm(
                          'Send this website brief and revision request to OpenAI and reserve up to $1 of your pilot allowance?',
                        )
                      )
                        send({
                          action: 'generate',
                          id,
                          runId: crypto.randomUUID(),
                          expected: project.revision,
                          consent: true,
                          ...(source
                            ? { sourceTurnId: source.turnId }
                            : { instruction: instruction.trim() }),
                        });
                    }}
                  >
                    Apply requested revision
                  </button>
                  {project.conversation_id && (
                    <Link
                      href={`/app/aethelios?technology=${project.id}&conversation=${project.conversation_id}`}
                    >
                      Discuss this website in Talk ↗
                    </Link>
                  )}
                  {latest.brief.design?.request && (
                    <p>Last saved request: {latest.brief.design.request}</p>
                  )}
                  {latest.brief.design?.rationale && (
                    <p>Design decision: {latest.brief.design.rationale}</p>
                  )}
                </div>
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
                <details>
                  <summary>Design direction</summary>
                  <p>
                    These choices are saved with each version. Manual changes use no AI allowance.
                  </p>
                  {(
                    [
                      [
                        'palette',
                        'Website palette',
                        [
                          ['petrol', 'Petrol & gold'],
                          ['ivory', 'Ivory & brass'],
                          ['slate', 'Slate & silver'],
                        ],
                      ],
                      [
                        'hero',
                        'Hero composition',
                        [
                          ['editorial', 'Editorial'],
                          ['centered', 'Centered'],
                          ['split', 'Split composition'],
                        ],
                      ],
                      [
                        'typography',
                        'Heading typography',
                        [
                          ['serif', 'Classic serif'],
                          ['sans', 'Modern sans'],
                        ],
                      ],
                      [
                        'spacing',
                        'Section spacing',
                        [
                          ['spacious', 'Spacious'],
                          ['compact', 'Compact'],
                        ],
                      ],
                    ] as const
                  ).map(([key, label, options]) => (
                    <label key={key}>
                      {label}
                      <select
                        value={(brief.design ?? defaultDesign)[key]}
                        onChange={(e) =>
                          patch('design', {
                            ...defaultDesign,
                            ...brief.design,
                            [key]: e.target.value,
                          })
                        }
                      >
                        {options.map(([value, name]) => (
                          <option key={value} value={value}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    Primary website action
                    <input
                      maxLength={60}
                      value={brief.design?.cta ?? defaultDesign.cta}
                      onChange={(e) =>
                        patch('design', { ...defaultDesign, ...brief.design, cta: e.target.value })
                      }
                    />
                  </label>
                </details>
                {project && (
                  <WebsiteImages
                    key={project.id}
                    projectId={project.id}
                    revision={project.revision}
                    image={brief.image}
                    onChange={(image) => patch('image', image)}
                  />
                )}
                <PageComposer
                  pages={brief.pages ?? []}
                  onChange={(pages) => patch('pages', pages)}
                />
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
                  Versioned service-business structure · safe text-only preview. User review does
                  not certify factual accuracy or production readiness.
                </p>
                <button
                  disabled={
                    !latest ||
                    dirty ||
                    busy ||
                    locked ||
                    !data.canCreate ||
                    Boolean(latest.reviewed_at) ||
                    historical
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
                    !data.generationAvailable ||
                    historical
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
                {typeof data.remainingMicros === 'number' && (
                  <p>
                    ${(data.remainingMicros / 1e6).toFixed(2)} of the $10 pilot allowance remains
                    this UTC calendar month. Unresolved reservations continue to block generation.
                  </p>
                )}
                {data.runs.slice(0, 10).map((r) => (
                  <p key={r.id}>
                    Run {r.id.slice(0, 8)} · {r.status} ·{' '}
                    {r.actual_micros === null
                      ? '$1 reserved'
                      : `$${(r.actual_micros / 1e6).toFixed(4)} recorded`}
                  </p>
                ))}
                {busy && <p role="status">Working on your request…</p>}
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
              {view && (
                <button onClick={() => setView(null)}>Return to current working preview</button>
              )}
              <SitePreview brief={view?.brief ?? brief} />
              {project?.mission_id && (
                <Link href={`/app/missions?id=${project.mission_id}`}>
                  Continue the originating Mission ↗
                </Link>
              )}
              {project && latest && (
                <VerifiedBuilds
                  projectId={project.id}
                  versionId={latest.id}
                  eligible={Boolean(
                    latest.reviewed_at &&
                    !dirty &&
                    !historical &&
                    !busy &&
                    !locked &&
                    data.canCreate,
                  )}
                />
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

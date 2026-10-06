'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { readWork } from '@/domains/company-work/service';
import { emptyWork, type WorkContent } from '@/domains/company-work/schema';
import type { SlideLayout } from '@/domains/company-work/presentation';
type WorkData = Awaited<ReturnType<typeof readWork>>;
export function WorkPanel({
  work,
  busy,
  onChanged,
  onRevise,
}: {
  work: WorkData;
  busy: boolean;
  onChanged: (work: WorkData) => void;
  onRevise: () => void;
}) {
  const [selected, setSelected] = useState(work.versions[0]?.id ?? '');
  const version = work.versions.find((v) => v.id === selected) ?? work.versions[0];
  const [content, setContent] = useState<WorkContent>(
    version?.content ?? emptyWork(work.job.scope.request),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slides, setSlides] = useState<SlideLayout[]>([]);
  const [previewError, setPreviewError] = useState('');
  const [visual, setVisual] = useState('');
  const [visualMode, setVisualMode] = useState<'fast' | 'precise'>('fast');
  const [approved, setApproved] = useState(false);
  const [write, setWrite] = useState<{ method: string; body: unknown; path: string } | null>(null);
  const locked = busy || saving;
  const dirty =
    editing &&
    JSON.stringify(content) !==
      JSON.stringify(version?.content ?? emptyWork(work.job.scope.request));
  const query = new URLSearchParams({ companyId: work.job.company_id, jobId: work.job.id });
  useEffect(() => {
    if (!version) return;
    const controller = new AbortController();
    fetch(
      `/api/company-work?${new URLSearchParams({ companyId: work.job.company_id, jobId: work.job.id, versionId: version.id, format: 'preview' })}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Preview unavailable.');
        setSlides(result.slides);
        setPreviewError('');
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setSlides([]);
          setPreviewError(e instanceof Error ? e.message : 'Preview unavailable.');
        }
      });
    return () => controller.abort();
  }, [version, work.job.company_id, work.job.id]);
  async function mutate(method: string, body: unknown, path = '/api/company-work') {
    setSaving(true);
    setError('');
    setWrite({ method, body, path });
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error ?? 'Save not confirmed.');
      onChanged(next);
      setSelected(next.versions[0]?.id ?? '');
      setEditing(false);
      setWrite(null);
      setApproved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save not confirmed.');
    } finally {
      setSaving(false);
    }
  }
  const identity = { companyId: work.job.company_id, jobId: work.job.id };
  function edit() {
    setContent(version?.content ?? emptyWork(work.job.scope.request));
    setEditing(true);
    setError('');
  }
  const field = (
    key: 'title' | 'summary' | 'positioning' | 'offer',
    label: string,
    max: number,
  ) => (
    <label key={key}>
      {label}
      <textarea
        required
        rows={key === 'title' ? 1 : 3}
        maxLength={max}
        value={content[key]}
        onChange={(e) => setContent((c) => ({ ...c, [key]: e.target.value }))}
      />
    </label>
  );
  const updateSlide = (index: number, patch: Partial<WorkContent['slides'][number]>) =>
    setContent((c) => ({
      ...c,
      slides: c.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  return (
    <section className="company-deliverable" aria-labelledby="deliverable-title">
      <header>
        <span className="eyebrow">SAVED COMPANY JOB · BRIEF v{work.job.brief_version}</span>
        <h2 id="deliverable-title">{version?.content.title ?? work.job.scope.request}</h2>
        <p>{work.job.scope.outcome}</p>
      </header>
      <details>
        <summary>Retained scope and evidence</summary>
        <p>{work.job.scope.request}</p>
        <p>Audience: {work.job.scope.audience}</p>
        <p>Acceptance: {work.job.scope.acceptance}</p>
        {work.job.scope.constraints && <p>Constraints: {work.job.scope.constraints}</p>}
        <p>{work.job.company_brief}</p>
        {work.job.scope.evidence.map((e, i) => (
          <p key={i}>
            <strong>{e.label}</strong>: {e.detail}
          </p>
        ))}
        {work.job.scope.figures.map((f) => (
          <p key={f.id}>
            {f.label}: {f.value} · {f.source}
          </p>
        ))}
      </details>
      <div className="company-room-actions">
        <button disabled={locked || dirty || Boolean(write)} onClick={onRevise}>
          {version ? 'Revise with Talk' : 'Draft brief and slides'}
        </button>
        <button disabled={locked || Boolean(write)} onClick={edit}>
          {version ? 'Edit deliverable' : 'Write deliverable'}
        </button>
        {version && (
          <label>
            Saved version
            <select
              value={version.id}
              disabled={locked || dirty}
              onChange={(e) => {
                setSelected(e.target.value);
                setEditing(false);
              }}
            >
              {work.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.revision} · {v.reviewed_at ? 'reviewed' : 'draft'} · {v.source}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate('PATCH', {
              ...identity,
              versionId: crypto.randomUUID(),
              expected: work.job.revision,
              content,
            });
          }}
        >
          <fieldset disabled={locked || Boolean(write)}>
            {field('title', 'Title', 100)}
            {field('summary', 'Strategy summary', 2000)}
            {field('positioning', 'Positioning', 1500)}
            {field('offer', 'Offer', 1500)}
            <label>
              Next steps (one per line)
              <textarea
                required
                value={content.actions.join('\n')}
                onChange={(e) => setContent((c) => ({ ...c, actions: e.target.value.split('\n') }))}
              />
            </label>
            <label>
              Unknowns and evidence gaps (one per line)
              <textarea
                value={content.gaps.join('\n')}
                onChange={(e) =>
                  setContent((c) => ({
                    ...c,
                    gaps: e.target.value ? e.target.value.split('\n') : [],
                  }))
                }
              />
            </label>
            <h3>Presentation</h3>
            {content.slides.map((slide, i) => (
              <details key={i} open={i === 0}>
                <summary>
                  Slide {i + 1}: {slide.title}
                </summary>
                <label>
                  Slide title
                  <input
                    required
                    maxLength={90}
                    value={slide.title}
                    onChange={(e) => updateSlide(i, { title: e.target.value })}
                  />
                </label>
                <label>
                  Main message
                  <textarea
                    required
                    maxLength={700}
                    value={slide.body}
                    onChange={(e) => updateSlide(i, { body: e.target.value })}
                  />
                </label>
                <label>
                  Bullets (up to four, one per line)
                  <textarea
                    value={slide.bullets.join('\n')}
                    onChange={(e) =>
                      updateSlide(i, { bullets: e.target.value ? e.target.value.split('\n') : [] })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Confirmed figures (up to three)</legend>
                  {work.job.scope.figures.map((f) => (
                    <label key={f.id}>
                      <input
                        type="checkbox"
                        checked={slide.figureIds.includes(f.id)}
                        onChange={(e) =>
                          updateSlide(i, {
                            figureIds: e.target.checked
                              ? [...slide.figureIds, f.id]
                              : slide.figureIds.filter((id) => id !== f.id),
                          })
                        }
                      />
                      {f.label}: {f.value}
                    </label>
                  ))}
                </fieldset>
                <label>
                  Private speaker notes · excluded from PDF
                  <textarea
                    maxLength={700}
                    value={slide.notes}
                    onChange={(e) => updateSlide(i, { notes: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  disabled={content.slides.length === 1}
                  onClick={() =>
                    setContent((c) => ({ ...c, slides: c.slides.filter((_, n) => n !== i) }))
                  }
                >
                  Remove slide
                </button>
              </details>
            ))}
            <button
              type="button"
              disabled={content.slides.length >= 12}
              onClick={() =>
                setContent((c) => ({
                  ...c,
                  slides: [
                    ...c.slides,
                    {
                      title: 'New slide',
                      body: 'Define the main message.',
                      bullets: [],
                      figureIds: [],
                      notes: '',
                    },
                  ],
                }))
              }
            >
              Add slide
            </button>
            <div className="company-room-actions">
              <button className="button">Save new version</button>
              <button type="button" onClick={() => setEditing(false)}>
                Cancel edits
              </button>
            </div>
          </fieldset>
        </form>
      ) : version ? (
        <>
          <div className="company-strategy">
            <h3>Strategy brief</h3>
            <p>{version.content.summary}</p>
            <h4>Positioning</h4>
            <p>{version.content.positioning}</p>
            <h4>Offer</h4>
            <p>{version.content.offer}</p>
            <h4>Next steps</h4>
            <ol>
              {version.content.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
            {version.content.gaps.length > 0 && (
              <>
                <h4>Evidence gaps</h4>
                <ul>
                  {version.content.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <h3>Presentation preview · saved v{version.revision}</h3>
          <p>Preview and PDF use the same layout. Private speaker notes are excluded.</p>
          {slides.map((slide, i) => (
            <svg
              className="company-slide"
              role="img"
              aria-label={`Slide ${i + 1}: ${version.content.slides[i]?.title}`}
              key={i}
              viewBox={`0 0 ${slide.width} ${slide.height}`}
            >
              <rect width="960" height="540" fill="#050a08" />
              {slide.lines.map((line, n) => (
                <text
                  key={n}
                  x={line.x}
                  y={line.y}
                  fontSize={line.size}
                  fill={
                    line.kind === 'figure' || line.kind === 'footer'
                      ? '#dbc075'
                      : line.kind === 'source'
                        ? '#a5b7a9'
                        : '#efefe6'
                  }
                >
                  {line.text}
                </text>
              ))}
            </svg>
          ))}
          {previewError && <p role="alert">{previewError}</p>}
          <div className="company-room-actions">
            {!version.reviewed_at ? (
              <button
                disabled={locked || !!previewError || !slides.length || Boolean(write)}
                onClick={() => void mutate('PUT', { ...identity, versionId: version.id })}
              >
                Mark this version reviewed
              </button>
            ) : (
              <a
                className="button"
                href={`/api/company-work?${query}&versionId=${version.id}&format=pdf`}
              >
                Export reviewed PDF · v{version.revision}
              </a>
            )}
          </div>
        </>
      ) : (
        <p>No deliverable saved yet. Draft with Talk or write the first version yourself.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {write && !saving && (
        <div className="company-room-actions">
          <button disabled={busy} onClick={() => void mutate(write.method, write.body, write.path)}>
            Retry exact save
          </button>
          <button disabled={busy} onClick={() => setWrite(null)}>
            Keep edits and dismiss retry
          </button>
        </div>
      )}
      <details className="company-visuals">
        <summary>Studio visuals for this job</summary>
        <p>
          Generate only after reviewing the prompt. Existing Studio quotas apply. Paid provider
          usage may be incurred. Visuals remain private job assets; they are not automatically
          placed in slides.
        </p>
        <label>
          Visual request
          <textarea
            maxLength={3000}
            value={visual}
            disabled={locked || Boolean(write)}
            onChange={(e) => {
              setVisual(e.target.value);
              setApproved(false);
            }}
          />
        </label>
        <label>
          Production mode
          <select
            value={visualMode}
            disabled={locked || Boolean(write)}
            onChange={(e) => {
              setVisualMode(e.target.value as 'fast' | 'precise');
              setApproved(false);
            }}
          >
            <option value="fast">Fast</option>
            <option value="precise">Precise</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={approved}
            disabled={locked || Boolean(write)}
            onChange={(e) => setApproved(e.target.checked)}
          />
          Approve one generation with this prompt and mode
        </label>
        <button
          disabled={locked || !approved || visual.trim().length < 3 || Boolean(write)}
          onClick={() =>
            void mutate(
              'POST',
              {
                ...identity,
                requestId: crypto.randomUUID(),
                prompt: visual,
                mode: visualMode,
                approved: true,
              },
              '/api/company-work/visual',
            )
          }
        >
          Generate approved visual
        </button>
        {work.assets.map((asset) => (
          <figure key={asset.id}>
            {asset.status === 'complete' ? (
              <Image
                unoptimized
                width={1536}
                height={1024}
                src={`/api/company-work/visual?${query}&assetId=${asset.id}`}
                alt={asset.prompt}
                loading="lazy"
              />
            ) : (
              <p>{asset.status} · Reload to check this generation receipt.</p>
            )}
            <figcaption>
              {asset.prompt} · {asset.status}
            </figcaption>
          </figure>
        ))}
      </details>
    </section>
  );
}

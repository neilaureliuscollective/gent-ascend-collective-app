'use client';
import { useMemo, useState } from 'react';
import {
  emptyComposition,
  parseComposition,
  compositionDuration,
  compositionFrame,
  type CompositionDocument,
  type CompositionScene,
} from '@/domains/studio/composition/model';

type SavedComposition = {
  id: string;
  title: string;
  revision: number;
  updated_at: string;
  document: CompositionDocument;
};
type Version = { id: string; status: string };
type Footage = { id: string; title: string; duration: number; ratio: string; status: string };
type Narration = { id: string; title: string; duration: number | null; status: string };
type RenderJob = {
  id: string;
  composition_id: string;
  revision_id: string;
  status: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  failure_code: string | null;
};

async function json<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Studio could not complete the request.');
  return value as T;
}

export function FilmWorkspace({
  projectId,
  compositions,
  versions,
  footage,
  narrations,
  renders,
  renderHosted,
  onChanged,
}: {
  projectId: string;
  compositions: SavedComposition[];
  versions: Version[];
  footage: Footage[];
  narrations: Narration[];
  renders: RenderJob[];
  renderHosted: string;
  onChanged: () => void;
}) {
  const [currentId, setCurrentId] = useState(compositions[0]?.id ?? null);
  const saved = compositions.find((item) => item.id === currentId) ?? compositions[0] ?? null;
  const [draft, setDraft] = useState<{
    id: string;
    document: CompositionDocument;
    revision: number;
    updatedAt: string | null;
  } | null>(null);
  const live = useMemo(() => {
    if (draft && saved && draft.id === saved.id) return draft;
    if (!saved) return null;
    return {
      id: saved.id,
      document: parseComposition(saved.document),
      revision: saved.revision,
      updatedAt: saved.updated_at,
    };
  }, [draft, saved]);
  const document = live?.document ?? null;
  const revision = live?.revision ?? 0;
  const updatedAt = live?.updatedAt ?? null;
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'none' | 'assets' | 'inspect'>('none');
  function setDocument(next: CompositionDocument | null) {
    if (!next) {
      setDraft(null);
      return;
    }
    setDraft({
      id: next.id,
      document: next,
      revision: live?.id === next.id ? revision : 0,
      updatedAt: live?.id === next.id ? updatedAt : null,
    });
  }

  const scene = document?.scenes[active] ?? document?.scenes[0];
  const frame = document ? compositionFrame(document.aspect) : compositionFrame('landscape');
  const duration = document ? compositionDuration(document) : 0;
  const previewSrc = useMemo(() => {
    if (!scene) return '';
    if (scene.kind === 'image')
      return `/api/studio/image?id=${scene.assetId}&kind=${scene.assetKind === 'reference' ? 'reference' : 'version'}`;
    return `/api/studio/footage/video?id=${scene.assetId}`;
  }, [scene]);

  async function persist(next = document, freeze = false) {
    if (!next) return;
    const savedRow = await json<{ id: string; revision: number; updated_at: string }>(
      await fetch('/api/studio/film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: next.id,
          projectId,
          title: next.title,
          document: next,
          updatedAt,
          revision,
        }),
      }),
    );
    setCurrentId(savedRow.id);
    setDraft({
      id: savedRow.id,
      document: next,
      revision: savedRow.revision,
      updatedAt: savedRow.updated_at,
    });
    if (freeze)
      return json<{ revisionId: string }>(
        await fetch('/api/studio/film/revision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compositionId: next.id }),
        }),
      );
    onChanged();
    return savedRow;
  }

  function addScene(assetId: string, kind: CompositionScene['kind'], assetKind: CompositionScene['assetKind']) {
    const scene: CompositionScene = {
      id: crypto.randomUUID(),
      kind,
      assetId,
      assetKind,
      name: `Scene ${(document?.scenes.length ?? 0) + 1}`,
      inMs: 0,
      outMs: kind === 'video' ? 5000 : 3000,
      durationMs: 3000,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      placement: { x: 0, y: 0, width: 1, height: 1 },
      transition: 'cut',
      stillMotion: 'none',
    };
    if (document) {
      const next = { ...document, scenes: [...document.scenes, scene] };
      setDocument(next);
      setActive(next.scenes.length - 1);
      void persist(next);
      return;
    }
    const created = emptyComposition({
      id: crypto.randomUUID(),
      title: 'Studio film',
      aspect: 'landscape',
      scene,
    });
    created.captions = [
      {
        id: crypto.randomUUID(),
        startMs: 400,
        endMs: 2400,
        text: 'Aethelios Studio',
      },
    ];
    setDocument(created);
    setCurrentId(created.id);
    void persist(created);
  }

  async function renderFilm() {
    if (!document) return;
    setError('');
    const frozen = await persist(document, true);
    const revisionId = frozen && 'revisionId' in frozen ? frozen.revisionId : null;
    if (!revisionId) throw new Error('The film revision could not be frozen.');
    const result = await json<{ id: string; status: string; note?: string; durationMs?: number }>(
      await fetch('/api/studio/film/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          compositionId: document.id,
          revisionId,
          id: crypto.randomUUID(),
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    );
    setStatus(
      result.status === 'complete'
        ? `Rendered ${result.durationMs}ms H.264 film from the pinned revision.`
        : result.note || `Render ${result.status}.`,
    );
    onChanged();
  }

  return (
    <div className="studio-workbench">
      <div className="studio-workbench-toolbar imperial-control-surface">
        <label>
          Production
          <select value={currentId ?? ''} onChange={(event) => setCurrentId(event.target.value || null)}>
            {compositions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · r{item.revision}
              </option>
            ))}
          </select>
        </label>
        <label>
          Aspect
          <select
            value={document?.aspect ?? 'landscape'}
            disabled={!document}
            onChange={(event) =>
              document &&
              setDocument({ ...document, aspect: event.target.value as CompositionDocument['aspect'] })
            }
          >
            <option value="landscape">Landscape 16:9</option>
            <option value="portrait">Portrait 9:16</option>
            <option value="square">Square 1:1</option>
          </select>
        </label>
        <button type="button" className="button" onClick={() => void persist(document)} disabled={!document}>
          Save
        </button>
        <button type="button" className="button" onClick={() => void renderFilm().catch((err) => setError(err.message))} disabled={!document}>
          Render film
        </button>
        <button type="button" className="studio-sheet-toggle" onClick={() => setSheet('assets')}>
          Assets
        </button>
        <button type="button" className="studio-sheet-toggle" onClick={() => setSheet('inspect')}>
          Inspector
        </button>
      </div>
      {renderHosted !== 'implemented' && (
        <p className="studio-dimension-banner">
          Hosted rendering is unavailable. Local FFmpeg 6.1+ with libx264/aac can render on this machine. A render is
          never marked complete without a real output.
        </p>
      )}
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      {status && <p className="studio-workbench-status">{status}</p>}
      <div className="studio-workbench-grid">
        <aside className={`studio-asset-rail ${sheet === 'assets' ? 'is-open' : ''}`}>
          <h3>Owned media</h3>
          {versions
            .filter((version) => version.status === 'complete')
            .map((version) => (
              <button key={version.id} type="button" onClick={() => addScene(version.id, 'image', 'version')}>
                Still as scene
              </button>
            ))}
          {footage
            .filter((clip) => clip.status === 'complete')
            .map((clip) => (
              <button key={clip.id} type="button" onClick={() => addScene(clip.id, 'video', 'footage')}>
                {clip.title}
              </button>
            ))}
        </aside>
        <div className="studio-canvas-column">
          <div
            className="studio-film-preview"
            style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
            data-aspect={document?.aspect ?? 'landscape'}
          >
            {scene?.kind === 'video' ? (
              <video key={previewSrc} src={previewSrc} controls playsInline />
            ) : previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="Active scene" />
            ) : (
              <p>Choose an owned still or clip to start a film.</p>
            )}
          </div>
          <ol className="studio-timeline">
            {document?.scenes.map((item, index) => (
              <li key={item.id}>
                <button type="button" aria-pressed={index === active} onClick={() => setActive(index)}>
                  {item.name} · {item.durationMs}ms
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (index === 0) return;
                    const next = { ...document, scenes: [...document.scenes] };
                    const swap = next.scenes[index - 1]!;
                    next.scenes[index - 1] = item;
                    next.scenes[index] = swap;
                    setDocument(next);
                    setActive(index - 1);
                  }}
                >
                  Up
                </button>
              </li>
            ))}
          </ol>
        </div>
        <aside className={`studio-inspector ${sheet === 'inspect' ? 'is-open' : ''}`}>
          <h3>Scene</h3>
          {scene && document && (
            <div className="studio-inspector-fields">
              <label>
                Name
                <input
                  value={scene.name}
                  onChange={(event) => {
                    const next = { ...document, scenes: document.scenes.map((item) => (item.id === scene.id ? { ...item, name: event.target.value } : item)) };
                    setDocument(next);
                  }}
                />
              </label>
              <label>
                Duration ms
                <input
                  type="number"
                  value={scene.durationMs}
                  onChange={(event) => {
                    const durationMs = Number(event.target.value);
                    setDocument({
                      ...document,
                      scenes: document.scenes.map((item) => (item.id === scene.id ? { ...item, durationMs } : item)),
                    });
                  }}
                />
              </label>
              <label>
                In ms
                <input
                  type="number"
                  value={scene.inMs}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      scenes: document.scenes.map((item) =>
                        item.id === scene.id ? { ...item, inMs: Number(event.target.value) } : item,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Out ms
                <input
                  type="number"
                  value={scene.outMs}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      scenes: document.scenes.map((item) =>
                        item.id === scene.id ? { ...item, outMs: Number(event.target.value) } : item,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Still motion
                <select
                  value={scene.stillMotion}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      scenes: document.scenes.map((item) =>
                        item.id === scene.id
                          ? { ...item, stillMotion: event.target.value as CompositionScene['stillMotion'] }
                          : item,
                      ),
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="slow-zoom">Slow zoom</option>
                </select>
              </label>
              <label>
                Transition
                <select
                  value={scene.transition}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      scenes: document.scenes.map((item) =>
                        item.id === scene.id
                          ? { ...item, transition: event.target.value as CompositionScene['transition'] }
                          : item,
                      ),
                    })
                  }
                >
                  <option value="cut">Cut</option>
                  <option value="dissolve">Dissolve</option>
                </select>
              </label>
              <label>
                Narration
                <select
                  value={document.narration?.assetId ?? ''}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      narration: event.target.value
                        ? { assetId: event.target.value, assetKind: 'narration', gainDb: 0, fadeInMs: 80, fadeOutMs: 200 }
                        : null,
                    })
                  }
                >
                  <option value="">None</option>
                  {narrations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Music (owned WAV)
                <select
                  value={document.music?.assetId ?? ''}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      music: event.target.value
                        ? { assetId: event.target.value, assetKind: 'music', gainDb: -6, fadeInMs: 200, fadeOutMs: 400 }
                        : null,
                    })
                  }
                >
                  <option value="">None</option>
                  {narrations.map((item) => (
                    <option key={`music-${item.id}`} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Caption
                <textarea
                  value={document.captions[0]?.text ?? ''}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      captions: [
                        {
                          id: document.captions[0]?.id ?? crypto.randomUUID(),
                          startMs: 400,
                          endMs: Math.min(duration, 4000),
                          text: event.target.value,
                        },
                      ],
                    })
                  }
                />
              </label>
            </div>
          )}
          <div className="studio-export-actions">
            <p>Renders bind to the frozen revision. Generation jobs are never retried by a render.</p>
            {renders.map((job) => (
              <p key={job.id}>
                {job.status}
                {job.status === 'complete' && (
                  <>
                    {' '}
                    <a href={`/api/studio/film/file?id=${job.id}&kind=film`} target="_blank" rel="noreferrer">
                      Open MP4
                    </a>
                    {' · '}
                    <a href={`/api/studio/film/file?id=${job.id}&kind=cover`} target="_blank" rel="noreferrer">
                      Cover
                    </a>
                    {' · '}
                    <a href={`/api/studio/film/file?id=${job.id}&kind=captions`} target="_blank" rel="noreferrer">
                      Captions
                    </a>
                  </>
                )}
              </p>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

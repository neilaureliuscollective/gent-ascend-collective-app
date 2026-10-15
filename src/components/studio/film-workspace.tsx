'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyComposition,
  parseComposition,
  compositionDuration,
  type CompositionDocument,
  type CompositionScene,
} from '@/domains/studio/composition/model';
import { compositionPlaybackMs } from '@/domains/studio/composition/timing';
import { FilmPreview } from './film-preview';
import { acknowledgedSave } from '@/domains/studio/design/save-ack';
import {
  createSerialLock,
  draftAfterFailedSave,
  draftStorageKey,
  interpretLocalDraft,
  rebaseDraftForExplicitKeep,
  writeLocalDraft,
} from '@/domains/studio/design/local-draft';

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

function filmDraftKey(id: string) {
  return draftStorageKey('film', id);
}

function readStoredFilm(row: SavedComposition | undefined) {
  if (!row || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(filmDraftKey(row.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      document: CompositionDocument;
      revision: number;
      updatedAt?: string | null;
    };
    const recovered = interpretLocalDraft(parsed, { document: row.document, revision: row.revision });
    if (!recovered) return null;
    return {
      id: row.id,
      document: parseComposition(recovered.document),
      revision: recovered.baseRevision,
      updatedAt: recovered.updatedAt,
      kind: recovered.kind,
    };
  } catch {
    sessionStorage.removeItem(filmDraftKey(row.id));
    return null;
  }
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
  } | null>(() => {
    const recovered = readStoredFilm(compositions[0]);
    return recovered
      ? {
          id: recovered.id,
          document: recovered.document,
          revision: recovered.revision,
          updatedAt: recovered.updatedAt,
        }
      : null;
  });
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
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saved' | 'local-draft' | 'conflict' | 'error'>(
    () => {
      const recovered = readStoredFilm(compositions[0]);
      if (!recovered) return 'idle';
      return recovered.kind === 'reconcile' ? 'conflict' : 'local-draft';
    },
  );
  const [sheet, setSheet] = useState<'none' | 'assets' | 'inspect'>('none');
  const liveRef = useRef(live);
  const persistGen = useRef(0);
  const dirty = useRef(readStoredFilm(compositions[0])?.kind === 'unsaved');
  const pauseAutosave = useRef(readStoredFilm(compositions[0])?.kind === 'reconcile');
  const serial = useRef(createSerialLock());
  const renderKeys = useRef(new Map<string, { jobId: string; key: string }>());
  useEffect(() => {
    liveRef.current = live;
  });
  function setDocument(next: CompositionDocument | null) {
    persistGen.current += 1;
    dirty.current = true;
    if (!next) {
      liveRef.current = null;
      setDraft(null);
      return;
    }
    const row = {
      id: next.id,
      document: next,
      revision: liveRef.current?.id === next.id ? liveRef.current.revision : live?.id === next.id ? revision : 0,
      updatedAt: liveRef.current?.id === next.id ? liveRef.current.updatedAt : live?.id === next.id ? updatedAt : null,
    };
    liveRef.current = row;
    setDraft(row);
    setSaveState((current) => (current === 'conflict' ? current : 'local-draft'));
  }

  const scene = document?.scenes[active] ?? document?.scenes[0];
  const duration = document ? compositionDuration(document) : 0;
  const playback = document ? compositionPlaybackMs(document) : 0;

  async function persist(kind: 'autosave' | 'explicit' = 'autosave', freeze = false) {
    if (pauseAutosave.current && kind === 'autosave') return;
    return serial.current(async () => {
      const snapshot = liveRef.current;
      if (!snapshot) return;
      if (pauseAutosave.current && kind === 'autosave') return;
      dirty.current = false;
      const seq = ++persistGen.current;
      const sent = snapshot.document;
      setSaveState('pending');
      setError('');
      try {
        const savedRow = await json<{ id: string; revision: number; updated_at: string; revision_id?: string }>(
          await fetch('/api/studio/film', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: sent.id,
              projectId,
              title: sent.title,
              document: sent,
              updatedAt: snapshot.updatedAt,
              revision: snapshot.revision,
              freeze,
            }),
          }),
        );
        const current = liveRef.current;
        const ack = acknowledgedSave({
          requestSeq: seq,
          latestSeq: persistGen.current,
          requestId: sent.id,
          currentId: current?.id ?? null,
          serverRevision: savedRow.revision,
          serverUpdatedAt: savedRow.updated_at,
        });
        if (!ack.apply) {
          setSaveState('idle');
          return savedRow;
        }
        if (ack.keepLocalEdits && current && current.id === sent.id) {
          const kept = { ...current, revision: ack.revision, updatedAt: ack.updatedAt };
          liveRef.current = kept;
          setDraft(kept);
          setSaveState('local-draft');
          setStatus('Newer film edits kept locally. The earlier snapshot was not applied.');
          writeLocalDraft(sessionStorage, filmDraftKey(sent.id), kept);
          return savedRow;
        }
        const applied = {
          id: savedRow.id,
          document: current && current.id === sent.id ? current.document : sent,
          revision: ack.revision,
          updatedAt: ack.updatedAt,
        };
        liveRef.current = applied;
        setCurrentId(savedRow.id);
        setDraft(applied);
        setSaveState('saved');
        sessionStorage.removeItem(filmDraftKey(sent.id));
        setStatus(kind === 'explicit' ? 'Revision saved on the server.' : 'Saved.');
        if (freeze) {
          if (!savedRow.revision_id) throw new Error('The exact accepted film revision was not returned.');
          onChanged();
          return { revisionId: savedRow.revision_id };
        }
        onChanged();
        return savedRow;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Film could not be saved.';
        setSaveState(message.includes('changed elsewhere') ? 'conflict' : 'error');
        setError(message);
        const latest = draftAfterFailedSave({
          failed: snapshot,
          live: liveRef.current?.id === snapshot.id ? liveRef.current : null,
        });
        writeLocalDraft(sessionStorage, filmDraftKey(snapshot.id), latest);
        throw err;
      }
    });
  }

  const documentJson = live ? JSON.stringify(live.document) : '';
  useEffect(() => {
    if (!live) return;
    writeLocalDraft(sessionStorage, filmDraftKey(live.id), live);
    if (pauseAutosave.current) return;
    if (!dirty.current) return;
    const timer = window.setTimeout(() => void persist('autosave').catch(() => undefined), 900);
    return () => window.clearTimeout(timer);
    // persist reads liveRef; documentJson is the dirty signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentJson]);

  function recoverLocalFilm(row: SavedComposition) {
    const recovered = readStoredFilm(row);
    if (!recovered) {
      pauseAutosave.current = false;
      return;
    }
    const next = {
      id: recovered.id,
      document: recovered.document,
      revision: recovered.revision,
      updatedAt: recovered.updatedAt,
    };
    liveRef.current = next;
    setDraft(next);
    if (recovered.kind === 'reconcile') {
      pauseAutosave.current = true;
      setSaveState('conflict');
      setStatus(
        `Recovered a local film draft based on revision ${recovered.revision}; the server is at revision ${row.revision}. Reconcile before saving so this cannot overwrite newer work.`,
      );
      return;
    }
    pauseAutosave.current = false;
    dirty.current = true;
    setSaveState('local-draft');
    setStatus('Recovered a local film draft. It is not server-durable until save is acknowledged.');
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
      void persist('explicit').catch(() => undefined);
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
    void persist('explicit').catch(() => undefined);
  }

  async function renderFilm() {
    if (!document) return;
    setError('');
    const frozen = await persist('explicit', true);
    const revisionId = frozen && 'revisionId' in frozen ? frozen.revisionId : null;
    if (!revisionId) throw new Error('The film revision could not be frozen.');
    const slot = `${document.id}:${revisionId}`;
    const ids = renderKeys.current.get(slot) ?? { jobId: crypto.randomUUID(), key: crypto.randomUUID() };
    renderKeys.current.set(slot, ids);
    const result = await json<{ id: string; status: string; note?: string; durationMs?: number }>(
      await fetch('/api/studio/film/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          compositionId: document.id,
          revisionId,
          id: ids.jobId,
          idempotencyKey: ids.key,
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
          <select
            value={currentId ?? ''}
            onChange={(event) => {
              const nextId = event.target.value || null;
              persistGen.current += 1;
              void (async () => {
                if (live && live.id !== nextId && (dirty.current || saveState === 'pending' || saveState === 'local-draft')) {
                  try {
                    await persist('autosave');
                  } catch {
                    setStatus('Unsaved film work stays in this browser until save is acknowledged.');
                  }
                }
                setDraft(null);
                setCurrentId(nextId);
                const row = compositions.find((item) => item.id === nextId);
                if (row) recoverLocalFilm(row);
              })();
            }}
          >
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
        <button
          type="button"
          className="button"
          onClick={() => void persist('explicit').catch(() => undefined)}
          disabled={!document || saveState === 'conflict'}
        >
          Save
        </button>
        <button
          type="button"
          className="button"
          onClick={() => void renderFilm().catch((err) => setError(err.message))}
          disabled={!document || saveState === 'conflict'}
        >
          Render film
        </button>
        <button
          type="button"
          onClick={() => {
            const job = renders.find((item) => item.status === 'queued' || item.status === 'running');
            if (!job) return;
            void (async () => {
              await json(
                await fetch('/api/studio/film/render', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: job.id, action: 'cancel' }),
                }),
              );
              for (const [slot, ids] of renderKeys.current) {
                if (ids.jobId === job.id) renderKeys.current.delete(slot);
              }
              onChanged();
            })();
          }}
          disabled={!renders.some((job) => job.status === 'queued' || job.status === 'running')}
        >
          Cancel render
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
      {(status || saveState !== 'idle') && (
        <p className="studio-workbench-status" data-save-state={saveState} role="status">
          {saveState === 'pending'
            ? 'Saving…'
            : saveState === 'conflict'
              ? status || 'Conflict — this recovered film draft is not the current server revision.'
              : saveState === 'local-draft'
                ? status || 'Local film draft — not server-durable until acknowledged.'
                : saveState === 'saved'
                  ? status || 'Saved.'
                  : saveState === 'error'
                    ? status || error || 'Save failed.'
                    : status}
        </p>
      )}
      {saveState === 'conflict' && live && saved && (
        <div className="studio-export-actions">
          <button
            type="button"
            onClick={() => {
              pauseAutosave.current = false;
              const rebased = {
                ...live,
                ...rebaseDraftForExplicitKeep({
                  document: live.document,
                  updatedAt: live.updatedAt,
                  serverRevision: saved.revision,
                  serverUpdatedAt: saved.updated_at,
                }),
              };
              liveRef.current = rebased;
              setDraft(rebased);
              setSaveState('local-draft');
              setStatus('Keeping this film draft against the current server revision.');
              void persist('explicit').catch(() => undefined);
            }}
          >
            Keep this draft
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(filmDraftKey(live.id));
              pauseAutosave.current = false;
              setDraft(null);
              setSaveState('idle');
              setStatus('Loaded the server film revision. The recovered draft was discarded.');
            }}
          >
            Load server revision
          </button>
        </div>
      )}
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
          {document ? (
            <FilmPreview document={document} selectedSceneId={scene?.id ?? null} />
          ) : (
            <div className="studio-film-preview">
              <p>Choose an owned still or clip to start a film.</p>
            </div>
          )}
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
              {(['crop', 'placement'] as const).map((field) => (
                <fieldset key={field}>
                  <legend>{field}</legend>
                  {(['x', 'y', 'width', 'height'] as const).map((edge) => (
                    <label key={edge}>
                      {edge}
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={scene[field][edge]}
                        onChange={(event) =>
                          setDocument({
                            ...document,
                            scenes: document.scenes.map((item) =>
                              item.id === scene.id
                                ? {
                                    ...item,
                                    [field]: { ...item[field], [edge]: Number(event.target.value) },
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </fieldset>
              ))}
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
              {document.narration && (
                <label>
                  Narration gain dB
                  <input
                    type="number"
                    min={-24}
                    max={6}
                    value={document.narration.gainDb}
                    onChange={(event) =>
                      setDocument({
                        ...document,
                        narration: { ...document.narration!, gainDb: Number(event.target.value) },
                      })
                    }
                  />
                </label>
              )}
              {document.music && (
                <label>
                  Music gain dB
                  <input
                    type="number"
                    min={-24}
                    max={6}
                    value={document.music.gainDb}
                    onChange={(event) =>
                      setDocument({
                        ...document,
                        music: { ...document.music!, gainDb: Number(event.target.value) },
                      })
                    }
                  />
                </label>
              )}
              <label>
                Title
                <input
                  value={document.titles[0]?.text ?? ''}
                  onChange={(event) =>
                    setDocument({
                      ...document,
                      titles: event.target.value
                        ? [
                            {
                              id: document.titles[0]?.id ?? crypto.randomUUID(),
                              startMs: 0,
                              endMs: Math.min(playback, 2500),
                              text: event.target.value,
                              fontId: 'inter',
                            },
                          ]
                        : [],
                    })
                  }
                />
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

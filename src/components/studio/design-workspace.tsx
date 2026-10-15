'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { designPresets } from '@/domains/studio/design/presets';
import {
  cloneDocument,
  convertDocumentUnits,
  parseDesignDocument,
  type DesignDocument,
  type DesignLayer,
} from '@/domains/studio/design/document';
import { alignLayers, commitDesign, emptyHistory, redoDesign, undoDesign } from '@/domains/studio/design/commands';
import { designFontIds } from '@/domains/studio/design/fonts';
import { DEFAULT_PPI } from '@/domains/studio/design/units';
import { sanitizeSvg } from '@/domains/studio/design/sanitize';
import { acknowledgedSave } from '@/domains/studio/design/save-ack';

const DesignCanvas = dynamic(() => import('./design-canvas').then((module) => module.DesignCanvas), {
  ssr: false,
  loading: () => <p className="studio-room-loading">Opening the design canvas…</p>,
});

type SavedDesign = {
  id: string;
  title: string;
  revision: number;
  updated_at: string;
  document: DesignDocument;
};
type Version = { id: string; status: string; prompt?: string };
type Reference = { id: string };

async function json<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Studio could not complete the request.');
  return value as T;
}

function readLocalDraft(row: SavedDesign | undefined) {
  if (!row || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`studio-design-draft:${row.id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { document: DesignDocument; revision: number };
    if (parsed.revision > row.revision) return null;
    return {
      id: row.id,
      document: parseDesignDocument(parsed.document),
      revision: row.revision,
      updatedAt: row.updated_at,
      history: emptyHistory(),
    };
  } catch {
    sessionStorage.removeItem(`studio-design-draft:${row.id}`);
    return null;
  }
}

export function DesignWorkspace({
  projectId,
  designs,
  versions,
  references,
  onChanged,
}: {
  projectId: string;
  designs: SavedDesign[];
  versions: Version[];
  references: Reference[];
  onChanged: () => void;
}) {
  const [currentId, setCurrentId] = useState(designs[0]?.id ?? null);
  const saved = designs.find((item) => item.id === currentId) ?? designs[0] ?? null;
  const [draft, setDraft] = useState<{
    id: string;
    document: DesignDocument;
    revision: number;
    updatedAt: string | null;
    history: ReturnType<typeof emptyHistory>;
  } | null>(() => readLocalDraft(designs[0]));
  const live = useMemo(() => {
    if (draft && saved && draft.id === saved.id) return draft;
    if (!saved) return null;
    return {
      id: saved.id,
      document: parseDesignDocument(saved.document),
      revision: saved.revision,
      updatedAt: saved.updated_at,
      history: emptyHistory(),
    };
  }, [draft, saved]);
  const document = live?.document ?? null;
  const history = live?.history ?? emptyHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markedIds, setMarkedIds] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<
    'idle' | 'pending' | 'saved' | 'conflict' | 'error' | 'local-draft'
  >(() => (readLocalDraft(designs[0]) ? 'local-draft' : 'idle'));
  const [sheet, setSheet] = useState<'none' | 'assets' | 'inspect' | 'export'>('none');
  const persistGen = useRef(0);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const liveRef = useRef(live);
  const selected = document?.layers.find((layer) => layer.id === selectedId) ?? null;
  const alignedIds = markedIds.length > 1 ? markedIds : selectedId ? [selectedId] : [];

  const setLive = useCallback((next: NonNullable<typeof live>) => {
    setDraft(next);
  }, []);

  const apply = useCallback(
    (next: DesignDocument) => {
      if (!live) {
        setLive({
          id: next.id,
          document: next,
          revision: 0,
          updatedAt: null,
          history: emptyHistory(),
        });
        return;
      }
      const committed = commitDesign(document!, history, { type: 'replace', document: next });
      setLive({ ...live, document: committed.document, history: committed.history });
    },
    [document, history, live, setLive],
  );

  useEffect(() => {
    liveRef.current = live;
  });

  async function persist(kind: 'autosave' | 'explicit' = 'autosave') {
      const snapshot = liveRef.current;
      if (!snapshot) return;
      if (inFlight.current && kind === 'autosave') {
        dirty.current = true;
        return;
      }
      inFlight.current = true;
      dirty.current = false;
      const seq = ++persistGen.current;
      setSaveState('pending');
      setError('');
      try {
        const savedRow = await json<{ id: string; revision: number; updated_at: string }>(
          await fetch('/api/studio/design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: snapshot.id,
              projectId,
              title: snapshot.document.title,
              document: snapshot.document,
              updatedAt: snapshot.updatedAt,
              revision: snapshot.revision,
            }),
          }),
        );
        const current = liveRef.current;
        const ack = acknowledgedSave({
          requestSeq: seq,
          latestSeq: persistGen.current,
          requestId: snapshot.id,
          currentId: current?.id ?? null,
          serverRevision: savedRow.revision,
          serverUpdatedAt: savedRow.updated_at,
        });
        if (!ack.apply || !current) return savedRow;
        const next = { ...current, revision: ack.revision, updatedAt: ack.updatedAt };
        liveRef.current = next;
        if (ack.keepLocalEdits) {
          setDraft((existing) =>
            existing && existing.id === snapshot.id
              ? { ...existing, revision: ack.revision, updatedAt: ack.updatedAt }
              : existing,
          );
          setSaveState('local-draft');
          setStatus('Newer edits kept locally. The earlier revision is not this draft.');
        } else {
          setLive(next);
          setSaveState('saved');
          sessionStorage.removeItem(`studio-design-draft:${snapshot.id}`);
          setStatus(kind === 'explicit' ? 'Revision saved on the server.' : 'Saved.');
        }
        setCurrentId(savedRow.id);
        if (kind === 'explicit' && seq === persistGen.current && !ack.keepLocalEdits) {
          await json(
            await fetch('/api/studio/design/revision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ designId: snapshot.id }),
            }),
          );
        }
        if (!ack.keepLocalEdits) onChanged();
        return savedRow;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Design could not be saved.';
        setSaveState(message.includes('changed elsewhere') ? 'conflict' : 'error');
        setError(message);
        sessionStorage.setItem(
          `studio-design-draft:${snapshot.id}`,
          JSON.stringify({
            document: snapshot.document,
            revision: snapshot.revision,
            updatedAt: snapshot.updatedAt,
            recovered: false,
          }),
        );
        throw err;
      } finally {
        inFlight.current = false;
        if (dirty.current) void persist('autosave');
      }
  }

  const documentJson = live ? JSON.stringify(live.document) : '';
  useEffect(() => {
    if (!live) return;
    dirty.current = true;
    persistGen.current += 1;
    sessionStorage.setItem(
      `studio-design-draft:${live.id}`,
      JSON.stringify({ document: live.document, revision: live.revision, updatedAt: live.updatedAt }),
    );
    const timer = window.setTimeout(() => void persist('autosave').catch(() => undefined), 900);
    return () => window.clearTimeout(timer);
    // persist reads liveRef; documentJson is the dirty signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentJson]);

  useEffect(() => {
    const block = (event: BeforeUnloadEvent) => {
      if (saveState === 'pending' || saveState === 'local-draft' || saveState === 'error' || dirty.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', block);
    return () => window.removeEventListener('beforeunload', block);
  }, [saveState]);

  function recoverLocalDraft(row: SavedDesign) {
    try {
      const raw = sessionStorage.getItem(`studio-design-draft:${row.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { document: DesignDocument; revision: number };
      if (parsed.revision > row.revision) return;
      setDraft({
        id: row.id,
        document: parseDesignDocument(parsed.document),
        revision: row.revision,
        updatedAt: row.updated_at,
        history: emptyHistory(),
      });
      setSaveState('local-draft');
      setStatus('Recovered a local draft. It is not server-durable until save is acknowledged.');
    } catch {
      sessionStorage.removeItem(`studio-design-draft:${row.id}`);
    }
  }

  async function createFrom(presetId: string) {
    setError('');
    const created = await json<{ id: string; revision: number; updated_at: string; document: DesignDocument }>(
      await fetch('/api/studio/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, presetId }),
      }),
    );
    setCurrentId(created.id);
    setLive({
      id: created.id,
      document: parseDesignDocument(created.document),
      revision: created.revision,
      updatedAt: created.updated_at,
      history: emptyHistory(),
    });
    onChanged();
  }

  function addLayer(partial: DesignLayer) {
    if (!document) return;
    apply({ ...cloneDocument(document), layers: [...document.layers, partial] });
    setSelectedId(partial.id);
  }

  function addText() {
    if (!document) return;
    addLayer({
      id: crypto.randomUUID(),
      type: 'text',
      name: 'Text',
      parentId: null,
      visible: true,
      locked: false,
      opacity: 1,
      x: document.page.width * 0.1,
      y: document.page.height * 0.1,
      width: document.page.width * 0.7,
      height: document.page.height * 0.15,
      rotation: 0,
      content: 'Editable type',
      fontId: 'inter',
      fontSize: 28,
      fontWeight: 600,
      align: 'left',
      letterSpacing: 0,
      lineHeight: 1.2,
      fill: '#E6E7E2',
    });
  }

  function addShape(type: 'rect' | 'ellipse') {
    if (!document) return;
    addLayer({
      id: crypto.randomUUID(),
      type,
      name: type === 'rect' ? 'Rectangle' : 'Ellipse',
      parentId: null,
      visible: true,
      locked: false,
      opacity: 1,
      x: document.page.width * 0.2,
      y: document.page.height * 0.2,
      width: document.page.width * 0.4,
      height: document.page.height * 0.25,
      rotation: 0,
      fill: '#0B3B32',
      stroke: '#C4912F',
      strokeWidth: document.page.unit === 'px' ? 4 : 1,
      cornerRadius: 0,
    });
  }

  function addImage(assetId: string, kind: 'version' | 'reference') {
    if (!document) return;
    addLayer({
      id: crypto.randomUUID(),
      type: 'image',
      name: 'Artwork',
      parentId: null,
      visible: true,
      locked: false,
      opacity: 1,
      x: document.page.safe.left || document.page.width * 0.08,
      y: document.page.safe.top || document.page.height * 0.08,
      width: document.page.width * 0.5,
      height: document.page.height * 0.4,
      rotation: 0,
      assetId,
      assetKind: kind,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  async function exportFormat(format: 'png' | 'svg' | 'pdf') {
    if (!document) return;
    setError('');
    await persist('explicit');
    const revisionRow = await json<{ revisionId: string }>(
      await fetch('/api/studio/design/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId: document.id }),
      }),
    );
    const exported = await json<{
      id: string;
      width: number;
      height: number;
      ppi: number;
      issues: { message: string; code?: string }[];
    }>(
      await fetch('/api/studio/design/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          designId: document.id,
          revisionId: revisionRow.revisionId,
          format,
        }),
      }),
    );
    const warnings = (exported.issues ?? []).map((issue) => issue.message).join(' ');
    setStatus(
      `Exported ${format.toUpperCase()} at ${exported.width}×${exported.height} px / ${exported.ppi} PPI. RGB only — CMYK/PDF-X unavailable.${warnings ? ` Preflight: ${warnings}` : ''}`,
    );
    window.open(`/api/studio/design/file?id=${exported.id}`, '_blank', 'noopener');
  }

  function addSvgFile(file: File) {
    void file.text().then((text) => {
      try {
        const markup = sanitizeSvg(text);
        addLayer({
          id: crypto.randomUUID(),
          type: 'svg',
          name: file.name.replace(/\.svg$/i, '').slice(0, 40) || 'SVG',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: document!.page.width * 0.12,
          y: document!.page.height * 0.12,
          width: document!.page.width * 0.3,
          height: document!.page.height * 0.3,
          rotation: 0,
          markup,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That SVG cannot be used.');
      }
    });
  }

  const unconfirmed = document?.page.dimensionSource === 'unconfirmed';
  const imageUrl = useMemo(
    () => (id: string, kind: 'version' | 'reference') => `/api/studio/image?id=${id}&kind=${kind}`,
    [],
  );

  return (
    <div className="studio-workbench">
      <div className="studio-workbench-toolbar imperial-control-surface">
        <label>
          Document
          <select
            value={currentId ?? ''}
            onChange={(event) => {
              const nextId = event.target.value || null;
              void (async () => {
                if (live && live.id !== nextId && (dirty.current || saveState === 'pending' || saveState === 'local-draft')) {
                  try {
                    await persist('autosave');
                  } catch {
                    setStatus('Unsaved work stays in this browser until save is acknowledged.');
                  }
                }
                setDraft(null);
                setCurrentId(nextId);
                const row = designs.find((item) => item.id === nextId);
                if (row) recoverLocalDraft(row);
              })();
            }}
          >
            {designs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · r{item.revision}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start from
          <select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) void createFrom(event.target.value);
              event.target.value = '';
            }}
          >
            <option value="">New document…</option>
            {designPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addText} disabled={!document}>
          Text
        </button>
        <button type="button" onClick={() => addShape('rect')} disabled={!document}>
          Shape
        </button>
        <button type="button" onClick={() => addShape('ellipse')} disabled={!document}>
          Ellipse
        </button>
        <button
          type="button"
          onClick={() => {
            const result = undoDesign(document!, history);
            setLive({ ...live!, document: result.document, history: result.history });
          }}
          disabled={!document || history.past.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => {
            const result = redoDesign(document!, history);
            setLive({ ...live!, document: result.document, history: result.history });
          }}
          disabled={!document || history.future.length === 0}
        >
          Redo
        </button>
        <button type="button" className="button" onClick={() => void persist('explicit').catch(() => undefined)} disabled={!document}>
          Save revision
        </button>
        <button type="button" className="studio-sheet-toggle" onClick={() => setSheet('assets')}>
          Assets
        </button>
        <button type="button" className="studio-sheet-toggle" onClick={() => setSheet('inspect')}>
          Inspector
        </button>
        <button type="button" className="studio-sheet-toggle" onClick={() => setSheet('export')}>
          Export
        </button>
      </div>
      {unconfirmed && (
        <p role="status" className="studio-dimension-banner">
          Dimensions are unconfirmed. Enter a printer or supplier die size before treating this as a print master.
        </p>
      )}
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      {status && (
        <p className="studio-workbench-status" data-save-state={saveState} role="status">
          {saveState === 'pending'
            ? 'Saving…'
            : saveState === 'conflict'
              ? 'Conflict — refresh or keep this local draft.'
              : saveState === 'local-draft'
                ? 'Local draft — not server-durable until acknowledged.'
                : saveState === 'saved'
                  ? status || 'Saved.'
                  : status}
        </p>
      )}
      {!document ? (
        <div className="studio-empty">
          <p className="eyebrow">DESIGN</p>
          <h3>Start a document with real type and layers.</h3>
          <p>Choose a verified paper size, an unconfirmed label canvas, or a Finish pixel preset.</p>
        </div>
      ) : (
        <div className="studio-workbench-grid">
          <aside className={`studio-asset-rail ${sheet === 'assets' ? 'is-open' : ''}`}>
            <h3>Assets</h3>
            <p>Add owned images without generating a new paid original.</p>
            {versions
              .filter((version) => version.status === 'complete')
              .map((version) => (
                <button key={version.id} type="button" onClick={() => addImage(version.id, 'version')}>
                  Add image to design
                </button>
              ))}
            {references.map((item) => (
              <button key={item.id} type="button" onClick={() => addImage(item.id, 'reference')}>
                Add logo/reference
              </button>
            ))}
            <label>
              Add SVG
              <input
                type="file"
                accept="image/svg+xml,.svg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) addSvgFile(file);
                  event.target.value = '';
                }}
              />
            </label>
          </aside>
          <div className="studio-canvas-column">
            {document && (
              <DesignCanvas
                document={document}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChangeLayer={(id, patch) => {
                  const next = cloneDocument(document);
                  const layer = next.layers.find((item) => item.id === id);
                  if (!layer || layer.locked) return;
                  Object.assign(layer, patch);
                  apply(next);
                }}
                onChangeLayers={(patches) => {
                  const next = cloneDocument(document);
                  for (const [id, patch] of Object.entries(patches)) {
                    const layer = next.layers.find((item) => item.id === id);
                    if (!layer || layer.locked) continue;
                    Object.assign(layer, patch);
                  }
                  apply(next);
                }}
                imageUrl={imageUrl}
              />
            )}
          </div>
          <aside className={`studio-inspector ${sheet === 'inspect' || sheet === 'export' ? 'is-open' : ''}`}>
            <h3>Inspector</h3>
            {document && (
              <div className="studio-inspector-fields">
                <label>
                  Title
                  <input
                    value={document.title}
                    onChange={(event) => apply({ ...document, title: event.target.value })}
                  />
                </label>
                <label>
                  Width
                  <input
                    type="number"
                    value={document.page.width}
                    onChange={(event) =>
                      apply({
                        ...document,
                        page: { ...document.page, width: Number(event.target.value), dimensionSource: 'supplied' },
                      })
                    }
                  />
                </label>
                <label>
                  Height
                  <input
                    type="number"
                    value={document.page.height}
                    onChange={(event) =>
                      apply({
                        ...document,
                        page: { ...document.page, height: Number(event.target.value), dimensionSource: 'supplied' },
                      })
                    }
                  />
                </label>
                <label>
                  Units
                  <select
                    value={document.page.unit}
                    onChange={(event) =>
                      apply(convertDocumentUnits(document, event.target.value as DesignDocument['page']['unit']))
                    }
                  >
                    <option value="mm">mm</option>
                    <option value="in">inches</option>
                    <option value="px">pixels</option>
                  </select>
                </label>
                <label>
                  Export PPI
                  <input
                    type="number"
                    min={72}
                    max={600}
                    value={document.page.ppi}
                    onChange={(event) =>
                      apply({ ...document, page: { ...document.page, ppi: Number(event.target.value) || DEFAULT_PPI } })
                    }
                  />
                </label>
                <p className="muted">{document.page.dimensionNote}</p>
              </div>
            )}
            {selected?.type === 'text' && document && (
              <div className="studio-inspector-fields">
                <label>
                  Copy
                  <textarea
                    value={selected.content}
                    onChange={(event) => {
                      const next = cloneDocument(document);
                      const layer = next.layers.find((item) => item.id === selected.id);
                      if (layer && layer.type === 'text') layer.content = event.target.value;
                      apply(next);
                    }}
                  />
                </label>
                <label>
                  Font
                  <select
                    value={selected.fontId}
                    onChange={(event) => {
                      const next = cloneDocument(document);
                      const layer = next.layers.find((item) => item.id === selected.id);
                      if (layer && layer.type === 'text')
                        layer.fontId = event.target.value as (typeof designFontIds)[number];
                      apply(next);
                    }}
                  >
                    {designFontIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Weight
                  <select
                    value={selected.fontWeight}
                    onChange={(event) => {
                      const next = cloneDocument(document);
                      const layer = next.layers.find((item) => item.id === selected.id);
                      if (layer && layer.type === 'text')
                        layer.fontWeight = Number(event.target.value) as 400 | 600 | 700;
                      apply(next);
                    }}
                  >
                    <option value={400}>Regular</option>
                    <option value={600}>Semibold</option>
                    <option value={700}>Bold</option>
                  </select>
                </label>
                <label>
                  Align
                  <select
                    value={selected.align}
                    onChange={(event) => {
                      const next = cloneDocument(document);
                      const layer = next.layers.find((item) => item.id === selected.id);
                      if (layer && layer.type === 'text')
                        layer.align = event.target.value as 'left' | 'center' | 'right';
                      apply(next);
                    }}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
            )}
            {document && selected && (
              <div className="studio-export-actions">
                <button
                  type="button"
                  onClick={() => {
                    const next = cloneDocument(document);
                    const layer = next.layers.find((item) => item.id === selected.id);
                    if (layer) layer.locked = !layer.locked;
                    apply(next);
                  }}
                >
                  {selected.locked ? 'Unlock' : 'Lock'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = cloneDocument(document);
                    const layer = next.layers.find((item) => item.id === selected.id);
                    if (layer) layer.visible = !layer.visible;
                    apply(next);
                  }}
                >
                  {selected.visible ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ids = document.layers.map((layer) => layer.id);
                    const index = ids.indexOf(selected.id);
                    if (index <= 0) return;
                    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
                    apply({ ...document, layers: ids.map((id) => document.layers.find((layer) => layer.id === id)!) });
                  }}
                >
                  Layer down
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ids = document.layers.map((layer) => layer.id);
                    const index = ids.indexOf(selected.id);
                    if (index < 0 || index >= ids.length - 1) return;
                    [ids[index], ids[index + 1]] = [ids[index + 1]!, ids[index]!];
                    apply({ ...document, layers: ids.map((id) => document.layers.find((layer) => layer.id === id)!) });
                  }}
                >
                  Layer up
                </button>
                {(['left', 'center', 'right', 'top', 'middle', 'bottom'] as const).map((edge) => (
                  <button
                    key={edge}
                    type="button"
                    disabled={alignedIds.length < 1}
                    onClick={() => {
                      if (alignedIds.length > 1) {
                        apply(alignLayers(document, alignedIds, edge));
                        return;
                      }
                      const next = cloneDocument(document);
                      const layer = next.layers.find((item) => item.id === selected.id);
                      if (!layer || layer.locked) return;
                      if (edge === 'left') layer.x = document.page.safe.left;
                      if (edge === 'right')
                        layer.x = document.page.width - document.page.safe.right - layer.width;
                      if (edge === 'center') layer.x = (document.page.width - layer.width) / 2;
                      if (edge === 'top') layer.y = document.page.safe.top;
                      if (edge === 'bottom')
                        layer.y = document.page.height - document.page.safe.bottom - layer.height;
                      if (edge === 'middle') layer.y = (document.page.height - layer.height) / 2;
                      apply(next);
                    }}
                  >
                    Align {edge}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={markedIds.length < 2}
                  onClick={() => {
                    const group = {
                      id: crypto.randomUUID(),
                      type: 'group' as const,
                      name: 'Group',
                      parentId: null,
                      visible: true,
                      locked: false,
                      opacity: 1,
                      x: 0,
                      y: 0,
                      width: document.page.width,
                      height: document.page.height,
                      rotation: 0,
                    };
                    const next = cloneDocument(document);
                    for (const id of markedIds) {
                      const layer = next.layers.find((item) => item.id === id);
                      if (layer) layer.parentId = group.id;
                    }
                    next.layers.push(group);
                    apply(next);
                    setSelectedId(group.id);
                  }}
                >
                  Group marked
                </button>
                <button
                  type="button"
                  disabled={selected.type !== 'group'}
                  onClick={() => {
                    const next = cloneDocument(document);
                    for (const layer of next.layers) if (layer.parentId === selected.id) layer.parentId = null;
                    next.layers = next.layers.filter((layer) => layer.id !== selected.id);
                    apply(next);
                  }}
                >
                  Ungroup
                </button>
              </div>
            )}
            <div className="studio-layer-list">
              <h4>Layers</h4>
              {document?.layers
                .slice()
                .reverse()
                .map((layer) => (
                  <div key={layer.id} className="studio-layer-row">
                    <input
                      type="checkbox"
                      checked={markedIds.includes(layer.id)}
                      aria-label={`Mark ${layer.name}`}
                      onChange={() =>
                        setMarkedIds((current) =>
                          current.includes(layer.id)
                            ? current.filter((id) => id !== layer.id)
                            : [...current, layer.id],
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-pressed={layer.id === selectedId}
                      onClick={() => setSelectedId(layer.id)}
                    >
                      {layer.name}
                      <span>
                        {layer.type}
                        {layer.locked ? ' · locked' : ''}
                        {layer.visible ? '' : ' · hidden'}
                      </span>
                    </button>
                  </div>
                ))}
            </div>
            <div className="studio-export-actions">
              <p>Exports freeze the current revision. RGB is not CMYK or PDF/X.</p>
              <button type="button" onClick={() => void exportFormat('png').catch((err) => setError(err.message))}>
                Export PNG
              </button>
              <button type="button" onClick={() => void exportFormat('svg').catch((err) => setError(err.message))}>
                Export SVG
              </button>
              <button type="button" onClick={() => void exportFormat('pdf').catch((err) => setError(err.message))}>
                Export PDF
              </button>
            </div>
          </aside>
        </div>
      )}
      {sheet !== 'none' && (
        <button type="button" className="studio-sheet-dismiss" onClick={() => setSheet('none')}>
          Close panel
        </button>
      )}
    </div>
  );
}

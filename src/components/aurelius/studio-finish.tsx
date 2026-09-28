'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export type StudioFinishRecord = {
  version_id: string; format: 'square' | 'portrait' | 'landscape'; treatment: 'editorial' | 'centered' | 'quiet';
  brand: string; headline: string; supporting: string; footer: string; focal_x: number; focal_y: number; updated_at: string;
};
type Draft = Omit<StudioFinishRecord, 'version_id' | 'updated_at'>;
type Version = { id: string; prompt: string; status: 'pending' | 'complete' | 'failed' };
const blank: Draft = { format: 'portrait', treatment: 'editorial', brand: '', headline: '', supporting: '', footer: '', focal_x: 50, focal_y: 50 };
const sizes = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1920, 1080] } as const;
function fromRecord(record: StudioFinishRecord | undefined): Draft {
  return record ? { format: record.format, treatment: record.treatment, brand: record.brand, headline: record.headline,
    supporting: record.supporting, footer: record.footer, focal_x: record.focal_x, focal_y: record.focal_y } : blank;
}

function wrapped(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, maxLines: number, family = 'Georgia, serif', minSize = 35) {
  let fontSize = size;
  let lines: string[] = [];
  while (fontSize >= minSize) {
    ctx.font = `${fontSize}px ${family}`;
    lines = [];
    let line = '';
    for (const word of text.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every(item => ctx.measureText(item).width <= maxWidth)) break;
    fontSize -= 3;
  }
  return { lines, fontSize };
}
function draw(canvas: HTMLCanvasElement, image: HTMLImageElement, draft: Draft) {
  const [width, height] = sizes[draft.format];
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot render the composition.');
  ctx.fillStyle = '#07130f'; ctx.fillRect(0, 0, width, height);
  const aspect = width / height;
  const sourceWidth = Math.min(image.naturalWidth, image.naturalHeight * aspect);
  const sourceHeight = sourceWidth / aspect;
  const sx = (image.naturalWidth - sourceWidth) * draft.focal_x / 100;
  const sy = (image.naturalHeight - sourceHeight) * draft.focal_y / 100;
  ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, 0, 0, width, height);
  const quiet = draft.treatment === 'quiet';
  if (quiet) { ctx.fillStyle = '#06120fe8'; ctx.fillRect(0, 0, width * .57, height); }
  else {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#04120da6'); gradient.addColorStop(.36, draft.treatment === 'centered' ? '#04120d88' : '#04120d00');
    gradient.addColorStop(1, draft.treatment === 'centered' ? '#04120dc0' : '#04120df4');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }
  const inset = draft.format === 'landscape' ? 105 : 72;
  const textWidth = quiet ? width * .48 : width - inset * 2;
  const x = draft.treatment === 'centered' ? width / 2 : inset;
  ctx.textAlign = draft.treatment === 'centered' ? 'center' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e0bb6a'; ctx.font = '600 27px Arial, sans-serif';
  if (draft.brand) ctx.fillText(draft.brand.toUpperCase(), x, inset + 20, textWidth);
  const ruleY = inset + 50;
  ctx.fillRect(draft.treatment === 'centered' ? x - 38 : inset, ruleY, 76, 3);
  const title = wrapped(ctx, draft.headline, textWidth, draft.format === 'landscape' ? 92 : 80, 4);
  const lineHeight = title.fontSize * 1.08;
  const total = title.lines.length * lineHeight;
  const support = wrapped(ctx, draft.supporting, textWidth, 32, 4, 'Arial, sans-serif', 17);
  const supportHeight = support.lines.length * support.fontSize * 1.32;
  const gap = support.lines.length ? 42 : 0;
  const titleTop = draft.treatment === 'centered' ? (height - total - supportHeight - gap) / 2 : quiet ? height * .34 : height - inset - 65 - supportHeight - gap - total;
  ctx.fillStyle = '#f9f1e2'; ctx.font = `${title.fontSize}px Georgia, serif`;
  title.lines.forEach((line, i) => ctx.fillText(line, x, titleTop + (i + 1) * lineHeight, textWidth));
  if (draft.supporting) {
    const supportY = titleTop + total + gap;
    ctx.font = `${support.fontSize}px Arial, sans-serif`; ctx.fillStyle = '#f0e6d5';
    support.lines.forEach((line, i) => ctx.fillText(line, x, supportY + i * support.fontSize * 1.32, textWidth));
  }
  if (draft.footer) { ctx.fillStyle = '#e0bb6a'; ctx.font = '600 25px Arial, sans-serif'; ctx.fillText(draft.footer.toUpperCase(), x, height - inset + 10, textWidth); }
  ctx.textAlign = 'left'; ctx.fillStyle = '#c4912f'; ctx.fillRect(inset, height - inset + 33, Math.min(260, textWidth), 3);
}

export function StudioFinish({ projectId, versions, finishes, initialVersionId, onChanged }: {
  projectId: string; versions: Version[]; finishes: StudioFinishRecord[]; initialVersionId: string | null; onChanged: () => Promise<void>;
}) {
  const ready = versions.filter(version => version.status === 'complete');
  const [selected, setSelected] = useState(initialVersionId ?? ready[0]?.id ?? '');
  const [draft, setDraft] = useState<Draft>(() => fromRecord(finishes.find(item => item.version_id === selected)));
  const [updatedAt, setUpdatedAt] = useState<string | null>(() => finishes.find(item => item.version_id === selected)?.updated_at ?? null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!selected) return;
    let active = true; let url = '';
    fetch(`/api/studio/image?id=${selected}&kind=version`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('The image could not be opened.'); return response.blob(); })
      .then(async blob => { url = URL.createObjectURL(blob); const next = new window.Image(); next.src = url; await next.decode(); if (active) setImage(next); })
      .catch(cause => { if (active) setError((cause as Error).message); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [selected]);
  useEffect(() => {
    if (!image || !canvas.current) return;
    let active = true;
    void document.fonts.ready.then(() => { if (active && canvas.current) draw(canvas.current, image, draft); });
    return () => { active = false; };
  }, [image, draft]);
  function change(next: Draft) { setDraft(next); setDirty(true); setError(''); }
  function selectVersion(id: string) {
    const record = finishes.find(item => item.version_id === id);
    setSelected(id); setDraft(fromRecord(record)); setUpdatedAt(record?.updated_at ?? null);
    setImage(null); setDirty(false); setError('');
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/studio/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        projectId, versionId: selected, updatedAt, format: draft.format, treatment: draft.treatment,
        brand: draft.brand, headline: draft.headline, supporting: draft.supporting, footer: draft.footer,
        focalX: draft.focal_x, focalY: draft.focal_y,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Composition could not be saved.');
      setUpdatedAt(result.updated_at); setDirty(false); await onChanged();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function exportPng() {
    if (!image || !canvas.current) return;
    setBusy(true); setError('');
    try {
      await document.fonts.ready;
      draw(canvas.current, image, draft);
      const blob = await new Promise<Blob | null>(resolve => canvas.current?.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('The export could not be created.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `studio-${selected}-${draft.format}.png`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <section className="studio-finish" aria-label="Finish a Studio image">
    <div className="studio-intro"><p className="eyebrow">THE FINISH ROOM</p><h3>Make it ready to be seen.</h3><p>Frame a saved image, add your own words, and export a finished PNG. Your layout is saved privately to this project. Review names, logos and image details before publishing.</p></div>
    {!ready.length ? <div className="studio-library-empty">Create an image first, then return here to finish it.</div> : <>
      <div className="studio-finish-assets" role="group" aria-label="Choose an image">{ready.map(version => <button key={version.id} type="button" aria-pressed={selected === version.id} onClick={() => selectVersion(version.id)} title={version.prompt}><Image unoptimized src={`/api/studio/image?id=${version.id}&kind=version`} alt={version.prompt} width={90} height={90} /></button>)}</div>
      {error && <p className="studio-error" role="alert">{error}</p>}
      <div className="studio-finish-room"><div className="studio-finish-preview"><canvas ref={canvas} role="img" aria-label={`Preview of ${draft.headline || 'the composition'} with the selected image`} />{!image && <p>Opening image…</p>}<small>Preview and export use the same canvas.</small></div>
        <div className="studio-finish-controls"><p className="eyebrow">COMPOSITION</p>
          <div className="studio-finish-pair"><label>Canvas<select value={draft.format} onChange={event => change({ ...draft, format: event.target.value as Draft['format'] })}><option value="square">Square · 1080 × 1080</option><option value="portrait">Portrait · 1080 × 1350</option><option value="landscape">Landscape · 1920 × 1080</option></select></label><label>Layout<select value={draft.treatment} onChange={event => change({ ...draft, treatment: event.target.value as Draft['treatment'] })}><option value="editorial">Editorial</option><option value="centered">Centered</option><option value="quiet">Quiet panel</option></select></label></div>
          <label>Brand or series<input value={draft.brand} maxLength={60} onChange={event => change({ ...draft, brand: event.target.value })} placeholder="Your brand name" /></label>
          <label>Headline<textarea value={draft.headline} maxLength={120} onChange={event => change({ ...draft, headline: event.target.value })} placeholder="One clear idea worth remembering" /></label>
          <label>Supporting line<textarea value={draft.supporting} maxLength={180} onChange={event => change({ ...draft, supporting: event.target.value })} placeholder="A detail, promise or point of view" /></label>
          <label>Footer or call to action<input value={draft.footer} maxLength={80} onChange={event => change({ ...draft, footer: event.target.value })} placeholder="Explore the collection" /></label>
          <div className="studio-finish-pair"><label>Horizontal focus<input type="range" min="0" max="100" value={draft.focal_x} onChange={event => change({ ...draft, focal_x: Number(event.target.value) })} /></label><label>Vertical focus<input type="range" min="0" max="100" value={draft.focal_y} onChange={event => change({ ...draft, focal_y: Number(event.target.value) })} /></label></div>
          <div className="studio-finish-actions"><button className="button" type="button" disabled={!image || busy || !dirty} onClick={() => void save()}>{busy ? 'Working…' : dirty ? 'Save composition' : 'Saved'}</button><button type="button" disabled={!image || busy} onClick={() => void exportPng()}>Export PNG ↗</button></div>
          {dirty && <p className="studio-finish-hint">Unsaved changes. Export uses what you see now.</p>}
        </div></div>
    </>}
  </section>;
}

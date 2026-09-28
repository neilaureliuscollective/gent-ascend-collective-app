'use client';

import { useState } from 'react';
import Image from 'next/image';

export type StudioScene = {
  id: string; position: number; title: string; message: string; visual_direction: string;
  motion_note: string; channel: 'social' | 'website' | 'pitch' | 'print';
  asset_version_id: string | null; updated_at: string;
};
type SceneDraft = { title: string; message: string; visualDirection: string; motionNote: string; channel: StudioScene['channel'] };
type Version = { id: string; status: 'pending' | 'complete' | 'failed'; prompt: string };
const blank: SceneDraft = { title: '', message: '', visualDirection: '', motionNote: '', channel: 'social' };
const suggestions = [
  { title: 'The opening', note: 'The image that earns attention and sets the world.' },
  { title: 'The human moment', note: 'Show who this matters to and why.' },
  { title: 'The proof', note: 'Make the product, practice or transformation tangible.' },
  { title: 'The invitation', note: 'Leave the audience with a clear next step.' },
];
function fromScene(scene: StudioScene): SceneDraft {
  return { title: scene.title, message: scene.message, visualDirection: scene.visual_direction, motionNote: scene.motion_note, channel: scene.channel };
}
async function request(body: unknown, method: 'POST' | 'PATCH' | 'DELETE') {
  const response = await fetch('/api/studio/scenes', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The scene could not be saved.');
  return data;
}

export function StudioStoryboard({ projectId, scenes, versions, disabled, onChanged, onCreateFrame }: {
  projectId: string; scenes: StudioScene[]; versions: Version[]; disabled: boolean;
  onChanged: () => Promise<void>; onCreateFrame: (scene: StudioScene) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [draft, setDraft] = useState<SceneDraft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = versions.filter(version => version.status === 'complete');

  async function add(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await request({ projectId, ...draft }, 'POST');
      setAdding(false); setDraft(blank); await onChanged();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function save(scene: StudioScene, values: SceneDraft, assetVersionId: string | null) {
    setBusy(true); setError('');
    try {
      await request({ projectId, sceneId: scene.id, updatedAt: scene.updated_at, ...values, assetVersionId }, 'PATCH');
      setEditing(null); setChoosing(null); await onChanged();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function remove(scene: StudioScene) {
    setBusy(true); setError('');
    try { await request({ projectId, sceneId: scene.id }, 'DELETE'); setRemoving(null); await onChanged(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  function startWith(title: string, note: string) {
    setDraft({ ...blank, title, visualDirection: note }); setAdding(true);
  }
  const fields = (value: SceneDraft, set: (next: SceneDraft) => void) => <div className="studio-scene-fields">
    <label>Scene title<input value={value.title} maxLength={80} required onChange={event => set({ ...value, title: event.target.value })} disabled={busy} placeholder="The moment" /></label>
    <label>Core message<textarea value={value.message} maxLength={300} onChange={event => set({ ...value, message: event.target.value })} disabled={busy} placeholder="What should someone understand or feel?" /></label>
    <label>Visual direction<textarea value={value.visualDirection} maxLength={700} onChange={event => set({ ...value, visualDirection: event.target.value })} disabled={busy} placeholder="Subject, location, light, composition, materials…" /></label>
    <label>Motion idea <small>Planning note only</small><textarea value={value.motionNote} maxLength={300} onChange={event => set({ ...value, motionNote: event.target.value })} disabled={busy} placeholder="A camera move or transition to explore later" /></label>
    <label>Intended placement<select value={value.channel} onChange={event => set({ ...value, channel: event.target.value as SceneDraft['channel'] })} disabled={busy}><option value="social">Social</option><option value="website">Website</option><option value="pitch">Pitch</option><option value="print">Print</option></select></label>
  </div>;

  return <section className="studio-storyboard" aria-label="Project storyboard">
    <div className="studio-intro"><p className="eyebrow">THE STORYBOARD</p><h3>Build the story before the assets.</h3><p>Sequence the moments, develop a frame for each one, and keep the campaign coherent. Motion notes are a plan for future video work; no video is generated here.</p></div>
    <div className="studio-story-actions"><span>{scenes.length} / 8 scenes</span><div><button type="button" onClick={() => window.print()} disabled={!scenes.length}>Print board ↗</button><button type="button" className="button" onClick={() => { setDraft(blank); setAdding(true); }} disabled={disabled || busy || scenes.length >= 8}>+ Add scene</button></div></div>
    {error && <p role="alert" className="studio-error">{error}</p>}
    {!scenes.length && !adding && <div className="studio-story-empty"><p className="eyebrow">A STARTING ARC</p><h4>One idea. Four deliberate moments.</h4><div>{suggestions.map((suggestion, index) => <button key={suggestion.title} type="button" onClick={() => startWith(suggestion.title, suggestion.note)}><span>0{index + 1}</span><strong>{suggestion.title}</strong><small>{suggestion.note}</small></button>)}</div><p>Choose a starting moment or add your own scene. This is a suggested structure you can adapt.</p></div>}
    {adding && <form className="studio-scene-editor" onSubmit={add}><h4>New scene</h4>{fields(draft, setDraft)}<div><button type="submit" className="button" disabled={busy || disabled}>{busy ? 'Saving…' : 'Add to storyboard'}</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></div></form>}
    <div className="studio-scene-list">{scenes.map((scene, index) => <article className="studio-scene" key={scene.id}>
      <div className="studio-scene-number">{String(index + 1).padStart(2, '0')}<span> / {String(scenes.length).padStart(2, '0')}</span></div>
      <div className="studio-scene-frame">{scene.asset_version_id ? <Image unoptimized width={560} height={560} src={`/api/studio/image?id=${scene.asset_version_id}&kind=version`} alt={`Frame for ${scene.title}`} /> : <div className="studio-scene-frame-empty"><span>✦</span><p>Frame awaiting direction</p></div>}</div>
      <div className="studio-scene-content">{editing === scene.id ? <form onSubmit={event => { event.preventDefault(); void save(scene, draft, scene.asset_version_id); }}><h4>Edit scene</h4>{fields(draft, setDraft)}<div className="studio-scene-buttons"><button type="submit" className="button" disabled={busy}>Save scene</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div></form> : <>
        <p className="eyebrow">{scene.channel.toUpperCase()} / SCENE {index + 1}</p><h4>{scene.title}</h4>
        {scene.message && <p className="studio-scene-message">{scene.message}</p>}
        {scene.visual_direction && <p><strong>Visual</strong> {scene.visual_direction}</p>}
        {scene.motion_note && <p><strong>Motion concept</strong> {scene.motion_note}</p>}
        <div className="studio-scene-buttons"><button type="button" onClick={() => onCreateFrame(scene)}>Create frame ↗</button><button type="button" onClick={() => { setChoosing(choosing === scene.id ? null : scene.id); setEditing(null); }}>Choose saved image</button><button type="button" onClick={() => { setDraft(fromScene(scene)); setEditing(scene.id); setChoosing(null); }}>Edit</button><button type="button" onClick={() => setRemoving(scene.id)}>Remove</button></div>
        {choosing === scene.id && <div className="studio-scene-picker"><p>Choose a completed image from this project</p>{ready.length ? <div>{ready.map(version => <button key={version.id} type="button" disabled={busy} onClick={() => void save(scene, fromScene(scene), version.id)}><Image unoptimized width={110} height={110} src={`/api/studio/image?id=${version.id}&kind=version`} alt={version.prompt} /></button>)}</div> : <p>No completed images yet. Create a frame first.</p>}{scene.asset_version_id && <button type="button" onClick={() => void save(scene, fromScene(scene), null)}>Remove current image</button>}</div>}
        {removing === scene.id && <div className="studio-scene-confirm"><p>Remove this scene from the board? Its image remains in the Library.</p><button type="button" disabled={busy} onClick={() => void remove(scene)}>Remove scene</button><button type="button" onClick={() => setRemoving(null)}>Keep it</button></div>}
      </>}</div>
    </article>)}</div>
  </section>;
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StudioStoryboard, type StudioScene } from './studio-storyboard';
import { StudioFinish, type StudioFinishRecord } from './studio-finish';
import { useConversationDraft } from './draft-handoff';

type CreativeType = 'open' | 'brand' | 'campaign' | 'product' | 'personal';
type Brief = { purpose: string; audience: string; direction: string; palette: string; avoid: string };
type Project = { id: string; title: string; creative_type: CreativeType; brief: Partial<Brief>; updated_at: string };
type Version = { id: string; parent_id: string | null; reference_id: string | null; prompt: string; model: string; image_size: string; status: 'pending' | 'complete' | 'failed'; created_at: string };
type Reference = { id: string; created_at: string };
type Workspace = { owner?: string; projects: Project[]; projectId: string | null; versions: Version[]; references: Reference[]; scenes: StudioScene[]; finishes: StudioFinishRecord[]; configured: boolean; mission?: {id:string;title:string} | null };
type View = 'create' | 'library' | 'direction' | 'storyboard' | 'finish';
const blankBrief: Brief = { purpose: '', audience: '', direction: '', palette: '', avoid: '' };
const empty: Workspace = { projects: [], projectId: null, versions: [], references: [], scenes: [], finishes: [], configured: false };
const paths: { type: CreativeType; title: string; description: string; starter: string }[] = [
  { type: 'open', title: 'Explore an idea', description: 'Discover the shape of a new direction.', starter: 'Explore three visual directions for ' },
  { type: 'brand', title: 'Build a brand', description: 'Identity, atmosphere and a consistent world.', starter: 'Create a visual world for my brand that expresses ' },
  { type: 'campaign', title: 'Shape a campaign', description: 'A concept worth developing across channels.', starter: 'Create a campaign image built around the idea of ' },
  { type: 'product', title: 'Present a product', description: 'An image that gives the product presence.', starter: 'Create a refined product image featuring ' },
  { type: 'personal', title: 'Make it personal', description: 'A place, moment or future worth seeing.', starter: 'Visualize a personal vision of ' },
];
async function jsonResponse<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Studio could not complete the request.');
  return value as T;
}
function imageUrl(id: string, kind: 'version' | 'reference') {
  return `/api/studio/image?id=${id}&kind=${kind}`;
}

export function StudioWorkspace({initialProject}: {initialProject?:string}) {
  const handoff = useConversationDraft();
  const [data, setData] = useState<Workspace>(empty);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>('create');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [busyLabel, setBusyLabel] = useState('Working…');
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<CreativeType>('open');
  const [naming, setNaming] = useState(false);
  const [brief, setBrief] = useState<Brief>(blankBrief);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'fast' | 'precise'>('fast');
  const [size, setSize] = useState<'1024x1024' | '1536x1024' | '1024x1536'>('1024x1024');
  const [parent, setParent] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [forScene, setForScene] = useState<string | null>(null);
  const [finishVersion, setFinishVersion] = useState<string | null>(null);
  const project = data.projects.find(item => item.id === selected);

  const accept = useCallback((next: Workspace) => {
    setData(next);
    setSelected(next.projectId);
    const current = next.projects.find(item => item.id === next.projectId);
    setBrief({ ...blankBrief, ...current?.brief });
    const carried = next.owner ? handoff?.take('studio', next.owner) : null;
    if (carried) {
      const payload = carried.payload as { studio?: { title?: string; creativeType?: CreativeType; brief?: Partial<Brief>; prompt?: string } } | undefined;
      const prepared = payload?.studio;
      setDraft(prepared?.prompt || carried.text);
      setNewTitle((prepared?.title || carried.text).slice(0, 72));
      if (prepared?.creativeType) setNewType(prepared.creativeType);
      if (prepared?.brief) setBrief({ ...blankBrief, ...prepared.brief });
      setNaming(true);
      setView('create');
    }
    setError('');
    setLoading(false);
  }, [handoff]);
  const load = useCallback(async (projectId?: string | null) => {
    try {
      const next = await jsonResponse<Workspace>(await fetch(`/api/studio${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`, { cache: 'no-store' }));
      accept(next);
    } catch (cause) {
      setError((cause as Error).message);
      setLoading(false);
    }
  }, [accept]);
  useEffect(() => {
    let active = true;
    fetch(`/api/studio${initialProject ? `?project=${encodeURIComponent(initialProject)}` : ''}`, { cache: 'no-store' }).then(response => jsonResponse<Workspace>(response))
      .then(next => { if (active) accept(next); })
      .catch(cause => { if (active) { setError(cause.message); setLoading(false); } });
    return () => { active = false; };
  }, [accept,initialProject]);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const result = await jsonResponse<{ id: string }>(await fetch('/api/studio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), creativeType: newType }),
      }));
      await load(result.id);
      setNewTitle(''); setNaming(false); setDraft(''); setParent(null); setReference(null); setForScene(null); setFinishVersion(null); setView('direction');
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function saveBrief(event: React.FormEvent) {
    event.preventDefault();
    if (!project || busy) return;
    setBusy(true); setError('');
    try {
      await jsonResponse(await fetch('/api/studio', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, updatedAt: project.updated_at, title: project.title, creativeType: project.creative_type, brief }),
      }));
      await load(project.id);
      setView('create');
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    if (!selected) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size < 100 || file.size > 10_485_760) {
      setError('Choose a PNG, JPEG, or WebP image smaller than 10 MB.'); return;
    }
    setBusy(true); setBusyLabel('Uploading reference…'); setError('');
    try {
      const prepared = await jsonResponse<{ id: string; path: string; token: string; url: string; publishableKey: string }>(await fetch('/api/studio/reference', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare', projectId: selected, mediaType: file.type, byteSize: file.size }),
      }));
      const { createClient } = await import('@supabase/supabase-js');
      const storage = createClient(prepared.url, prepared.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
      const transferred = await storage.from('aethelios-studio').uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type, upsert: false });
      if (transferred.error) throw new Error('Reference upload failed. Try selecting it again.');
      const saved = await jsonResponse<{ id: string }>(await fetch('/api/studio/reference', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', projectId: selected, id: prepared.id, mediaType: file.type }),
      }));
      await load(selected);
      setReference(saved.id); setParent(null); setView('create');
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setBusyLabel('Creating image…'); setError('');
    const requestId = crypto.randomUUID();
    try {
      const result = await jsonResponse<{ id: string }>(await fetch('/api/studio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, projectId: selected, parentId: parent, referenceId: reference, prompt: draft, mode, size }),
      }));
      setDraft(''); setReference(null); setParent(null);
      if (forScene) {
        const scene = data.scenes.find(item => item.id === forScene);
        if (scene) {
          try {
            await jsonResponse(await fetch('/api/studio/scenes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
              projectId: selected, sceneId: scene.id, updatedAt: scene.updated_at, title: scene.title,
              message: scene.message, visualDirection: scene.visual_direction, motionNote: scene.motion_note,
              channel: scene.channel, assetVersionId: result.id,
            }) }));
          } catch {
            await load(selected); setForScene(null); setView('library');
            setError('The image was saved in your Library, but the scene changed while it was being made. Attach it from the storyboard.');
            return;
          }
        }
      }
      setForScene(null); await load(selected); setView(forScene ? 'storyboard' : 'library');
    } catch (cause) {
      await load(selected); setError((cause as Error).message);
    } finally { setBusy(false); }
  }
  function refine(version: Version) {
    setParent(version.id); setReference(null); setDraft(''); setView('create');
  }
  function selectReference(id: string) {
    setReference(id); setParent(null); setForScene(null); setView('create');
  }
  function createSceneFrame(scene: StudioScene) {
    setForScene(scene.id); setParent(null); setReference(null);
    setDraft(`Create a visual frame for “${scene.title}”. ${scene.visual_direction} ${scene.message ? `The message is: ${scene.message}.` : ''}`.trim());
    setSize(scene.channel === 'website' || scene.channel === 'pitch' ? '1536x1024' : '1024x1536');
    setView('create');
    requestAnimationFrame(() => document.getElementById('studio-prompt')?.focus());
  }
  function finishImage(versionId: string) { setFinishVersion(versionId); setView('finish'); }

  return <section className="studio-surface" aria-label="Aethelios Studio">
    {data.mission&&<p className="studio-mission-return"><Link href={`/app/missions?id=${data.mission.id}`}>← Return to {data.mission.title}</Link></p>}
    <aside className="studio-projects" aria-label="Project navigation">
      <div className="studio-section-head imperial-control-surface"><div><p className="eyebrow">WORKSPACES</p><h2>Projects</h2></div><button type="button" onClick={() => setNaming(value => !value)} disabled={busy}>+ New</button></div>
      {naming && <form className="studio-new-project" onSubmit={createProject}>
        <label htmlFor="studio-title">Project name</label>
        <input id="studio-title" value={newTitle} onChange={event => setNewTitle(event.target.value)} minLength={1} maxLength={80} required autoFocus placeholder="The next thing you're building" />
        <label htmlFor="studio-type">What are you building?</label>
        <select id="studio-type" value={newType} onChange={event => setNewType(event.target.value as CreativeType)}>{paths.map(path => <option value={path.type} key={path.type}>{path.title}</option>)}</select>
        <button type="submit" disabled={busy}>Create project →</button>
      </form>}
      {loading ? <p>Opening Studio…</p> : data.projects.length === 0 ? <p className="muted">One place for every direction you develop.</p> : <nav aria-label="Studio projects">{data.projects.map(item => <button key={item.id} type="button" className={selected === item.id ? 'selected' : ''} aria-current={selected === item.id ? 'page' : undefined} onClick={() => { setParent(null); setReference(null); setForScene(null); setFinishVersion(null); setLoading(true); setView('create'); void load(item.id); }}><small>{paths.find(path => path.type === item.creative_type)?.title ?? 'Project'}</small>{item.title}</button>)}</nav>}
      <div className="studio-side-note"><span className="small-orb" aria-hidden="true" /><p>Give the idea a direction. Aethelios helps you develop it, version by version.</p></div>
    </aside>

    <div className="studio-main">
      {error && <p role="alert" className="studio-error">{error}</p>}
      {!selected ? <div className="studio-empty"><p className="eyebrow">AETHELIOS STUDIO</p><h2>Make the vision visible.</h2><p>Build a brand world, shape a campaign, explore a product, or see a personal idea before it exists. Every project keeps its direction, references and finished images together.</p><button className="button" type="button" onClick={() => setNaming(true)} disabled={busy}>Start a project ↗</button></div> : <>
        <div className="studio-project-heading"><div><p className="eyebrow">{paths.find(path => path.type === project?.creative_type)?.title ?? 'Creative project'}</p><h2>{project?.title}</h2><span>{data.versions.filter(version => version.status === 'complete').length} images · {data.references.length} references</span></div><Link href="/app/aethelios">Talk it through with Aethelios ↗</Link></div>
        <div className="studio-view-tabs imperial-control-surface" role="group" aria-label="Studio workspace views">
          {(['create', 'storyboard', 'finish', 'library', 'direction'] as const).map(tab => <button key={tab} type="button" aria-pressed={view === tab} onClick={() => setView(tab)}>{tab === 'create' ? 'Create' : tab === 'storyboard' ? 'Storyboard' : tab === 'finish' ? 'Finish' : tab === 'library' ? 'Library' : 'Direction'}</button>)}
        </div>
        {view === 'storyboard' && <StudioStoryboard key={selected} projectId={selected} scenes={data.scenes} versions={data.versions} disabled={busy} onChanged={() => load(selected)} onCreateFrame={createSceneFrame} onFinishImage={finishImage} />}
        {view === 'finish' && <StudioFinish key={`${selected}-${finishVersion ?? ''}`} projectId={selected} versions={data.versions} finishes={data.finishes} initialVersionId={finishVersion} onChanged={() => load(selected)} />}
        {view === 'direction' && <form className="studio-direction" onSubmit={saveBrief}>
          <div className="studio-intro"><p className="eyebrow">THE CREATIVE BRIEF</p><h3>Set the standard for this project.</h3><p>This direction guides new images in this project. You can change it as the idea develops.</p></div>
          <div className="studio-brief-grid">{([
            ['purpose', 'What is this for?', 'The idea, product or outcome this project serves.'],
            ['audience', 'Who should it speak to?', 'Describe the person, customer or community.'],
            ['direction', 'How should it feel?', 'Atmosphere, materials, location, lighting and mood.'],
            ['palette', 'Color direction', 'Colors to use or stay close to.'],
            ['avoid', 'What should it avoid?', 'Visual clichés, unwanted elements or off-brand details.'],
          ] as const).map(([key, label, placeholder]) => <label key={key}>{label}<textarea value={brief[key]} maxLength={key === 'direction' ? 700 : key === 'purpose' ? 500 : key === 'avoid' ? 400 : key === 'audience' ? 300 : 200} onChange={event => setBrief(current => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} disabled={busy} /></label>)}</div>
          <button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save direction'}</button>
        </form>}
        {view === 'create' && <div className="studio-create">
          <div className="studio-intro"><p className="eyebrow">THE CREATION ROOM</p><h3>Where do we begin?</h3><p>Choose an entry point, then tell Aethelios what you want to see. Your saved direction stays with the project.</p></div>
          <div className="studio-paths">{paths.map(path => <button key={path.type} type="button" onClick={() => { setDraft(path.starter); document.getElementById('studio-prompt')?.focus(); }}><span>0{paths.indexOf(path) + 1}</span><strong>{path.title}</strong><small>{path.description}</small><b aria-hidden="true">↗</b></button>)}</div>
          {!data.configured && <p className="studio-notice">Image generation is awaiting a server model connection. Projects and references remain available.</p>}
          <form onSubmit={generate} className="studio-composer">
            <p className="eyebrow">{forScene ? `FRAME FOR ${data.scenes.find(item => item.id === forScene)?.title ?? 'STORYBOARD'}` : parent ? 'REFINE A SAVED IMAGE' : reference ? 'CREATE FROM A REFERENCE' : 'NEW IMAGE'}</p>
            {forScene && <button type="button" className="studio-cancel-scene" onClick={() => setForScene(null)}>Create outside this storyboard instead</button>}
            {(parent || reference) && <div className="studio-source"><Image unoptimized width={60} height={60} src={imageUrl((parent ?? reference)!, parent ? 'version' : 'reference')} alt="Selected source" /><span>{parent ? 'Developing this saved version' : 'Using this reference'}</span><button type="button" onClick={() => { setParent(null); setReference(null); }}>Clear</button></div>}
            <label htmlFor="studio-prompt">Describe what you want to see</label>
            <textarea id="studio-prompt" value={draft} onChange={event => setDraft(event.target.value)} minLength={3} maxLength={3000} required placeholder="The subject, setting, feeling, details and intended use…" disabled={busy} />
            <div className="studio-controls"><label>Detail<select value={mode} onChange={event => setMode(event.target.value as 'fast' | 'precise')} disabled={busy}><option value="fast">Fast exploration</option><option value="precise">Precise detail</option></select></label><label>Canvas<select value={size} onChange={event => setSize(event.target.value as typeof size)} disabled={busy}><option value="1024x1024">Square</option><option value="1536x1024">Landscape</option><option value="1024x1536">Portrait</option></select></label><label className="studio-upload">Add a reference<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label><button className="button" type="submit" disabled={busy || !data.configured || draft.trim().length < 3}>{busy ? busyLabel : 'Create image ↗'}</button></div>
            <p className="muted">One private image per request. Review the result before using it in public work.</p>
          </form>
          {data.versions.length > 0 && <button type="button" className="studio-library-entry" onClick={() => setView('library')}>Explore saved work <span>View {data.versions.length} versions →</span></button>}
        </div>}
        {view === 'library' && <div className="studio-library">
          <div className="studio-intro"><p className="eyebrow">THE PROJECT LIBRARY</p><h3>Every direction stays within reach.</h3><p>Open a result at full size, refine a version, or select a saved reference for the next creation.</p></div>
          <div className="studio-library-head"><h4>Images <span>{data.versions.length}</span></h4><button type="button" onClick={() => void load(selected)} disabled={busy}>Refresh</button></div>
          <div className="studio-gallery">{data.versions.length === 0 ? <div className="studio-library-empty">Your first image will appear here. <button type="button" onClick={() => setView('create')}>Create one →</button></div> : data.versions.map(version => <article className="studio-card" key={version.id}>
            {version.status === 'complete' ? <a href={imageUrl(version.id, 'version')} target="_blank" rel="noreferrer" aria-label="Open full image"><Image unoptimized width={512} height={512} src={imageUrl(version.id, 'version')} alt={version.prompt} /></a> : <div className="studio-placeholder">{version.status === 'pending' ? 'Creating…' : 'Generation failed'}</div>}
            <div className="studio-card-copy"><small>{new Date(version.created_at).toLocaleDateString()} · {version.image_size} · {version.model.endsWith('flare') ? 'Fast' : 'Precise'}</small><details><summary>Creative request</summary><p>{version.prompt}</p></details><div className="studio-card-actions">{version.status === 'complete' ? <><button type="button" onClick={() => finishImage(version.id)}>Finish for sharing ↗</button><button type="button" onClick={() => refine(version)}>Refine this ↗</button><a href={imageUrl(version.id, 'version')} target="_blank" rel="noreferrer">Open image ↗</a></> : version.status === 'failed' ? <button type="button" onClick={() => { setDraft(version.prompt); setParent(version.parent_id); setReference(version.reference_id); setView('create'); }}>Try this again</button> : null}</div></div>
          </article>)}</div>
          <div className="studio-library-head"><h4>References <span>{data.references.length}</span></h4><label className="studio-reference-upload">+ Upload reference<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label></div>
          {data.references.length ? <div className="studio-reference-grid">{data.references.map(item => <button key={item.id} type="button" onClick={() => selectReference(item.id)} disabled={busy}><Image unoptimized width={180} height={180} src={imageUrl(item.id, 'reference')} alt="Saved reference" /><span>Use reference ↗</span></button>)}</div> : <p className="muted">Add a logo, product photo or visual reference to guide a creation.</p>}
        </div>}
      </>}
    </div>
  </section>;
}

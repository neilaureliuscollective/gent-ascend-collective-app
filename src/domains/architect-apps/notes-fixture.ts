import { isGeneratedAppPath } from './catalog';
import { fileHash } from './hash';
import type { AppCollection, AppFile, AppProposal, FileOperation } from './schema';
import { overlaySealedFiles } from './tree';

const envDts = `export {};
declare module 'react' {
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps?: unknown[]): T;
  const React: { createElement: (...args: unknown[]) => unknown };
  export default React;
}
declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
  export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
}
declare module 'react-dom/client' {
  export function createRoot(container: Element): { render(node: unknown): void };
}
declare module '*.css' { const value: string; export default value; }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: Record<string, unknown>; } }
declare global { interface Window { __AETHELIOS_APP_SESSION__?: string; __AETHELIOS_PARENT_ORIGIN__?: string; } }
`;

export const notesCollections: AppCollection[] = [
  {
    name: 'notes',
    fields: [
      { name: 'title', type: 'string', required: true, max: 80 },
      { name: 'body', type: 'string', required: false, max: 800 },
      { name: 'hours', type: 'number', required: true },
    ],
  },
];

export const notesBehaviors = {
  navigation: true,
  forms: true,
  validation: true,
  filtering: true,
  calculations: true,
  persistence: true,
} as const;

function files(): AppFile[] {
  return [
    { path: 'src/env.d.ts', content: envDts },
    { path: 'src/css.d.ts', content: "declare module '*.css';\n" },
    {
      path: 'src/types.ts',
      content: `export type Note = { id: string; title: string; body: string; hours: number; persisted: boolean };
export type Route = { name: 'list' } | { name: 'compose' } | { name: 'note'; id: string };
`,
    },
    {
      path: 'src/validate.ts',
      content: `import type { Note } from './types';
export function validateNote(input: Partial<Note>): string[] {
  const issues: string[] = [];
  if (!(input.title ?? '').trim() || (input.title ?? '').length > 80) issues.push('Title must be 1 to 80 characters.');
  if ((input.body ?? '').length > 800) issues.push('Body cannot exceed 800 characters.');
  if (typeof input.hours !== 'number' || !Number.isFinite(input.hours) || input.hours < 0) issues.push('Hours must be a non-negative number.');
  return issues;
}
`,
    },
    {
      path: 'src/calc.ts',
      content: `import type { Note } from './types';
export function hoursLogged(notes: Note[]) { return notes.reduce((sum, note) => sum + note.hours, 0); }
export function filterNotes(notes: Note[], query: string) {
  const needle = query.trim().toLowerCase();
  return needle ? notes.filter((note) => note.title.toLowerCase().includes(needle)) : notes;
}
`,
    },
    {
      path: 'src/bridge.ts',
      content: `import type { Note } from './types';
const SCHEMA = 'architect-apps-data/v1';
type HostResponse = { schema: string; requestId: string; ok: boolean; records?: Note[]; error?: string };
export function requestNotes(operation: 'list' | 'create' | 'update', payload?: Note, idempotencyKey?: string) {
  return new Promise<Note[]>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => { window.removeEventListener('message', onMessage); reject(new Error('Host collection timed out.')); }, 8000);
    function onMessage(event: MessageEvent<HostResponse>) {
      const data = event.data;
      if (!data || data.schema !== SCHEMA || data.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (!data.ok) { reject(new Error(data.error || 'Host collection refused the request.')); return; }
      resolve(data.records ?? []);
    }
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ schema: SCHEMA, session: window.__AETHELIOS_APP_SESSION__ || '', requestId, operation, collection: 'notes', payload, idempotencyKey }, window.__AETHELIOS_PARENT_ORIGIN__ || '*');
  });
}
`,
    },
    {
      path: 'src/styles.css',
      content: `:root { color-scheme: dark; background: #050706; color: #e8e4dc; font-family: Georgia, serif; }
body { margin: 0; } .shell { padding: 20px; } .eyebrow { color: #c4912f; letter-spacing: .12em; text-transform: uppercase; font-size: .72rem; }
button, input, textarea { font: inherit; color: inherit; background: #111412; border: 1px solid #2a2d2a; border-radius: 8px; padding: 8px 12px; }
.card { display: block; width: 100%; text-align: left; margin-bottom: 8px; }
`,
    },
    {
      path: 'src/main.tsx',
      content: `import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');
createRoot(root).render(<App />);
`,
    },
    {
      path: 'src/App.tsx',
      content: `import { useEffect, useMemo, useState } from 'react';
import { requestNotes } from './bridge';
import { filterNotes, hoursLogged } from './calc';
import { validateNote } from './validate';
import type { Note, Route } from './types';
export function App() {
  const [route, setRoute] = useState<Route>({ name: 'list' });
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hours, setHours] = useState('1');
  const [issues, setIssues] = useState<string[]>([]);
  const [createMutationId, setCreateMutationId] = useState(() => crypto.randomUUID());
  const [editMutationId, setEditMutationId] = useState(() => crypto.randomUUID());
  const visible = useMemo(() => filterNotes(notes, query), [notes, query]);
  const total = useMemo(() => hoursLogged(notes), [notes]);
  async function refresh() { setNotes(await requestNotes('list')); }
  useEffect(() => { void refresh().catch(() => setNotes([])); }, []);
  async function save(note: Note) {
    const next = validateNote(note);
    setIssues(next);
    if (next.length) return;
    await requestNotes(note.persisted ? 'update' : 'create', note, note.persisted ? editMutationId : createMutationId);
    await refresh();
    setRoute({ name: 'note', id: note.id });
  }
  const selected = route.name === 'note' ? notes.find((note) => note.id === route.id) ?? null : null;
  return (
    <div className="shell">
      <p className="eyebrow">Aethelios generated application</p>
      <h1>Field notes</h1>
      <p>{total}h logged</p>
      <nav>
        <button type="button" onClick={() => setRoute({ name: 'list' })}>Notes</button>
        <button type="button" onClick={() => { setCreateMutationId(crypto.randomUUID()); setRoute({ name: 'compose' }); }}>New note</button>
      </nav>
      {route.name === 'list' ? (
        <section>
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Filter" />
          {visible.map((note) => (
            <button key={note.id} type="button" className="card" onClick={() => { setEditMutationId(crypto.randomUUID()); setRoute({ name: 'note', id: note.id }); }}>
              <strong>{note.title}</strong>
              <p>{note.hours}h</p>
            </button>
          ))}
        </section>
      ) : null}
      {route.name === 'compose' || selected ? (
        <form onSubmit={(event) => { event.preventDefault(); void save({ id: selected?.id ?? crypto.randomUUID(), title, body, hours: Number(hours), persisted: Boolean(selected) }); }}>
          <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} maxLength={80} required />
          <textarea value={body} onChange={(event) => setBody(event.currentTarget.value)} maxLength={800} />
          <input value={hours} onChange={(event) => setHours(event.currentTarget.value)} />
          {issues.map((issue) => <p key={issue}>{issue}</p>)}
          <button type="submit">Save record</button>
        </form>
      ) : null}
    </div>
  );
}
`,
    },
  ];
}

export function notesProposal(): AppProposal {
  return {
    summary: 'Field notes with list navigation, validated compose, title filtering and hours calculation.',
    files: files(),
    collections: notesCollections,
    behaviors: notesBehaviors,
    notes: 'Labelled mocked provider application. This is not the tracker fixture and not a paid OpenAI call.',
  };
}

export function notesTagOperations(base: AppFile[]): FileOperation[] {
  const types = base.find((file) => file.path === 'src/types.ts');
  const validate = base.find((file) => file.path === 'src/validate.ts');
  const app = base.find((file) => file.path === 'src/App.tsx');
  if (!types || !validate || !app) throw new Error('Notes revision is missing required source files.');
  return [
    {
      op: 'update',
      path: 'src/types.ts',
      baseHash: fileHash(types.content),
      content: `export type Note = { id: string; title: string; body: string; hours: number; persisted: boolean; tag: 'field' | 'office' | 'other' };
export type Route = { name: 'list' } | { name: 'compose' } | { name: 'note'; id: string };
`,
    },
    {
      op: 'update',
      path: 'src/validate.ts',
      baseHash: fileHash(validate.content),
      content: `import type { Note } from './types';
export function validateNote(input: Partial<Note>): string[] {
  const issues: string[] = [];
  if (!(input.title ?? '').trim() || (input.title ?? '').length > 80) issues.push('Title must be 1 to 80 characters.');
  if ((input.body ?? '').length > 800) issues.push('Body cannot exceed 800 characters.');
  if (typeof input.hours !== 'number' || !Number.isFinite(input.hours) || input.hours < 0) issues.push('Hours must be a non-negative number.');
  if (!input.tag || !['field', 'office', 'other'].includes(input.tag)) issues.push('Choose a tag.');
  return issues;
}
`,
    },
    {
      op: 'update',
      path: 'src/App.tsx',
      baseHash: fileHash(app.content),
      content: app.content.replace('hours: Number(hours), persisted', "hours: Number(hours), tag: 'field', persisted"),
    },
  ];
}

export function notesTagCollections(): AppCollection[] {
  return [
    {
      name: 'notes',
      fields: [...notesCollections[0]!.fields, { name: 'tag', type: 'enum', required: false, values: ['field', 'office', 'other'] }],
    },
  ];
}

export function notesSourceFiles() {
  return overlaySealedFiles(files().filter((file) => isGeneratedAppPath(file.path)));
}

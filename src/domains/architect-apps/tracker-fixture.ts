import { APP_PROFILE, APP_PROFILE_VERSION, APP_TOOLCHAIN_VERSION } from './catalog';
import { fileHash } from './hash';
import type { AppCollection, AppFile, AppProposal, FileOperation } from './schema';
import { overlaySealedFiles } from './tree';

export const trackerCollections: AppCollection[] = [
  {
    name: 'items',
    fields: [
      { name: 'title', type: 'string', required: true, max: 80 },
      { name: 'notes', type: 'string', required: false, max: 400 },
      { name: 'status', type: 'enum', required: true, values: ['open', 'doing', 'done'] },
      { name: 'hours', type: 'number', required: true },
    ],
  },
];

export const trackerBehaviors = {
  navigation: true,
  forms: true,
  validation: true,
  filtering: true,
  calculations: true,
  persistence: true,
} as const;

const envDts = `export {};
type Node = string | number | boolean | null | undefined | { [key: string]: unknown } | Node[];
interface EventTargetLike { value: string }
declare module 'react' {
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps?: unknown[]): T;
  export type ReactNode = Node;
  export type FormEvent<T = unknown> = { preventDefault(): void; currentTarget: T };
  export type ChangeEvent<T = EventTargetLike> = { currentTarget: T; target: T };
  const React: { createElement: (...args: unknown[]) => unknown };
  export default React;
}
declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
  export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
  export function jsxDEV(type: unknown, props: unknown, key?: unknown): unknown;
}
declare module 'react-dom/client' {
  export function createRoot(container: Element): { render(node: unknown): void };
}
declare module '*.css' {
  const value: string;
  export default value;
}
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>;
  }
}
declare global {
  interface Window {
    __AETHELIOS_APP_SESSION__?: string;
    __AETHELIOS_PARENT_ORIGIN__?: string;
  }
}
`;

const typesTs = `export const statuses = ['open', 'doing', 'done'] as const;
export type Status = (typeof statuses)[number];
export type Route = { name: 'board' } | { name: 'compose' } | { name: 'item'; id: string };
export type TrackerItem = {
  id: string;
  title: string;
  notes: string;
  status: Status;
  hours: number;
  persisted: boolean;
  version?: number;
};
`;

const validateTs = `import { statuses, type TrackerItem } from './types';

export function validateItem(input: Partial<TrackerItem>): string[] {
  const issues: string[] = [];
  const title = input.title?.trim() ?? '';
  if (title.length < 1 || title.length > 80) issues.push('Title must be 1 to 80 characters.');
  if ((input.notes ?? '').length > 400) issues.push('Notes cannot exceed 400 characters.');
  if (!input.status || !statuses.includes(input.status)) issues.push('Choose open, doing or done.');
  if (typeof input.hours !== 'number' || !Number.isFinite(input.hours) || input.hours < 0 || input.hours > 999)
    issues.push('Hours must be a number from 0 to 999.');
  return issues;
}
`;

const calcTs = `import type { Status, TrackerItem } from './types';

export function totals(items: TrackerItem[]) {
  const remaining = items.filter((item) => item.status !== 'done');
  const hours = remaining.reduce((sum, item) => sum + item.hours, 0);
  const complete = items.length
    ? Math.round((items.filter((item) => item.status === 'done').length / items.length) * 100)
    : 0;
  return { open: remaining.length, hours, complete, count: items.length };
}

export function filterItems(items: TrackerItem[], status: Status | 'all') {
  return status === 'all' ? items : items.filter((item) => item.status === status);
}
`;

const bridgeTs = `import type { TrackerItem } from './types';

const SCHEMA = 'architect-apps-data/v1';

type HostResponse = {
  schema: string;
  requestId: string;
  ok: boolean;
  records?: TrackerItem[];
  error?: string;
};

function parentOrigin() {
  return window.__AETHELIOS_PARENT_ORIGIN__ || '*';
}

export function requestItems(
  operation: 'list' | 'get' | 'create' | 'update',
  payload?: TrackerItem,
  idempotencyKey?: string,
  expectedVersion?: number,
) {
  return new Promise<TrackerItem[]>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Host collection timed out.'));
    }, 8000);
    function onMessage(event: MessageEvent<HostResponse>) {
      const data = event.data;
      if (!data || data.schema !== SCHEMA || data.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (!data.ok) {
        reject(new Error(data.error || 'Host collection refused the request.'));
        return;
      }
      resolve(data.records ?? []);
    }
    window.addEventListener('message', onMessage);
    window.parent.postMessage(
      {
        schema: SCHEMA,
        session: window.__AETHELIOS_APP_SESSION__ || '',
        requestId,
        operation,
        collection: 'items',
        payload,
        idempotencyKey,
        expectedVersion,
      },
      parentOrigin(),
    );
  });
}

export function listItems() {
  return requestItems('list');
}

export function saveItem(item: TrackerItem, mutationId: string) {
  return requestItems(item.persisted ? 'update' : 'create', item, mutationId, item.persisted ? item.version : undefined);
}
`;

const stylesCss = `:root {
  color-scheme: dark;
  font-family: Georgia, 'Times New Roman', serif;
  background: #050706;
  color: #e8e4dc;
}
body { margin: 0; }
.shell { min-height: 100vh; padding: 20px; }
.eyebrow { letter-spacing: 0.12em; text-transform: uppercase; color: #c4912f; font-size: 0.72rem; }
h1, h2 { font-weight: 500; }
nav { display: flex; gap: 8px; margin: 12px 0; }
button, select, input, textarea {
  font: inherit;
  color: inherit;
  background: #111412;
  border: 1px solid #2a2d2a;
  border-radius: 8px;
  padding: 8px 12px;
}
button[aria-current='page'], button.primary { border-color: #c4912f; color: #c4912f; }
.summary { color: #9aa39a; }
.grid { display: grid; gap: 10px; }
.card { padding: 12px; border: 1px solid #2a2d2a; border-radius: 12px; background: #0b0e0c; text-align: left; }
label { display: grid; gap: 4px; margin-bottom: 10px; }
.issues { color: #d27a6a; }
`;

const mainTsx = `import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');
createRoot(root).render(<App />);
`;

const appTsx = `import { useEffect, useMemo, useState } from 'react';
import { listItems, saveItem } from './bridge';
import { totals } from './calc';
import { Board } from './pages/Board';
import { Compose } from './pages/Compose';
import { Item } from './pages/Item';
import type { Route, TrackerItem } from './types';

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'board' });
  const [items, setItems] = useState<TrackerItem[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  async function refresh() {
    setItems(await listItems());
    setError('');
    setReady(true);
  }

  useEffect(() => {
    void refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Records unavailable.');
      setReady(true);
    });
  }, []);

  const summary = useMemo(() => totals(items), [items]);

  return (
    <div className="shell">
      <header>
        <p className="eyebrow">Aethelios generated application</p>
        <h1>Project tracker</h1>
        <nav>
          <button type="button" aria-current={route.name === 'board' ? 'page' : undefined} onClick={() => setRoute({ name: 'board' })}>
            Board
          </button>
          <button type="button" aria-current={route.name === 'compose' ? 'page' : undefined} onClick={() => setRoute({ name: 'compose' })}>
            New item
          </button>
        </nav>
        <p className="summary">
          {summary.open} open · {summary.hours}h remaining · {summary.complete}% complete
        </p>
        {error ? <p role="status">{error}</p> : null}
      </header>
      {ready && route.name === 'board' ? (
        <Board items={items} onOpen={(id) => setRoute({ name: 'item', id })} />
      ) : null}
      {ready && route.name === 'compose' ? (
        <Compose
          onSave={async (item, mutationId) => {
            await saveItem(item, mutationId);
            await refresh();
            setRoute({ name: 'item', id: item.id });
          }}
          onCancel={() => setRoute({ name: 'board' })}
        />
      ) : null}
      {ready && route.name === 'item' ? (
        <Item
          item={items.find((row) => row.id === route.id) ?? null}
          onSave={async (item, mutationId) => {
            await saveItem(item, mutationId);
            await refresh();
          }}
          onBack={() => setRoute({ name: 'board' })}
        />
      ) : null}
    </div>
  );
}
`;

const boardTsx = `import { useMemo, useState } from 'react';
import { filterItems } from '../calc';
import type { Status, TrackerItem } from '../types';

export function Board({ items, onOpen }: { items: TrackerItem[]; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<Status | 'all'>('all');
  const visible = useMemo(() => filterItems(items, status), [items, status]);
  return (
    <section>
      <label>
        Filter
        <select value={status} onChange={(event) => setStatus(event.currentTarget.value as Status | 'all')}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </label>
      <div className="grid">
        {visible.map((item) => (
          <button key={item.id} type="button" className="card" onClick={() => onOpen(item.id)}>
            <strong>{item.title}</strong>
            <p>{item.status} · {item.hours}h</p>
          </button>
        ))}
        {visible.length === 0 ? <p>No items match this filter.</p> : null}
      </div>
    </section>
  );
}
`;

const composeTsx = `import { useState } from 'react';
import { validateItem } from '../validate';
import type { Status, TrackerItem } from '../types';

export function Compose({
  onSave,
  onCancel,
}: {
  onSave: (item: TrackerItem, mutationId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [intent, setIntent] = useState<{ id: string; snapshot: string } | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('open');
  const [hours, setHours] = useState('1');
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState<TrackerItem | null>(null);
  const [saveError, setSaveError] = useState('');
  function snapshotOf(item: TrackerItem) {
    return JSON.stringify({ title: item.title, notes: item.notes, status: item.status, hours: item.hours });
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const item: TrackerItem = {
          id: crypto.randomUUID(),
          title,
          notes,
          status,
          hours: Number(hours),
          persisted: false,
        };
        const next = validateItem(item);
        setIssues(next);
        if (next.length) return;
        if (busy) { setHeld(item); return; }
        const snapshot = snapshotOf(item);
        const operation = intent && intent.snapshot === snapshot ? intent : { id: crypto.randomUUID(), snapshot };
        setIntent(operation);
        setBusy(true);
        setSaveError('');
        void onSave(item, operation.id)
          .then(() => {
            setIntent(null);
            if (held && snapshotOf(held) !== snapshot) {
              setTitle(held.title);
              setNotes(held.notes);
              setStatus(held.status);
              setHours(String(held.hours));
            }
            setHeld(null);
          })
          .catch((reason: unknown) => {
            setSaveError(reason instanceof Error ? reason.message : 'Save failed. Your edit is still here.');
          })
          .finally(() => setBusy(false));
      }}
    >
      <h2>New item</h2>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} required maxLength={80} />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} maxLength={400} />
      </label>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.currentTarget.value as Status)}>
          <option value="open">Open</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>
        Hours
        <input value={hours} onChange={(event) => setHours(event.currentTarget.value)} inputMode="decimal" />
      </label>
      {issues.length ? (
        <ul className="issues">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {saveError ? <p className="issues">{saveError}</p> : null}
      <button type="submit" className="primary">{busy ? 'Saving' : 'Save record'}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}
`;

const itemTsx = `import { useState } from 'react';
import { validateItem } from '../validate';
import type { Status, TrackerItem } from '../types';

export function Item({
  item,
  onSave,
  onBack,
}: {
  item: TrackerItem | null;
  onSave: (item: TrackerItem, mutationId: string) => Promise<void>;
  onBack: () => void;
}) {
  const [intent, setIntent] = useState<{ id: string; snapshot: string } | null>(null);
  const [title, setTitle] = useState(item?.title ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [status, setStatus] = useState<Status>(item?.status ?? 'open');
  const [hours, setHours] = useState(String(item?.hours ?? 0));
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState<TrackerItem | null>(null);
  const [saveError, setSaveError] = useState('');
  if (!item) return <p>Item unavailable.</p>;
  function snapshotOf(next: TrackerItem) {
    return JSON.stringify({ id: next.id, title: next.title, notes: next.notes, status: next.status, hours: next.hours });
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const next: TrackerItem = {
          ...item,
          title,
          notes,
          status,
          hours: Number(hours),
          persisted: true,
        };
        const found = validateItem(next);
        setIssues(found);
        if (found.length) return;
        if (busy) { setHeld(next); return; }
        const snapshot = snapshotOf(next);
        const operation = intent && intent.snapshot === snapshot ? intent : { id: crypto.randomUUID(), snapshot };
        setIntent(operation);
        setBusy(true);
        setSaveError('');
        void onSave(next, operation.id)
          .then(() => {
            setIntent(null);
            if (held && snapshotOf(held) !== snapshot) {
              setTitle(held.title);
              setNotes(held.notes);
              setStatus(held.status);
              setHours(String(held.hours));
            }
            setHeld(null);
          })
          .catch((reason: unknown) => {
            setSaveError(reason instanceof Error ? reason.message : 'Save failed. Your edit is still here.');
          })
          .finally(() => setBusy(false));
      }}
    >
      <h2>Edit item</h2>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} required maxLength={80} />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} maxLength={400} />
      </label>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.currentTarget.value as Status)}>
          <option value="open">Open</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>
        Hours
        <input value={hours} onChange={(event) => setHours(event.currentTarget.value)} inputMode="decimal" />
      </label>
      {issues.length ? (
        <ul className="issues">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {saveError ? <p className="issues">{saveError}</p> : null}
      <button type="submit" className="primary">{busy ? 'Saving' : 'Update record'}</button>
      <button type="button" onClick={onBack}>Back to board</button>
    </form>
  );
}
`;

export function trackerGeneratedFiles(): AppFile[] {
  return [
    { path: 'src/env.d.ts', content: envDts },
    { path: 'src/css.d.ts', content: 'declare module \'*.css\';\n' },
    { path: 'src/types.ts', content: typesTs },
    { path: 'src/validate.ts', content: validateTs },
    { path: 'src/calc.ts', content: calcTs },
    { path: 'src/bridge.ts', content: bridgeTs },
    { path: 'src/styles.css', content: stylesCss },
    { path: 'src/main.tsx', content: mainTsx },
    { path: 'src/App.tsx', content: appTsx },
    { path: 'src/pages/Board.tsx', content: boardTsx },
    { path: 'src/pages/Compose.tsx', content: composeTsx },
    { path: 'src/pages/Item.tsx', content: itemTsx },
  ];
}

export function trackerSourceFiles(): AppFile[] {
  return overlaySealedFiles(trackerGeneratedFiles());
}

export function trackerProposal(): AppProposal {
  return {
    summary:
      'Multi-file project tracker with board navigation, validated compose/edit forms, status filtering, remaining-hours calculation and host-managed records.',
    files: trackerGeneratedFiles(),
    collections: trackerCollections,
    behaviors: trackerBehaviors,
    notes:
      'Deterministic fixture application — labelled development evidence, not a live model generation. Package, lock, Vite and TypeScript files stay sealed.',
  };
}

const priorityTypesTs = `export const statuses = ['open', 'doing', 'done'] as const;
export const priorities = ['low', 'normal', 'high'] as const;
export type Status = (typeof statuses)[number];
export type Priority = (typeof priorities)[number];
export type Route = { name: 'board' } | { name: 'compose' } | { name: 'item'; id: string };
export type TrackerItem = {
  id: string;
  title: string;
  notes: string;
  status: Status;
  hours: number;
  persisted: boolean;
  version?: number;
  priority: Priority;
};
`;

const priorityValidateTs = `import { priorities, statuses, type TrackerItem } from './types';

export function validateItem(input: Partial<TrackerItem>): string[] {
  const issues: string[] = [];
  const title = input.title?.trim() ?? '';
  if (title.length < 1 || title.length > 80) issues.push('Title must be 1 to 80 characters.');
  if ((input.notes ?? '').length > 400) issues.push('Notes cannot exceed 400 characters.');
  if (!input.status || !statuses.includes(input.status)) issues.push('Choose open, doing or done.');
  if (!input.priority || !priorities.includes(input.priority)) issues.push('Choose a priority.');
  if (typeof input.hours !== 'number' || !Number.isFinite(input.hours) || input.hours < 0 || input.hours > 999)
    issues.push('Hours must be a number from 0 to 999.');
  return issues;
}
`;

const priorityBoardTsx = `import { useMemo, useState } from 'react';
import { filterItems } from '../calc';
import type { Priority, Status, TrackerItem } from '../types';

export function Board({ items, onOpen }: { items: TrackerItem[]; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const visible = useMemo(
    () => filterItems(items, status).filter((item) => priority === 'all' || item.priority === priority),
    [items, status, priority],
  );
  return (
    <section>
      <label>
        Filter
        <select value={status} onChange={(event) => setStatus(event.currentTarget.value as Status | 'all')}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>
        Priority
        <select value={priority} onChange={(event) => setPriority(event.currentTarget.value as Priority | 'all')}>
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </label>
      <div className="grid">
        {visible.map((item) => (
          <button key={item.id} type="button" className="card" onClick={() => onOpen(item.id)}>
            <strong>{item.title}</strong>
            <p>{item.status} · {item.priority} · {item.hours}h</p>
          </button>
        ))}
        {visible.length === 0 ? <p>No items match this filter.</p> : null}
      </div>
    </section>
  );
}
`;

function withPriorityField(source: string, extraLabel: string) {
  return source
    .replace(
      "status, setStatus] = useState<Status>('open');\n  const [hours, setHours]",
      "status, setStatus] = useState<Status>('open');\n  const [priority, setPriority] = useState<TrackerItem['priority']>('normal');\n  const [hours, setHours]",
    )
    .replace(
      'status,\n          hours: Number(hours),',
      "status,\n          priority,\n          hours: Number(hours),",
    )
    .replace(
      `      <label>
        Hours`,
      `      <label>
        Priority
        <select value={priority} onChange={(event) => setPriority(event.currentTarget.value as TrackerItem['priority'])}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        Hours`,
    )
    .replace('type { Status, TrackerItem }', extraLabel);
}

export function trackerPriorityOperations(base: AppFile[]): FileOperation[] {
  const byPath = new Map(base.map((file) => [file.path, file]));
  const required = ['src/types.ts', 'src/validate.ts', 'src/pages/Board.tsx', 'src/pages/Compose.tsx', 'src/pages/Item.tsx'];
  for (const path of required) {
    if (!byPath.get(path)) throw new Error(`Tracker revision is missing ${path}.`);
  }
  const compose = withPriorityField(byPath.get('src/pages/Compose.tsx')!.content, 'type { Status, TrackerItem }');
  const item = withPriorityField(
    byPath.get('src/pages/Item.tsx')!.content.replace(
      "status, setStatus] = useState<Status>(item?.status ?? 'open');\n  const [hours, setHours] = useState(String(item?.hours ?? 0));",
      "status, setStatus] = useState<Status>(item?.status ?? 'open');\n  const [priority, setPriority] = useState<TrackerItem['priority']>(item?.priority ?? 'normal');\n  const [hours, setHours] = useState(String(item?.hours ?? 0));",
    ),
    'type { Status, TrackerItem }',
  );
  return [
    {
      op: 'update',
      path: 'src/types.ts',
      content: priorityTypesTs,
      baseHash: fileHash(byPath.get('src/types.ts')!.content),
    },
    {
      op: 'update',
      path: 'src/validate.ts',
      content: priorityValidateTs,
      baseHash: fileHash(byPath.get('src/validate.ts')!.content),
    },
    {
      op: 'update',
      path: 'src/pages/Board.tsx',
      content: priorityBoardTsx,
      baseHash: fileHash(byPath.get('src/pages/Board.tsx')!.content),
    },
    {
      op: 'update',
      path: 'src/pages/Compose.tsx',
      content: compose,
      baseHash: fileHash(byPath.get('src/pages/Compose.tsx')!.content),
    },
    {
      op: 'update',
      path: 'src/pages/Item.tsx',
      content: item,
      baseHash: fileHash(byPath.get('src/pages/Item.tsx')!.content),
    },
  ];
}

export function trackerPriorityCollections(): AppCollection[] {
  return [
    {
      name: 'items',
      fields: [
        ...trackerCollections[0]!.fields,
        { name: 'priority', type: 'enum', required: false, values: ['low', 'normal', 'high'] },
      ],
    },
  ];
}

export function trackerProfile() {
  return {
    profile: APP_PROFILE,
    profileVersion: APP_PROFILE_VERSION,
    toolchain: APP_TOOLCHAIN_VERSION,
  };
}

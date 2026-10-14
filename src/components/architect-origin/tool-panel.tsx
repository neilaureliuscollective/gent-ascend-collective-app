'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SAMPLE_ESTIMATOR_LABEL,
  calculateEstimator,
  emptyEstimatorConfig,
  estimatorCurrencies,
  sampleEstimatorConfig,
  type EstimatorConfig,
  type EstimatorItem,
  type EstimatorResult,
} from '@/domains/architect-tools/engine';
import { estimatorConfigSchema } from '@/domains/architect-tools/schema';
import {
  acceptToolSaveReceipt,
  beginOrRetryToolSave,
  findCommittedToolSave,
  type ToolSaveSnapshot,
} from '@/domains/architect-tools/save-lifecycle';
import { invokeSavedTool, readToolLibrary, saveToolRevision, type ToolLibrary } from './tool-lifecycle';
import {
  clearToolSessionsForOwner,
  readToolSession,
  writeToolSession,
  type ToolWorkspaceState,
} from './tool-session';

function cloneConfig(config: EstimatorConfig): EstimatorConfig {
  return structuredClone(config);
}

function configEqual(left: EstimatorConfig, right: EstimatorConfig | null) {
  return right ? JSON.stringify(left) === JSON.stringify(right) : false;
}

export function ArchitectToolPanel({
  ownerId,
  projectId,
  locked,
  onState,
}: {
  ownerId: string;
  projectId: string;
  locked: boolean;
  onState?: (state: ToolWorkspaceState | null) => void;
}) {
  const restored = readToolSession(ownerId, projectId);
  const [library, setLibrary] = useState<ToolLibrary>({ tools: [], versions: [], invocations: [] });
  const [toolId, setToolId] = useState<string | null>(restored?.toolId ?? null);
  const [name, setName] = useState(restored?.name ?? 'Quantity and cost estimator');
  const [draft, setDraft] = useState<EstimatorConfig>(() => restored?.draft ?? emptyEstimatorConfig());
  const [expected, setExpected] = useState(restored?.expected ?? 0);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(restored?.selectedRevision ?? null);
  const [pending, setPending] = useState<ToolSaveSnapshot | null>(restored?.pending ?? null);
  const [hydrated, setHydrated] = useState(!!restored?.dirty || !!restored?.pending);
  const [message, setMessage] = useState(
    'Unsaved tool edits stay in this browser tab until you save a revision. A full browser restart is not a server save.',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invocation, setInvocation] = useState<Awaited<ReturnType<typeof invokeSavedTool>> | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const generation = useRef(0);
  const persistRef = useRef<() => Promise<void>>(async () => undefined);
  const draftRef = useRef(draft);
  const nameRef = useRef(name);
  const savedVersion = library.versions.find((version) => version.revision === expected) ?? library.versions[0] ?? null;
  const unsaved =
    !configEqual(draft, savedVersion?.configuration ?? null) || (savedVersion ? savedVersion.name !== name : true);
  const compared = library.versions.find((version) => version.revision === selectedRevision) ?? null;
  const live = useMemo(() => {
    const started = draft.items.some((item) => item.name || item.quantity || item.unit || item.unit_cost);
    if (!started) return { preview: null as EstimatorResult | null, error: '' };
    try {
      const parsed = estimatorConfigSchema.safeParse(draft);
      if (!parsed.success)
        return {
          preview: null as EstimatorResult | null,
          error: parsed.error.issues[0]?.message ?? 'Enter valid item quantities and costs.',
        };
      return { preview: calculateEstimator(parsed.data), error: '' };
    } catch (calcError) {
      return {
        preview: null as EstimatorResult | null,
        error: calcError instanceof Error ? calcError.message : 'Calculation refused.',
      };
    }
  }, [draft]);
  const preview = live.preview;
  const previewError = live.error;

  useEffect(() => {
    if (!hydrated && !pending) return;
    writeToolSession({
      ownerId,
      projectId,
      toolId,
      name,
      draft,
      expected,
      pending,
      selectedRevision,
      generation: generation.current,
      dirty: unsaved || !!pending,
    });
  }, [ownerId, projectId, toolId, name, draft, expected, pending, selectedRevision, unsaved, hydrated]);

  useEffect(() => {
    clearToolSessionsForOwner(ownerId);
    const token = ++generation.current;
    const controller = new AbortController();
    void readToolLibrary(projectId, readToolSession(ownerId, projectId)?.toolId ?? undefined, controller.signal)
      .then((data) => {
        if (token !== generation.current) return;
        setLibrary(data);
        const current = data.tools[0];
        const local = readToolSession(ownerId, projectId);
        if (local?.pending) {
          const committed = findCommittedToolSave(data.versions, local.pending);
          if (committed) {
            setPending(null);
            setToolId(committed.tool_id);
            setExpected(committed.revision);
            setHydrated(true);
            setMessage(`Recovered saved tool revision ${committed.revision} after an interrupted response.`);
          } else {
            setHydrated(true);
            return;
          }
        }
        if (local?.dirty) {
          setHydrated(true);
          return;
        }
        if (!current) {
          setHydrated(true);
          return;
        }
        setToolId(current.id);
        setName(current.name);
        setExpected(current.revision);
        const version = data.versions.find((item) => item.revision === current.revision);
        if (version) setDraft(cloneConfig(version.configuration));
        setHydrated(true);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted && token === generation.current)
          setError(loadError instanceof Error ? loadError.message : 'Tool library unavailable.');
      });
    return () => {
      controller.abort();
    };
  }, [ownerId, projectId]);

  const difference = useMemo(() => {
    if (!compared) return [];
    const notes: string[] = [];
    if (compared.name !== name) notes.push(`Name was “${compared.name}”.`);
    if (compared.configuration.waste_percent !== draft.waste_percent)
      notes.push(`Waste changed from ${compared.configuration.waste_percent ?? 'none'} to ${draft.waste_percent ?? 'none'}.`);
    if (compared.configuration.markup_percent !== draft.markup_percent)
      notes.push(`Markup changed from ${compared.configuration.markup_percent ?? 'none'} to ${draft.markup_percent ?? 'none'}.`);
    if (compared.configuration.items.length !== draft.items.length)
      notes.push(`Item count changed from ${compared.configuration.items.length} to ${draft.items.length}.`);
    return notes;
  }, [compared, draft, name]);

  function replaceDraft(next: EstimatorConfig | ((current: EstimatorConfig) => EstimatorConfig)) {
    setDraft((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      draftRef.current = resolved;
      return resolved;
    });
  }

  function replaceName(next: string) {
    nameRef.current = next;
    setName(next);
  }

  function updateItem(id: string, patch: Partial<EstimatorItem>) {
    replaceDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  async function persist() {
    if (locked || busy) return;
    const parsed = estimatorConfigSchema.safeParse(draft);
    if (!parsed.success && !pending) {
      setError(parsed.error.issues[0]?.message ?? 'The draft is not valid to save.');
      return;
    }
    let snapshot: ToolSaveSnapshot;
    try {
      snapshot = beginOrRetryToolSave({
        pending,
        ownerId,
        projectId,
        toolId,
        expected,
        name,
        configuration: pending ? pending.configuration : parsed.success ? parsed.data : draft,
        note: pending?.note ?? 'User saved estimator revision',
        nextIds: { toolId: crypto.randomUUID(), requestId: crypto.randomUUID() },
      }).snapshot;
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Save could not start.');
      return;
    }
    setPending(snapshot);
    setBusy(true);
    setError('');
    setMessage('Saving exact estimator revision…');
    try {
      const latest = await readToolLibrary(projectId, snapshot.toolId);
      const committed = findCommittedToolSave(latest.versions, snapshot);
      const saved = committed
        ? { revision: committed.revision, requestId: snapshot.requestId, personId: committed.person_id, toolId: committed.tool_id }
        : await saveToolRevision({
            projectId: snapshot.projectId,
            toolId: snapshot.toolId,
            requestId: snapshot.requestId,
            expected: snapshot.expected,
            name: snapshot.name,
            configuration: snapshot.configuration,
            note: snapshot.note,
          });
      const accepted = acceptToolSaveReceipt({
        pending: snapshot,
        receipt: saved,
        currentOwnerId: ownerId,
        currentProjectId: projectId,
        currentName: nameRef.current,
        currentConfiguration: draftRef.current,
      });
      if (accepted.status === 'ignored-stale-scope') {
        setMessage('A delayed save receipt was ignored because the owner or project changed.');
        return;
      }
      setToolId(saved.toolId);
      setExpected(accepted.expected);
      setPending(null);
      setLibrary(await readToolLibrary(projectId, saved.toolId));
      setMessage(
        accepted.draftStillUnsaved
          ? `Saved tool revision ${saved.revision}. Later edits remain an unsaved draft.`
          : `Saved tool revision ${saved.revision}. Invocation uses this exact configuration.`,
      );
    } catch (saveError) {
      setError(
        (saveError instanceof Error ? saveError.message : 'Save unconfirmed.') +
          ' The exact pending save is kept for retry. Later edits stay separate.',
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    persistRef.current = persist;
    draftRef.current = draft;
    nameRef.current = name;
  });
  useEffect(() => {
    onState?.({
      dirty: unsaved,
      pending: !!pending,
      expected,
      persist: () => persistRef.current(),
    });
  }, [unsaved, pending, expected, onState]);
  useEffect(() => () => onState?.(null), [onState]);

  async function invokeRevision(revision: number) {
    if (!toolId || !revision) {
      setError('Save a revision before invoking. An unsaved preview cannot be operated.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('Calculating the exact saved revision…');
    try {
      const receipt = await invokeSavedTool({
        projectId,
        toolId,
        revision,
        requestId: crypto.randomUUID(),
        source: 'architect',
      });
      setInvocation(receipt);
      setMessage(
        `Architect invoked ${receipt.name} revision ${receipt.revision}. Total ${receipt.result.currency} ${receipt.result.total}.`,
      );
      const data = await readToolLibrary(projectId, toolId);
      setLibrary(data);
    } catch (invokeError) {
      setError(invokeError instanceof Error ? invokeError.message : 'Invocation refused.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="origin-tool" aria-labelledby="architect-tool-title">
      <header className="origin-tool-head">
        <div>
          <p className="eyebrow">Creator-owned tool</p>
          <h3 id="architect-tool-title">Quantity and cost estimator</h3>
          <p>
            {pending
              ? 'Exact save unconfirmed. Retry uses the submitted snapshot, not later edits.'
              : unsaved
                ? 'Unsaved preview — this draft is not a saved tool revision.'
                : `Saved revision ${expected}. Invocation uses this exact configuration.`}
          </p>
        </div>
        <p className="origin-connection-chip">
          {pending ? 'Save unconfirmed' : unsaved ? 'Unsaved preview' : `Revision ${expected}`}
        </p>
      </header>
      <div className="origin-tool-layout">
        <div className="origin-tool-canvas">
          <label>
            Tool name
            <input
              value={name}
              maxLength={100}
              disabled={locked}
              onFocus={(event) => {
                lastFocus.current = event.currentTarget;
              }}
              onChange={(event) => replaceName(event.target.value)}
            />
          </label>
          {previewError ? (
            <p className="origin-understand-warning">{previewError}</p>
          ) : preview ? (
            <article className="origin-tool-result" aria-live="polite">
              <h4>
                {draft.currency} {preview.total}
              </h4>
              <p>
                Subtotal {preview.subtotal}. Waste {preview.waste_total}. Markup {preview.markup_amount}
                {preview.implied_margin_percent
                  ? `. Implied margin ${preview.implied_margin_percent}% — derived, not entered.`
                  : '. No markup.'}
              </p>
              <table>
                <caption>Readable breakdown</caption>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Effective</th>
                    <th>Unit</th>
                    <th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.name}</td>
                      <td>
                        {line.quantity} {line.unit}
                      </td>
                      <td>{line.effective_quantity}</td>
                      <td>
                        {draft.currency} {line.unit_cost}
                      </td>
                      <td>
                        {draft.currency} {line.line_total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul>
                {preview.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </article>
          ) : (
            <p>Enter named items, quantities, units and unit costs to see a live calculation.</p>
          )}
        </div>
        <aside className="origin-tool-config">
          <h4>Configuration</h4>
          <label>
            Currency
            <select
              value={draft.currency}
              disabled={locked}
              onChange={(event) =>
                replaceDraft((current) => ({
                  ...current,
                  currency: event.target.value as EstimatorConfig['currency'],
                }))
              }
            >
              {estimatorCurrencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            Waste percent
            <input
              inputMode="decimal"
              placeholder="optional"
              value={draft.waste_percent ?? ''}
              disabled={locked}
              onChange={(event) =>
                replaceDraft((current) => ({
                  ...current,
                  waste_percent: event.target.value.trim() ? event.target.value : null,
                }))
              }
            />
          </label>
          <label>
            Markup percent
            <input
              inputMode="decimal"
              placeholder="optional, not margin"
              value={draft.markup_percent ?? ''}
              disabled={locked}
              onChange={(event) =>
                replaceDraft((current) => ({
                  ...current,
                  markup_percent: event.target.value.trim() ? event.target.value : null,
                }))
              }
            />
          </label>
          <label>
            Assumptions
            <textarea
              maxLength={1000}
              value={draft.assumptions}
              disabled={locked}
              onChange={(event) => replaceDraft((current) => ({ ...current, assumptions: event.target.value }))}
            />
          </label>
          <ol className="origin-tool-items">
            {draft.items.map((item, index) => (
              <li key={item.id}>
                <p>Item {index + 1}</p>
                <label>
                  Name
                  <input
                    value={item.name}
                    maxLength={80}
                    disabled={locked}
                    onChange={(event) => updateItem(item.id, { name: event.target.value })}
                  />
                </label>
                <div className="origin-tool-item-grid">
                  <label>
                    Quantity
                    <input
                      inputMode="decimal"
                      value={item.quantity}
                      disabled={locked}
                      onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    Unit
                    <input
                      value={item.unit}
                      maxLength={24}
                      disabled={locked}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                    />
                  </label>
                  <label>
                    Unit cost
                    <input
                      inputMode="decimal"
                      value={item.unit_cost}
                      disabled={locked}
                      onChange={(event) => updateItem(item.id, { unit_cost: event.target.value })}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={locked || busy || draft.items.length >= 24}
            onClick={() =>
              replaceDraft((current) => ({
                ...current,
                items: [
                  ...current.items,
                  { id: crypto.randomUUID(), name: '', quantity: '', unit: '', unit_cost: '' },
                ],
              }))
            }
          >
            Add item
          </button>
          <button
            type="button"
            disabled={locked || busy}
            onClick={() => {
              replaceDraft(sampleEstimatorConfig());
              replaceName('Sample plywood estimator');
              setMessage(SAMPLE_ESTIMATOR_LABEL);
            }}
          >
            Load labelled sample
          </button>
        </aside>
      </div>
      <footer className="origin-tool-actions">
        <button type="button" disabled={locked || busy || !expected} onClick={() => void invokeRevision(expected)}>
          Invoke saved revision
        </button>
      </footer>
      {library.versions.length > 0 && (
        <nav className="origin-tool-versions" aria-label="Saved tool versions">
          {library.versions.map((version) => (
            <button
              key={version.id}
              type="button"
              aria-pressed={selectedRevision === version.revision}
              onClick={() => {
                setSelectedRevision(version.revision);
                replaceDraft(cloneConfig(version.configuration));
                replaceName(version.name);
                lastFocus.current?.focus({ preventScroll: true });
              }}
            >
              Revision {version.revision}
            </button>
          ))}
        </nav>
      )}
      {compared && (
        <p>
          Comparing saved revision {compared.revision}. {difference.join(' ') || 'Configuration matches this draft.'}{' '}
          Opening a prior version does not overwrite the latest saved revision until you save again.
        </p>
      )}
      {invocation && (
        <article className="origin-tool-provenance">
          <h4>Invocation receipt</h4>
          <p>
            {invocation.name} revision {invocation.revision}. Source {invocation.provenance.source}. Request{' '}
            {invocation.provenance.requestId}. Recorded {invocation.provenance.recorded ? 'yes' : 'no'}.
          </p>
          <p>
            Result {invocation.result.currency} {invocation.result.total}. This is the saved revision, not the unsaved
            draft.
          </p>
        </article>
      )}
      {(message || error) && (
        <p role="status" className={error ? 'origin-understand-warning' : undefined}>
          {error || message}
        </p>
      )}
    </section>
  );
}

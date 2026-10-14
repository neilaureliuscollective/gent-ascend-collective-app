'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BplusMaterial } from '@/components/visual/bplus-material';
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
import { invokeSavedTool, readToolLibrary, saveToolRevision, type ToolLibrary } from './tool-lifecycle';

function cloneConfig(config: EstimatorConfig): EstimatorConfig {
  return structuredClone(config);
}

function configEqual(left: EstimatorConfig, right: EstimatorConfig | null) {
  return right ? JSON.stringify(left) === JSON.stringify(right) : false;
}

export function ArchitectToolPanel({
  projectId,
  locked,
}: {
  projectId: string;
  locked: boolean;
}) {
  const [library, setLibrary] = useState<ToolLibrary>({ tools: [], versions: [], invocations: [] });
  const [toolId, setToolId] = useState<string | null>(null);
  const [name, setName] = useState('Quantity and cost estimator');
  const [draft, setDraft] = useState<EstimatorConfig>(() => emptyEstimatorConfig());
  const [expected, setExpected] = useState(0);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const [invocation, setInvocation] = useState<Awaited<ReturnType<typeof invokeSavedTool>> | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const savedVersion = library.versions.find((version) => version.revision === expected) ?? library.versions[0] ?? null;
  const unsaved = !configEqual(draft, savedVersion?.configuration ?? null) || (savedVersion ? savedVersion.name !== name : true);
  const compared = library.versions.find((version) => version.revision === selectedRevision) ?? null;
  const live = useMemo(() => {
    const started = draft.items.some((item) => item.name || item.quantity || item.unit || item.unit_cost);
    if (!started)
      return { preview: null as EstimatorResult | null, error: '' };
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
    const controller = new AbortController();
    void readToolLibrary(projectId, undefined, controller.signal)
      .then((data) => {
        setLibrary(data);
        const current = data.tools[0];
        if (!current) return;
        setToolId(current.id);
        setName(current.name);
        setExpected(current.revision);
        const version = data.versions.find((item) => item.revision === current.revision);
        if (version) setDraft(cloneConfig(version.configuration));
      })
      .catch((loadError) => {
        if (!controller.signal.aborted)
          setError(loadError instanceof Error ? loadError.message : 'Tool library unavailable.');
      });
    return () => controller.abort();
  }, [projectId]);

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

  function updateItem(id: string, patch: Partial<EstimatorItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  async function persist(note: string) {
    if (locked || busy) return;
    const parsed = estimatorConfigSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'The draft is not valid to save.');
      return;
    }
    const requestId = pendingSave ?? crypto.randomUUID();
    const id = toolId ?? crypto.randomUUID();
    setPendingSave(requestId);
    setBusy(true);
    setError('');
    setMessage('Saving exact estimator revision…');
    try {
      const saved = await saveToolRevision({
        projectId,
        toolId: id,
        requestId,
        expected,
        name,
        configuration: parsed.data,
        note,
      });
      if (!saved.personId) throw new Error('Save ownership was not confirmed.');
      setToolId(saved.toolId);
      setExpected(saved.revision);
      setPendingSave(null);
      setMessage(`Saved tool revision ${saved.revision}. This identity is what Aethelios can invoke.`);
      const data = await readToolLibrary(projectId, saved.toolId);
      setLibrary(data);
    } catch (saveError) {
      setError(
        (saveError instanceof Error ? saveError.message : 'Save unconfirmed.') +
          ' The unsaved estimator draft is kept.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function invokeRevision(revision: number, source: 'architect' | 'agent-fixture' = 'architect') {
    if (!toolId || !revision) {
      setError('Save a revision before invoking. An unsaved preview cannot be operated.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage(source === 'agent-fixture' ? 'Deterministic agent fixture invoking the saved revision…' : 'Calculating the exact saved revision…');
    try {
      const receipt = await invokeSavedTool({
        projectId,
        toolId,
        revision,
        requestId: crypto.randomUUID(),
        source,
      });
      setInvocation(receipt);
      setMessage(
        `${source === 'agent-fixture' ? 'Agent fixture' : 'Architect'} invoked ${receipt.name} revision ${receipt.revision}. Total ${receipt.result.currency} ${receipt.result.total}.`,
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
            {unsaved
              ? 'Unsaved preview — this draft is not a saved tool revision.'
              : `Saved revision ${expected}. Invocation uses this exact configuration.`}
          </p>
        </div>
        <p className="origin-connection-chip">{unsaved ? 'Unsaved preview' : `Revision ${expected}`}</p>
      </header>
      <div className="origin-tool-layout">
        <div className="origin-tool-canvas">
          <label>
            Tool name
            <input
              value={name}
              maxLength={100}
              disabled={locked || busy}
              onFocus={(event) => {
                lastFocus.current = event.currentTarget;
              }}
              onChange={(event) => setName(event.target.value)}
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
              disabled={locked || busy}
              onChange={(event) =>
                setDraft((current) => ({
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
              disabled={locked || busy}
              onChange={(event) =>
                setDraft((current) => ({
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
              disabled={locked || busy}
              onChange={(event) =>
                setDraft((current) => ({
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
              disabled={locked || busy}
              onChange={(event) => setDraft((current) => ({ ...current, assumptions: event.target.value }))}
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
                    disabled={locked || busy}
                    onChange={(event) => updateItem(item.id, { name: event.target.value })}
                  />
                </label>
                <div className="origin-tool-item-grid">
                  <label>
                    Quantity
                    <input
                      inputMode="decimal"
                      value={item.quantity}
                      disabled={locked || busy}
                      onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    Unit
                    <input
                      value={item.unit}
                      maxLength={24}
                      disabled={locked || busy}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                    />
                  </label>
                  <label>
                    Unit cost
                    <input
                      inputMode="decimal"
                      value={item.unit_cost}
                      disabled={locked || busy}
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
              setDraft((current) => ({
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
              setDraft(sampleEstimatorConfig());
              setName('Sample plywood estimator');
              setMessage(SAMPLE_ESTIMATOR_LABEL);
            }}
          >
            Load labelled sample
          </button>
        </aside>
      </div>
      <footer className="origin-tool-actions">
        <button
          type="button"
          className="button"
          data-bplus-surface="action"
          disabled={locked || busy || (!unsaved && !pendingSave)}
          onClick={() => void persist('User saved estimator revision')}
        >
          <BplusMaterial radius={8} />
          {pendingSave ? 'Retry exact save' : 'Save tool revision'}
        </button>
        <button
          type="button"
          disabled={locked || busy || !expected}
          onClick={() => void invokeRevision(expected)}
        >
          Invoke saved revision
        </button>
        <button
          type="button"
          disabled={locked || busy || !expected}
          onClick={() => void invokeRevision(expected, 'agent-fixture')}
        >
          Agent fixture invoke
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
                setDraft(cloneConfig(version.configuration));
                setName(version.name);
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

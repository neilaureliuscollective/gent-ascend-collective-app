'use client';
import {
  allowedDisplays,
  applyCompositionCommand,
  catalogEntry,
  resolveComposition,
  toolSectionCatalog,
} from '@/domains/health/composition';
import type { SavedObservation } from '@/domains/health/schema';
import type { HealthWorkspaceRecord, SelectedElement } from '@/domains/health/workspace-model';

export function CompositionPane({
  workspace,
  selected,
  observations,
  blocked,
  onApply,
}: {
  workspace: HealthWorkspaceRecord;
  selected: SelectedElement | null;
  observations: SavedObservation[];
  blocked: boolean;
  onApply: (next: HealthWorkspaceRecord, note: string) => void;
}) {
  const composition = resolveComposition(workspace);
  const section =
    selected?.kind === 'section'
      ? composition.sections.find((item) => item.id === selected.id)
      : null;
  return (
    <div className="health-pane">
      <p className="health-kicker">Customize</p>
      {section ? (
        <>
          <h2>{section.title}</h2>
          <label>
            Section name
            <input
              value={section.title}
              maxLength={80}
              disabled={blocked}
              aria-label="Section name"
              onChange={(event) => {
                const result = applyCompositionCommand(
                  workspace,
                  { kind: 'rename-section', id: section.id, title: event.target.value },
                  observations,
                );
                onApply(result.workspace, result.note);
              }}
            />
          </label>
          <label>
            Display
            <select
              value={section.display}
              aria-label="Section display"
              disabled={blocked}
              onChange={(event) => {
                const result = applyCompositionCommand(
                  workspace,
                  {
                    kind: 'set-display',
                    id: section.id,
                    display: event.target.value as typeof section.display,
                  },
                  observations,
                );
                onApply(result.workspace, result.note);
              }}
            >
              {allowedDisplays(section.kind).map((display) => (
                <option key={display} value={display}>
                  {display}
                </option>
              ))}
            </select>
          </label>
          <div className="health-pane-actions">
            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                const result = applyCompositionCommand(
                  workspace,
                  { kind: 'move-section', id: section.id, direction: 'up' },
                  observations,
                );
                onApply(result.workspace, result.note);
              }}
            >
              Move up
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                const result = applyCompositionCommand(
                  workspace,
                  { kind: 'move-section', id: section.id, direction: 'down' },
                  observations,
                );
                onApply(result.workspace, result.note);
              }}
            >
              Move down
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                const result = applyCompositionCommand(
                  workspace,
                  { kind: 'remove-section', id: section.id },
                  observations,
                );
                onApply(result.workspace, result.note);
              }}
            >
              Remove section
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Change the structure</h2>
          <p>Select a section on the tool, or add one of the supported pieces.</p>
        </>
      )}
      <div className="health-pane-add">
        <p className="health-kicker">Add to this tool</p>
        {toolSectionCatalog.map((item) => (
          <button
            key={item.kind}
            type="button"
            disabled={blocked || composition.sections.some((section) => section.kind === item.kind)}
            onClick={() => {
              const result = applyCompositionCommand(
                workspace,
                { kind: 'add-section', sectionKind: item.kind },
                observations,
              );
              onApply(result.workspace, result.note);
            }}
          >
            {item.title}
            <small>{item.summary}</small>
          </button>
        ))}
      </div>
      <p className="health-footnote">
        {catalogEntry('sequence').summary} Custom layout cannot change laboratory values, units or
        provenance.
      </p>
    </div>
  );
}

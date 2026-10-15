'use client';
import { visibleSections } from '@/domains/health/composition';
import type { HealthRecord, SavedObservation } from '@/domains/health/schema';
import type { RoutineProgress } from '@/domains/health/routine';
import {
  defaultBloodworkSettings,
  type HealthWorkspaceRecord,
  type SelectedElement,
  type ToolSection,
} from '@/domains/health/workspace-model';
import { BloodworkTool, type BloodworkPart } from './bloodwork-tool';
import { RoutineTool, type RoutinePart } from './routine-tool';

export function ComposedTool({
  workspace,
  observations,
  records,
  selected,
  blocked,
  customize,
  onChange,
  onBloodwork,
  onSelect,
}: {
  workspace: HealthWorkspaceRecord;
  observations: SavedObservation[];
  records: HealthRecord[];
  selected: SelectedElement | null;
  blocked: boolean;
  customize: boolean;
  onChange: (progress: RoutineProgress) => void;
  onBloodwork: (settings: NonNullable<HealthWorkspaceRecord['settings']['bloodwork']>) => void;
  onSelect: (next: SelectedElement) => void;
}) {
  const sections = visibleSections(workspace);
  if (!sections.length) {
    return (
      <div className="health-empty-surface">
        <h2>This tool has no sections yet.</h2>
        <p>
          Add a sequence, notes, a marker trend or a results table. Generated apps are unavailable,
          so the tool is assembled from these supported pieces.
        </p>
      </div>
    );
  }
  return (
    <div className="health-composed" data-customize={customize}>
      {sections.map((section) => (
        <article
          key={section.id}
          className="health-composed-section"
          data-kind={section.kind}
          data-selected={selected?.kind === 'section' && selected.id === section.id}
          onClick={(event) => {
            if (!customize) return;
            if ((event.target as HTMLElement).closest('button, input, textarea, select, a')) return;
            onSelect({ kind: 'section', id: section.id });
          }}
        >
          {customize && (
            <button
              type="button"
              className="health-section-label"
              aria-pressed={selected?.kind === 'section' && selected.id === section.id}
              onClick={() => onSelect({ kind: 'section', id: section.id })}
            >
              {section.title}
            </button>
          )}
          <SectionBody
            section={section}
            workspace={workspace}
            observations={observations}
            records={records}
            selected={selected}
            blocked={blocked}
            onChange={onChange}
            onBloodwork={onBloodwork}
            onSelect={onSelect}
          />
        </article>
      ))}
    </div>
  );
}

function SectionBody({
  section,
  workspace,
  observations,
  records,
  selected,
  blocked,
  onChange,
  onBloodwork,
  onSelect,
}: {
  section: ToolSection;
  workspace: HealthWorkspaceRecord;
  observations: SavedObservation[];
  records: HealthRecord[];
  selected: SelectedElement | null;
  blocked: boolean;
  onChange: (progress: RoutineProgress) => void;
  onBloodwork: (settings: NonNullable<HealthWorkspaceRecord['settings']['bloodwork']>) => void;
  onSelect: (next: SelectedElement) => void;
}) {
  if (section.kind === 'hero' || section.kind === 'sequence' || section.kind === 'notes') {
    if (!workspace.progress) return null;
    const parts: RoutinePart[] =
      section.kind === 'hero' ? ['hero'] : section.kind === 'sequence' ? ['sequence'] : ['notes'];
    return (
      <RoutineTool
        progress={workspace.progress}
        selected={selected}
        blocked={blocked}
        parts={parts}
        onChange={onChange}
        onSelect={onSelect}
      />
    );
  }
  const parts: BloodworkPart[] =
    section.kind === 'trend' ? ['hero', 'trend'] : section.kind === 'table' ? ['table'] : ['source'];
  return (
    <BloodworkTool
      observations={observations}
      records={records}
      settings={workspace.settings.bloodwork ?? defaultBloodworkSettings()}
      sample={workspace.sample}
      selected={selected}
      blocked={blocked}
      parts={parts}
      onSettings={onBloodwork}
      onSelect={onSelect}
    />
  );
}

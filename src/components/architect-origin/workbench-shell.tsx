import { BplusMaterial } from '@/components/visual/bplus-material';
import type {
  OriginProject,
  OriginVersion,
  ProjectContent,
} from '@/domains/architect-origin/schema';
import { sections } from '@/domains/architect-origin/schema';
import { ChoiceArtwork } from './choice-artwork';

export type WorkbenchView = 'plan' | 'changes' | 'checks' | 'preview';
export type FoldPanel = 'canvas' | 'outline' | 'refine' | 'revisions';

const viewCopy: Record<WorkbenchView, string> = {
  plan: 'Plan',
  changes: 'Changes',
  checks: 'Checks',
  preview: 'Preview',
};

export function WorkbenchHeader({
  project,
  draft,
  view,
  connectionLabel,
  onView,
}: {
  project: OriginProject;
  draft: ProjectContent;
  view: WorkbenchView;
  connectionLabel: string;
  onView: (view: WorkbenchView) => void;
}) {
  return (
    <header className="origin-workbench-bar">
      <div className="origin-workbench-identity">
        <span className="origin-workbench-thumb" aria-hidden="true">
          <ChoiceArtwork discipline={draft.discipline} />
        </span>
        <div>
          <p className="eyebrow">
            {draft.discipline} / {draft.status} / revision {project.revision}
          </p>
          <h2>{draft.name}</h2>
        </div>
      </div>
      <nav className="origin-workbench-views" aria-label="Workbench views">
        {(Object.keys(viewCopy) as WorkbenchView[]).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-current={view === tab ? 'page' : undefined}
            aria-label={tab === 'preview' ? 'Artifact preview' : viewCopy[tab]}
            data-bplus-surface={view === tab ? 'selection' : undefined}
            onClick={() => onView(tab)}
          >
            {view === tab && <BplusMaterial radius={8} />}
            {viewCopy[tab]}
          </button>
        ))}
      </nav>
      <div className="origin-workbench-meta">
        <p className="origin-connection-chip">{connectionLabel}</p>
        <button
          type="button"
          disabled
          title="Production publishing is not available from this workbench."
        >
          Publish
        </button>
      </div>
    </header>
  );
}

export function OutlineRail({
  draft,
  section,
  onSection,
  onSurface,
  surface,
}: {
  draft: ProjectContent;
  section: keyof typeof sections;
  onSection: (key: keyof typeof sections) => void;
  onSurface: (
    surface: 'Conversation' | 'Blueprint' | 'Research' | 'Deliverables' | 'History',
  ) => void;
  surface: string;
}) {
  return (
    <aside className="origin-rail" aria-label="Outline and context">
      <p className="origin-kicker">Brief</p>
      <p className="origin-rail-brief">
        {draft.description || draft.blueprint.vision || 'No brief yet.'}
      </p>
      <p className="origin-kicker">Outline</p>
      <nav className="origin-outline" aria-label="Blueprint outline">
        {Object.entries(sections).map(([key, label], index) => (
          <button
            key={key}
            type="button"
            aria-current={section === key && surface === 'Blueprint' ? 'true' : undefined}
            onClick={() => {
              onSurface('Blueprint');
              onSection(key as keyof typeof sections);
            }}
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function RevisionStrip({
  versions,
  currentRevision,
  compareId,
  onSelect,
}: {
  versions: OriginVersion[];
  currentRevision: number;
  compareId: string | null;
  onSelect: (version: OriginVersion | null) => void;
}) {
  const selected = versions.find((version) => version.id === compareId) ?? null;
  const oldest = versions[versions.length - 1] ?? null;
  const previous =
    versions.find((version) => version.revision === currentRevision - 1) ??
    versions.find((version) => version.revision !== currentRevision) ??
    null;
  return (
    <div className="origin-revisions" aria-label="Revisions">
      <p>{versions.length ? 'Saved revisions' : 'No saved revisions yet'}</p>
      <div className="origin-revision-pills">
        <button type="button" aria-pressed={!selected} onClick={() => onSelect(null)}>
          Current
        </button>
        {oldest && oldest.revision !== currentRevision && (
          <button
            type="button"
            aria-pressed={compareId === oldest.id}
            onClick={() => onSelect(oldest)}
          >
            Original
          </button>
        )}
        {versions.slice(0, 4).map((version) => (
          <button
            key={version.id}
            type="button"
            aria-pressed={compareId === version.id}
            onClick={() => onSelect(version)}
          >
            Revision {version.revision}
            {version.revision === currentRevision ? ' · current' : ''}
          </button>
        ))}
        {previous && versions.length > 1 && (
          <button
            type="button"
            aria-pressed={!!selected && compareId === previous.id}
            onClick={() => onSelect(selected?.id === previous.id ? null : previous)}
          >
            Compare previous
          </button>
        )}
      </div>
      {selected && (
        <p className="origin-revision-note">
          Comparing saved revision {selected.revision} with current revision {currentRevision}.
          Accepting a restoration still requires an explicit save.
        </p>
      )}
      {!versions.length && (
        <p className="origin-revision-note">History appears after the first confirmed save.</p>
      )}
    </div>
  );
}

export function FoldDock({
  panel,
  onPanel,
}: {
  panel: FoldPanel;
  onPanel: (panel: FoldPanel) => void;
}) {
  return (
    <nav className="origin-fold-dock" aria-label="Workbench panels">
      {(
        [
          ['canvas', 'Canvas'],
          ['outline', 'Outline'],
          ['refine', 'Refine'],
          ['revisions', 'Revisions'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-current={panel === id ? 'page' : undefined}
          onClick={() => onPanel(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

import { BplusMaterial } from '@/components/visual/bplus-material';
import { ChoiceCard, creationChoices } from './choice-card';
import type { OriginProject, ProjectContent } from '@/domains/architect-origin/schema';

export type BriefStage = 'idea' | 'audience' | 'outcome';

export function CreationEntry({
  discipline,
  idea,
  name,
  audience,
  constraints,
  outcome,
  stage,
  locked,
  enabled,
  pendingReferences,
  projects,
  selectedId,
  onDiscipline,
  onIdea,
  onName,
  onAudience,
  onConstraints,
  onOutcome,
  onStage,
  onAddReference,
  onOpenProject,
  onSubmit,
  onCreateTool,
}: {
  discipline: ProjectContent['discipline'];
  idea: string;
  name: string;
  audience: string;
  constraints: string;
  outcome: string;
  stage: BriefStage;
  locked: boolean;
  enabled: boolean;
  pendingReferences: number;
  projects: OriginProject[];
  selectedId: string | null;
  onDiscipline: (discipline: ProjectContent['discipline']) => void;
  onIdea: (value: string) => void;
  onName: (value: string) => void;
  onAudience: (value: string) => void;
  onConstraints: (value: string) => void;
  onOutcome: (value: string) => void;
  onStage: (stage: BriefStage) => void;
  onAddReference: () => void;
  onOpenProject: (project: OriginProject) => void;
  onSubmit: () => void;
  onCreateTool: () => void;
}) {
  const starter = creationChoices.find((choice) => choice.discipline === discipline);
  return (
    <div className="origin-entry origin-studio-entry">
      <header className="origin-question">
        <p>Choose a path, then describe the idea. The brief below only uses what you type.</p>
      </header>
      <div className="origin-starters origin-choices">
        {creationChoices.map((choice) => (
          <ChoiceCard
            key={choice.discipline}
            {...choice}
            selected={discipline === choice.discipline}
            disabled={locked}
            onSelect={() => onDiscipline(choice.discipline)}
          />
        ))}
      </div>
      <form
        className="origin-intake origin-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <p className="origin-starter-context">{starter?.detail}</p>
        <p className="origin-kicker">Your idea</p>
        <label htmlFor="origin-idea">Tell Aethelios what you want to create</label>
        <textarea
          id="origin-idea"
          placeholder="A focused planning app for independent design studios."
          maxLength={2000}
          minLength={3}
          required
          value={idea}
          onChange={(event) => onIdea(event.target.value)}
          disabled={locked}
        />
        <p className="origin-tool-entry">
          After this project exists you can save a quantity-and-cost estimator and invoke that exact
          revision. This is a creator-owned tool, not a construction or engineering product.
        </p>
        <div className="origin-composer-tools">
          <button
            type="button"
            className="button"
            data-bplus-surface="action"
            disabled={!enabled || locked || idea.trim().length < 3}
            onClick={onCreateTool}
          >
            <BplusMaterial radius={8} />
            Create a quantity & cost estimator
          </button>
          <button type="button" disabled={locked} onClick={onAddReference}>
            Add reference{pendingReferences ? ` (${pendingReferences})` : ''}
          </button>
          <button type="button" disabled title="Voice capture is not available in Architect.">
            Voice
          </button>
          <button
            className="button origin-shape"
            data-bplus-surface="action"
            aria-label="Create & save project"
            disabled={!enabled || locked || idea.trim().length < 3}
          >
            <BplusMaterial radius={8} />
            Shape the brief →
          </button>
        </div>
        <ol className="origin-brief-steps">
          {(
            [
              ['idea', '01', 'Idea'],
              ['audience', '02', 'Audience'],
              ['outcome', '03', 'First outcome'],
            ] as const
          ).map(([key, index, label]) => (
            <li key={key}>
              <button
                type="button"
                aria-current={stage === key ? 'step' : undefined}
                disabled={locked || (key !== 'idea' && idea.trim().length < 3)}
                onClick={() => onStage(key)}
              >
                {index} {label}
              </button>
            </li>
          ))}
        </ol>
        {stage === 'audience' && (
          <div className="origin-brief-extra">
            <label htmlFor="origin-audience">Audience (optional)</label>
            <textarea
              id="origin-audience"
              maxLength={3000}
              value={audience}
              onChange={(event) => onAudience(event.target.value)}
              disabled={locked}
              placeholder="Who this is for."
            />
            <label htmlFor="origin-constraints">Constraints (optional)</label>
            <textarea
              id="origin-constraints"
              maxLength={3000}
              value={constraints}
              onChange={(event) => onConstraints(event.target.value)}
              disabled={locked}
              placeholder="Limits, materials, platforms or non-goals."
            />
          </div>
        )}
        {stage === 'outcome' && (
          <div className="origin-brief-extra">
            <label htmlFor="origin-outcome">First outcome (optional)</label>
            <textarea
              id="origin-outcome"
              maxLength={3000}
              value={outcome}
              onChange={(event) => onOutcome(event.target.value)}
              disabled={locked}
              placeholder="The first useful result you want to hold."
            />
          </div>
        )}
        <label htmlFor="origin-name">Project name (optional)</label>
        <input
          id="origin-name"
          maxLength={100}
          value={name}
          onChange={(event) => onName(event.target.value)}
          disabled={locked}
          placeholder="Name it later"
        />
      </form>
      <div className="origin-entry-lower">
        {projects.length > 0 ? (
          <section className="origin-library-panel" aria-labelledby="origin-library-title">
            <h3 id="origin-library-title">Project library</h3>
            <ul>
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    disabled={locked}
                    aria-current={project.id === selectedId ? 'page' : undefined}
                    onClick={() => onOpenProject(project)}
                  >
                    <span>
                      {project.content.name}
                      <small>
                        {project.content.status} · v{project.revision}
                      </small>
                    </span>
                    Open preview →
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="origin-library-empty">
            No saved projects yet. Shaping a brief creates the first revision.
          </p>
        )}
        <EmergingBrief
          disciplineTitle={starter?.title ?? 'Start without limits'}
          idea={idea}
          audience={audience}
          constraints={constraints}
          outcome={outcome}
        />
      </div>
    </div>
  );
}

export function EmergingBrief({
  disciplineTitle,
  idea,
  audience,
  constraints,
  outcome,
}: {
  disciplineTitle: string;
  idea: string;
  audience: string;
  constraints: string;
  outcome: string;
}) {
  return (
    <aside className="origin-emerging" aria-label="Emerging brief">
      <h3>Your brief takes shape here</h3>
      <p className="origin-emerging-kind">{disciplineTitle}</p>
      <dl>
        <div>
          <dt>Idea</dt>
          <dd>{idea.trim() || 'Waiting for your words.'}</dd>
        </div>
        <div>
          <dt>Audience</dt>
          <dd>{audience.trim() || '—'}</dd>
        </div>
        <div>
          <dt>Constraints</dt>
          <dd>{constraints.trim() || '—'}</dd>
        </div>
        <div>
          <dt>First outcome</dt>
          <dd>{outcome.trim() || '—'}</dd>
        </div>
      </dl>
      <p className="origin-emerging-note">
        This brief uses only what you typed. Empty fields are not filled with proposals.
      </p>
    </aside>
  );
}

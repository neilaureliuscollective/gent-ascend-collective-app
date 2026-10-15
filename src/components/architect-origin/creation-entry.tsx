import { BplusMaterial } from '@/components/visual/bplus-material';
import {
  applicationFirstVisit,
  creationPathProfile,
  illustrativeApplicationModel,
  labeledDirectionOptions,
  pathSwitchNote,
  teachFor,
  type CreationPath,
} from '@/domains/architect-origin/creation-journey';
import type { OriginProject, ProjectContent } from '@/domains/architect-origin/schema';
import { ChoiceArtwork } from './choice-artwork';
import { ChoiceCard, creationChoices } from './choice-card';
import { CreationGuide } from './creation-guide';

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
  firstVisit,
  guided = true,
  helpOpen = false,
  pathOpened = false,
  onDiscipline,
  onIdea,
  onName,
  onAudience,
  onConstraints,
  onOutcome,
  onStage,
  onFirstVisit,
  onSkipGuided,
  onToggleHelp,
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
  firstVisit?: string;
  guided?: boolean;
  helpOpen?: boolean;
  pathOpened?: boolean;
  onDiscipline: (discipline: ProjectContent['discipline']) => void;
  onIdea: (value: string) => void;
  onName: (value: string) => void;
  onAudience: (value: string) => void;
  onConstraints: (value: string) => void;
  onOutcome: (value: string) => void;
  onStage: (stage: BriefStage) => void;
  onFirstVisit?: (value: string) => void;
  onSkipGuided?: () => void;
  onToggleHelp?: () => void;
  onAddReference: () => void;
  onOpenProject: (project: OriginProject) => void;
  onSubmit: () => void;
  onCreateTool: () => void;
}) {
  const profile = creationPathProfile(discipline);
  const currentQuestion =
    stage === 'idea'
      ? { id: 'idea', field: 'idea' as const, prompt: 'Describe what you want to create' }
      : profile.questions.find((row) => (stage === 'audience' ? row.field !== 'outcome' : row.field === 'outcome')) ??
        profile.questions[0]!;
  const model =
    discipline === 'application'
      ? illustrativeApplicationModel({ idea, firstVisit, audience })
      : null;
  const directions = labeledDirectionOptions(discipline);
  const questionValue =
    currentQuestion.field === 'idea' ? idea : currentQuestion.field === 'audience' ? audience : currentQuestion.field === 'outcome' ? outcome : constraints;
  const setQuestionValue =
    currentQuestion.field === 'idea'
      ? onIdea
      : currentQuestion.field === 'audience'
        ? onAudience
        : currentQuestion.field === 'outcome'
          ? onOutcome
          : onConstraints;
  const world = projects.length ? 'return' : pathOpened ? (idea.trim().length >= 3 ? 'shape' : 'path') : 'arrival';

  return (
    <div
      className="origin-entry origin-studio-entry"
      data-world-state={world}
      data-returning={projects.length > 0 ? 'true' : 'false'}
    >
      <header className="origin-question">
        <p>Choose a path, then describe the idea. The brief below only uses what you type.</p>
      </header>
      <div className={`origin-starters origin-choices${pathOpened ? ' origin-choices-compact' : ''}`}>
        {creationChoices.map((choice) => (
          <ChoiceCard
            key={choice.discipline}
            {...choice}
            selected={pathOpened && discipline === choice.discipline}
            disabled={locked}
            onSelect={() => onDiscipline(choice.discipline)}
          />
        ))}
      </div>
      {pathOpened ? (
        <section className="origin-path-stage" aria-label={`${profile.title} working stage`}>
          <div className="origin-path-hero">
            <span className="origin-path-object" aria-hidden="true">
              <ChoiceArtwork discipline={discipline} featured />
            </span>
            <div>
              <p className="origin-kicker">{profile.title}</p>
              <p className="origin-path-limit">{profile.limit}</p>
              <p className="origin-path-outputs">Expected: {profile.outputs.join(' · ')}</p>
            </div>
          </div>
          <ol className="origin-path-facets">
            {profile.facets.map((facet) => (
              <li key={facet.id}>
                <strong>{facet.title}</strong>
                <span>{facet.detail}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p className="origin-entry-links">
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            const example = profile.examples[0];
            if (example) onIdea(example.idea);
          }}
        >
          Explore an example
        </button>
        <button type="button" disabled={locked} onClick={onToggleHelp}>
          Show me how
        </button>
      </p>
      <form
        className="origin-intake origin-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <p className="origin-starter-context">{profile.detail}</p>
        <p className="origin-kicker">Your idea</p>
        <label htmlFor="origin-idea">Tell Aethelios what you want to create</label>
        <textarea
          id="origin-idea"
          placeholder="Describe what you want to create"
          maxLength={2000}
          minLength={3}
          required
          value={idea}
          onChange={(event) => onIdea(event.target.value)}
          disabled={locked}
        />
        {guided && pathOpened ? (
          <div className="origin-guided">
            <label htmlFor="origin-guided-field">{currentQuestion.prompt}</label>
            {currentQuestion.field !== 'idea' ? (
              <textarea
                id="origin-guided-field"
                maxLength={3000}
                value={questionValue}
                onChange={(event) => setQuestionValue(event.target.value)}
                disabled={locked}
              />
            ) : null}
            {discipline === 'application' && onFirstVisit ? (
              <fieldset className="origin-first-visit">
                <legend>What should someone finish on the first visit?</legend>
                {applicationFirstVisit.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name="origin-first-visit"
                      checked={firstVisit === option.id}
                      disabled={locked}
                      onChange={() => onFirstVisit(option.id)}
                    />
                    <strong>{option.title}</strong>
                    <span>{option.detail}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="origin-guided-nav">
              <button type="button" disabled={locked || stage === 'idea'} onClick={() => onStage('idea')}>
                Back
              </button>
              <button
                type="button"
                disabled={locked || idea.trim().length < 3}
                onClick={() => onStage(stage === 'idea' ? 'audience' : 'outcome')}
              >
                Next question
              </button>
              <button type="button" disabled={locked} onClick={onSkipGuided}>
                Skip guided questions
              </button>
            </div>
          </div>
        ) : null}
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
            Shape this direction →
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
        {stage === 'audience' && !guided && (
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
        {stage === 'outcome' && !guided && (
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
      {model ? (
        <section className="origin-model" aria-label="Illustrative model">
          <p className="origin-kicker">Give your idea a shape</p>
          <p>{model.label}</p>
          <ol className="origin-model-nodes">
            {model.nodes.map((node) => (
              <li key={node.id} data-kind={node.kind}>
                <strong>{node.title}</strong>
                <span>{node.detail}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <EmergingBrief
          disciplineTitle={profile.title}
          idea={idea}
          audience={audience}
          constraints={constraints}
          outcome={outcome}
        />
      )}
      <section className="origin-directions" aria-label="Supported directions">
        <p className="origin-kicker">Compare a labelled example</p>
        {directions.map((option) => (
          <article key={option.id}>
            <p>
              <strong>{option.title}</strong> <span>Example</span>
            </p>
            <p>{option.summary}</p>
            <p>{option.tradeoff}</p>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                onIdea(option.summary);
              }}
            >
              Use this example
            </button>
          </article>
        ))}
        <p>Unselected directions stay available. These are labelled examples, not generated alternatives or confidence scores.</p>
      </section>
      <CreationGuide teach={teachFor(discipline)} open={helpOpen} onToggle={() => onToggleHelp?.()} />
      <div className="origin-entry-lower">
        {projects.length > 0 ? (
          <section className="origin-library-panel" aria-labelledby="origin-library-title">
            <h3 id="origin-library-title">Project shelf</h3>
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
                    Resume →
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

export function switchPathNote(from: CreationPath, to: CreationPath, idea: string) {
  return pathSwitchNote(from, to, idea);
}

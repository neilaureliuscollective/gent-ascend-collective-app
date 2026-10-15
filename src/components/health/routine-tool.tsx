'use client';
import {
  acceptPendingPlan,
  completeRoutineStep,
  eveningCatalog,
  formatTimer,
  pauseRoutineTimer,
  proposeConstraintChange,
  resumeRoutineTimer,
  startRoutineTimer,
  unavailableExternalActions,
  type EveningStepId,
  type RoutineProgress,
} from '@/domains/health/routine';
import type { SelectedElement } from '@/domains/health/workspace-model';

export function RoutineTool({
  progress,
  selected,
  blocked,
  onChange,
  onSelect,
}: {
  progress: RoutineProgress;
  selected: SelectedElement | null;
  blocked: boolean;
  onChange: (next: RoutineProgress) => void;
  onSelect: (next: SelectedElement) => void;
}) {
  const plan = progress.pending ?? progress.accepted;
  return (
    <div className="health-tool" data-tool="evening-routine">
      <header className="health-tool-header">
        <p className="health-kicker">Everyday sequence</p>
        <h2>Finish at {progress.constraint.finishAt}, then cook with a real time limit.</h2>
        <p>
          {plan.explanation} Timers run in this workspace. Calendar, purchases, messages and devices
          stay unavailable until a real connection exists.
        </p>
      </header>
      <fieldset className="health-constraints" disabled={blocked}>
        <legend>Time constraints</legend>
        <label>
          Available minutes
          <input
            type="number"
            min={4}
            max={90}
            value={progress.constraint.availableMinutes}
            aria-label="Available minutes"
            onChange={(e) =>
              onChange(
                proposeConstraintChange(progress, { availableMinutes: Number(e.target.value) }),
              )
            }
            onFocus={() => onSelect({ kind: 'constraint', id: 'minutes' })}
          />
        </label>
        <label>
          Finish time
          <input
            type="time"
            value={progress.constraint.finishAt}
            aria-label="Finish time"
            onChange={(e) =>
              onChange(proposeConstraintChange(progress, { finishAt: e.target.value }))
            }
            onFocus={() => onSelect({ kind: 'constraint', id: 'finish' })}
          />
        </label>
      </fieldset>
      {progress.pending && (
        <div className="health-proposal" role="status">
          <p>Proposed change. Nothing is applied until you accept.</p>
          <ul>
            {progress.pending.dropped.map((item) => (
              <li key={item.id}>
                Hold back {item.title}: {item.reason}
              </li>
            ))}
            {progress.pending.shortened.map((item) => (
              <li key={item.id}>
                Shorten {item.id} from {item.from} to {item.to} minutes.
              </li>
            ))}
          </ul>
          <button disabled={blocked} onClick={() => onChange(acceptPendingPlan(progress))}>
            Accept update
          </button>
          <button
            disabled={blocked}
            onClick={() =>
              onChange({
                ...progress,
                pending: null,
                constraint: {
                  availableMinutes: progress.accepted.availableMinutes,
                  finishAt: progress.constraint.finishAt,
                  selected: progress.constraint.selected,
                },
              })
            }
          >
            Keep current sequence
          </button>
        </div>
      )}
      <ol className="health-sequence">
        {plan.steps.map((step) => {
          const done = progress.completed.includes(step.id);
          const active = selected?.id === step.id;
          const timer = progress.timer?.stepId === step.id ? progress.timer : null;
          return (
            <li key={step.id} data-included={step.included} data-selected={active}>
              <button
                type="button"
                className="health-step"
                aria-pressed={active}
                disabled={!step.included}
                onClick={() => onSelect({ kind: 'step', id: step.id })}
              >
                <span>{step.title}</span>
                <small>
                  {step.included ? `${step.scheduledMinutes} min` : 'Not in this limit'}
                  {done ? ' · done' : ''}
                </small>
              </button>
              {step.included && (
                <div className="health-step-actions">
                  {step.kind === 'timer' && (
                    <button
                      disabled={blocked || done}
                      onClick={() => {
                        onSelect({ kind: 'timer', id: step.id });
                        if (!timer)
                          onChange({
                            ...progress,
                            activeStepId: step.id,
                            timer: startRoutineTimer(step.id, step.scheduledMinutes),
                          });
                        else if (timer.running)
                          onChange({ ...progress, timer: pauseRoutineTimer(timer) });
                        else onChange({ ...progress, timer: resumeRoutineTimer(timer) });
                      }}
                    >
                      {!timer
                        ? 'Start timer'
                        : timer.running
                          ? `Pause ${formatTimer(timer.remainingMs)}`
                          : timer.remainingMs <= 0
                            ? 'Timer finished'
                            : `Resume ${formatTimer(timer.remainingMs)}`}
                    </button>
                  )}
                  <button
                    disabled={blocked || done || !step.included}
                    onClick={() => onChange(completeRoutineStep(progress, step.id))}
                  >
                    {done ? 'Completed' : 'Mark done'}
                  </button>
                </div>
              )}
              {active && (
                <label>
                  Preparation note
                  <textarea
                    maxLength={400}
                    value={progress.notes[step.id] ?? step.note}
                    disabled={blocked}
                    onChange={(e) =>
                      onChange({
                        ...progress,
                        notes: { ...progress.notes, [step.id]: e.target.value },
                      })
                    }
                  />
                </label>
              )}
            </li>
          );
        })}
      </ol>
      <aside className="health-unavailable" aria-label="Unavailable external actions">
        <p className="health-kicker">Not connected</p>
        {unavailableExternalActions.map((item) => (
          <p key={item.id}>
            <button type="button" disabled>
              {item.label}
            </button>
            <small>{item.reason}</small>
          </p>
        ))}
      </aside>
    </div>
  );
}

export function eveningStepTitle(id: EveningStepId) {
  return eveningCatalog.find((step) => step.id === id)?.title ?? id;
}

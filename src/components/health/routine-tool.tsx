'use client';
import {
  acceptPendingPlan,
  completeRoutineStep,
  eveningCatalog,
  formatTimer,
  nextRoutineStep,
  pauseRoutineTimer,
  proposeConstraintChange,
  resumeRoutineTimer,
  startRoutineTimer,
  unavailableExternalActions,
  type EveningStepId,
  type RoutineProgress,
} from '@/domains/health/routine';
import type { SelectedElement } from '@/domains/health/workspace-model';

export type RoutinePart = 'hero' | 'sequence' | 'notes';

export function RoutineTool({
  progress,
  selected,
  blocked,
  onChange,
  onSelect,
  parts = ['hero', 'sequence', 'notes'],
}: {
  progress: RoutineProgress;
  selected: SelectedElement | null;
  blocked: boolean;
  onChange: (next: RoutineProgress) => void;
  onSelect: (next: SelectedElement) => void;
  parts?: RoutinePart[];
}) {
  const plan = progress.pending ?? progress.accepted;
  const next = nextRoutineStep(progress);
  const nextTimer = next && progress.timer?.stepId === next.id ? progress.timer : null;
  const show = (part: RoutinePart) => parts.includes(part);
  return (
    <div className="health-tool" data-tool="evening-routine">
      {show('hero') && (
      <section className="health-next" aria-label="Current evening action">
        <p className="health-kicker">Tonight</p>
        <h2>{next ? next.title : 'Evening sequence complete'}</h2>
        <p>
          Finish at {progress.constraint.finishAt} · {plan.usedMinutes} of{' '}
          {progress.constraint.availableMinutes} minutes packed.
        </p>
        {next?.kind === 'timer' && (
          <p className="health-next-timer" aria-live="polite">
            {nextTimer ? formatTimer(nextTimer.remainingMs) : `${next.scheduledMinutes}:00`}
          </p>
        )}
        {next && (
          <div className="health-next-actions">
            {next.kind === 'timer' && (
              <button
                disabled={blocked || progress.completed.includes(next.id)}
                onClick={() => {
                  onSelect({ kind: 'timer', id: next.id });
                  if (!nextTimer)
                    onChange({
                      ...progress,
                      activeStepId: next.id,
                      timer: startRoutineTimer(next.id, next.scheduledMinutes),
                    });
                  else if (nextTimer.running)
                    onChange({ ...progress, timer: pauseRoutineTimer(nextTimer) });
                  else onChange({ ...progress, timer: resumeRoutineTimer(nextTimer) });
                }}
              >
                {!nextTimer
                  ? 'Start timer'
                  : nextTimer.running
                    ? `Pause ${formatTimer(nextTimer.remainingMs)}`
                    : nextTimer.remainingMs <= 0
                      ? 'Timer finished'
                      : `Resume ${formatTimer(nextTimer.remainingMs)}`}
              </button>
            )}
            <button
              disabled={blocked || progress.completed.includes(next.id)}
              onClick={() => onChange(completeRoutineStep(progress, next.id))}
            >
              Mark done
            </button>
          </div>
        )}
      </section>
      )}
      {show('sequence') && (
      <>
      <div className="health-constraint-bar">
        <label>
          Available minutes
          <input
            type="number"
            min={4}
            max={90}
            value={progress.constraint.availableMinutes}
            aria-label="Available minutes"
            disabled={blocked}
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
            disabled={blocked}
            onChange={(e) =>
              onChange(proposeConstraintChange(progress, { finishAt: e.target.value }))
            }
            onFocus={() => onSelect({ kind: 'constraint', id: 'finish' })}
          />
        </label>
      </div>
      {progress.pending && (
        <div className="health-proposal" role="status">
          <p>Proposed sequence. The current order stays until you accept.</p>
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
            <li
              key={step.id}
              data-included={step.included}
              data-selected={active}
              data-next={next?.id === step.id}
            >
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
              {step.included && next?.id !== step.id && (
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
            </li>
          );
        })}
      </ol>
      </>
      )}
      {show('notes') && selected?.kind === 'step' && (
        <label className="health-note">
          Preparation note
          <textarea
            maxLength={400}
            value={
              progress.notes[selected.id as EveningStepId] ??
              eveningCatalog.find((step) => step.id === selected.id)?.note ??
              ''
            }
            disabled={blocked}
            onChange={(e) =>
              onChange({
                ...progress,
                notes: { ...progress.notes, [selected.id]: e.target.value },
              })
            }
          />
        </label>
      )}
    </div>
  );
}

export function eveningStepTitle(id: EveningStepId) {
  return eveningCatalog.find((step) => step.id === id)?.title ?? id;
}

export function unavailableCopy() {
  return unavailableExternalActions;
}

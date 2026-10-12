'use client';
import { useState } from 'react';
import type { readWork } from '@/domains/company-work/service';
import {
  taskReadiness,
  reopenTaskPlan,
  taskPlanProblem,
  type MissionTask,
} from '@/domains/company-work/tasks';
import { allSpecialists, specialist, type SpecialistId } from '@/domains/intelligence/council';
import { jsonRequest } from '@/components/aurelius/memory-editor';
import '@/app/(workspace)/app/founder/office.css';
type Work = Awaited<ReturnType<typeof readWork>>;
type SaveReceipt = {
  companyId: string;
  jobId: string;
  expected: number;
  versionId: string;
  taskPlan: MissionTask[];
};
type GenerationReceipt = {
  companyId: string;
  jobId: string;
  expected: number;
  requestId: string;
  taskId: string;
};
export function MissionTasks({
  work,
  onChanged,
  disabled = false,
}: {
  work: Work;
  onChanged: (work: Work) => void;
  disabled?: boolean;
}) {
  const tasks = work.versions[0]?.content.taskPlan ?? [];
  const [title, setTitle] = useState(''),
    [objective, setObjective] = useState(''),
    [assignee, setAssignee] = useState<SpecialistId>('cassius');
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [retry, setRetry] = useState<SaveReceipt | GenerationReceipt | null>(null);
  async function submit(receipt: SaveReceipt | GenerationReceipt) {
    if (busy || disabled) return;
    setBusy(true);
    setRetry(receipt);
    setMessage('Saving mission work…');
    try {
      const saved = await jsonRequest('/api/founder-office/tasks', 'POST', receipt);
      onChanged(saved);
      setRetry(null);
      setEditingId(null);
      setTitle('');
      setObjective('');
      setDependsOn([]);
      setMessage('Saved as a new mission version. Completion remains your decision.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Save unconfirmed. Recover the exact request or reopen the mission.',
      );
    } finally {
      setBusy(false);
    }
  }
  function save(taskPlan: MissionTask[]) {
    void submit({
      companyId: work.job.company_id,
      jobId: work.job.id,
      expected: work.job.revision,
      versionId: crypto.randomUUID(),
      taskPlan,
    });
  }
  return (
    <section className="mission-task-plan" aria-labelledby="mission-task-title">
      <h2 id="mission-task-title">Mission milestones & Coworkers</h2>
      <p>
        Assignments, dependencies and completion are saved with the mission. Coworkers prepare
        internal work on request; these tasks do not run in the background.
      </p>
      {tasks.map((task) => {
        const readiness = taskReadiness(tasks, task.id);
        const ready = readiness.state === 'ready' || readiness.state === 'needs_review';
        return (
          <article className="founder-card" key={task.id}>
            <h3>{task.title}</h3>
            <p>
              {specialist(task.assignee).name} · {task.status.replaceAll('_', ' ')}
              {readiness.state === 'blocked' ? ' · dependencies awaiting completion' : ''}
            </p>
            <p>{task.objective}</p>
            {!!task.dependsOn.length && (
              <p>
                Depends on:{' '}
                {task.dependsOn.map((id) => tasks.find((t) => t.id === id)?.title).join(', ')}
              </p>
            )}
            <div className="io-work-links">
              <button
                disabled={busy || disabled || Boolean(retry) || task.status === 'completed'}
                onClick={() => {
                  setEditingId(task.id);
                  setEditRevision(work.job.revision);
                  setTitle(task.title);
                  setObjective(task.objective);
                  setAssignee(task.assignee);
                  setDependsOn(task.dependsOn);
                }}
              >
                Edit milestone
              </button>
              <button
                disabled={
                  busy ||
                  disabled ||
                  Boolean(retry) ||
                  task.status === 'completed' ||
                  tasks.some((item) => item.dependsOn.includes(task.id))
                }
                onClick={() => save(tasks.filter((item) => item.id !== task.id))}
              >
                Remove milestone from current plan
              </button>
              <button
                disabled={busy || disabled || Boolean(retry) || !ready}
                onClick={() =>
                  void submit({
                    companyId: work.job.company_id,
                    jobId: work.job.id,
                    expected: work.job.revision,
                    taskId: task.id,
                    requestId: crypto.randomUUID(),
                  })
                }
              >
                Have {specialist(task.assignee).name} prepare this task
              </button>
              <button
                disabled={
                  busy || disabled || Boolean(retry) || (!ready && task.status !== 'completed')
                }
                onClick={() =>
                  save(
                    task.status === 'completed'
                      ? reopenTaskPlan(tasks, task.id)
                      : tasks.map((t) => (t.id === task.id ? { ...t, status: 'completed' } : t)),
                  )
                }
              >
                {task.status === 'completed'
                  ? 'Reopen task and completed dependents'
                  : 'Confirm task completed'}
              </button>
            </div>
          </article>
        );
      })}
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            editingId &&
            (editRevision !== work.job.revision || !tasks.some((task) => task.id === editingId))
          ) {
            setMessage(
              'Mission changed while you were editing. Cancel and reopen the milestone from the latest saved plan.',
            );
            return;
          }
          const revised: MissionTask = {
            id: editingId ?? crypto.randomUUID(),
            title: title.trim(),
            objective: objective.trim(),
            assignee,
            status: editingId ? tasks.find((item) => item.id === editingId)!.status : 'planned',
            dependsOn,
          };
          const next = editingId
            ? tasks.map((item) => (item.id === editingId ? revised : item))
            : [...tasks, revised];
          const problem = taskPlanProblem(next);
          if (problem) {
            setMessage(problem);
            return;
          }
          save(next);
        }}
      >
        <fieldset
          disabled={busy || disabled || Boolean(retry) || (tasks.length >= 24 && !editingId)}
        >
          <label htmlFor="mission-task-name">Milestone or task</label>
          <input
            id="mission-task-name"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label htmlFor="mission-task-objective">Task objective</label>
          <textarea
            id="mission-task-objective"
            required
            minLength={3}
            maxLength={1200}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
          <label htmlFor="mission-task-assignee">Coworker</label>
          <select
            id="mission-task-assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value as SpecialistId)}
          >
            {allSpecialists.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.role}
              </option>
            ))}
          </select>
          {!!tasks.length && (
            <fieldset>
              <legend>Dependencies</legend>
              {tasks
                .filter((task) => task.id !== editingId)
                .map((task) => (
                  <label key={task.id}>
                    <input
                      type="checkbox"
                      checked={dependsOn.includes(task.id)}
                      onChange={(e) =>
                        setDependsOn((previous) =>
                          e.target.checked
                            ? [...previous, task.id]
                            : previous.filter((id) => id !== task.id),
                        )
                      }
                    />
                    {task.title}
                  </label>
                ))}
            </fieldset>
          )}
          <button className="secondary-button" type="submit">
            {editingId ? 'Save milestone changes' : 'Save milestone'}
          </button>
        </fieldset>
      </form>
      {editingId && (
        <button
          disabled={busy || Boolean(retry)}
          onClick={() => {
            setEditingId(null);
            setTitle('');
            setObjective('');
            setDependsOn([]);
          }}
        >
          Cancel milestone edit
        </button>
      )}
      <p>
        Completed milestones must be reopened before editing or removal. Remove dependent references
        first. Every saved change retains prior versions.
      </p>
      {message && <p role="status">{message}</p>}
      {retry && (
        <>
          <button disabled={busy || disabled} onClick={() => void submit(retry)}>
            Recover exact task request
          </button>
          <p>
            If a model attempt failed, reopen the saved mission and start a new attempt
            deliberately. Exact recovery never silently repeats a completed provider call.
          </p>
        </>
      )}
    </section>
  );
}

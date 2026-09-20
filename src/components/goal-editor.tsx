'use client';
import { useActionState, useState } from 'react';
import type { GoalRow } from '@/platform/supabase/database';
import { initialFormState, type FormAction } from '@/domains/shared/form-state';
import { domainLabels } from '@/domains/goals/validation';
import { FormFeedback, FieldError } from './form-feedback';
export function GoalEditor({
  goal,
  createId,
  action,
}: {
  goal: GoalRow | null;
  createId: string;
  action: FormAction;
}) {
  const [state, submit, pending] = useActionState(action, initialFormState);
  const [fields, setFields] = useState({
    title: goal?.title ?? '',
    domain: goal?.domain ?? 'life',
    reason: goal?.reason ?? '',
    next_step: goal?.next_step ?? '',
    target_date: goal?.target_date ?? '',
  });
  const update = (name: keyof typeof fields, value: string) =>
    setFields((previous) => ({ ...previous, [name]: value }));
  const errorProps = (name: string) => ({
    'aria-invalid': Boolean(state.errors?.[name]),
    'aria-describedby': state.errors?.[name] ? `goal-${name}-error` : undefined,
  });
  return (
    <form
      action={submit}
      className="editor-form"
      aria-label={goal ? 'Edit goal' : 'Create goal'}
      noValidate
    >
      <input type="hidden" name="id" value={goal?.id ?? createId} />
      <input type="hidden" name="version" value={state.version ?? goal?.version ?? 0} />
      <fieldset disabled={pending}>
        <legend className="sr-only">Goal details</legend>
        <label htmlFor="goal-title">What are you working toward?</label>
        <input
          id="goal-title"
          name="title"
          maxLength={120}
          value={fields.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Name an outcome that matters to you"
          {...errorProps('title')}
        />
        <FieldError state={state} name="title" id="goal-title-error" />
        <div className="form-columns">
          <div>
            <label htmlFor="goal-domain">Area of life</label>
            <select
              id="goal-domain"
              name="domain"
              value={fields.domain}
              onChange={(e) => update('domain', e.target.value)}
              {...errorProps('domain')}
            >
              {Object.entries(domainLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <FieldError state={state} name="domain" id="goal-domain-error" />
          </div>
          <div>
            <label htmlFor="goal-date">
              Target date <span className="optional">Optional</span>
            </label>
            <input
              id="goal-date"
              name="target_date"
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              value={fields.target_date}
              onChange={(e) => update('target_date', e.target.value)}
              {...errorProps('target_date')}
            />
            <FieldError state={state} name="target_date" id="goal-target_date-error" />
          </div>
        </div>
        <label htmlFor="goal-reason">
          Why does this matter to you? <span className="optional">Optional</span>
        </label>
        <textarea
          id="goal-reason"
          name="reason"
          maxLength={600}
          rows={3}
          value={fields.reason}
          onChange={(e) => update('reason', e.target.value)}
          {...errorProps('reason')}
        />
        <FieldError state={state} name="reason" id="goal-reason-error" />
        <label htmlFor="goal-next">Your next concrete step</label>
        <textarea
          id="goal-next"
          name="next_step"
          maxLength={280}
          rows={2}
          value={fields.next_step}
          onChange={(e) => update('next_step', e.target.value)}
          placeholder="Choose an action you can actually take"
          {...errorProps('next_step')}
        />
        <FieldError state={state} name="next_step" id="goal-next_step-error" />
      </fieldset>
      <FormFeedback state={state} />
      <button className="button" disabled={pending || state.status === 'conflict'} type="submit">
        {pending ? 'Saving…' : goal ? 'Save changes' : 'Set my goal'}
      </button>
    </form>
  );
}
export function GoalLifecycle({
  goal,
  action,
}: {
  goal: Pick<GoalRow, 'id' | 'version'>;
  action: FormAction;
}) {
  const [state, submit, pending] = useActionState(action, initialFormState);
  const [intent, setIntent] = useState<'completed' | 'archived' | null>(null);
  if (state.status === 'saved') return <FormFeedback state={state} />;
  return (
    <div className="goal-lifecycle">
      <h3>Close this chapter</h3>
      <p className="muted">
        Complete a goal you’ve achieved, or archive one you’re setting aside. Both stay in your
        history.
      </p>
      {intent ? (
        <form action={submit} aria-label="Confirm goal status">
          <input name="id" type="hidden" value={goal.id} />
          <input name="version" type="hidden" value={goal.version} />
          <input name="status" type="hidden" value={intent} />
          <p>
            {intent === 'completed' ? 'Mark this goal as completed?' : 'Archive this goal for now?'}
          </p>
          <p className="muted">
            Save any edits above first. Closed goals cannot be edited in this version.
          </p>
          <div className="button-row">
            <button
              className="button"
              type="submit"
              disabled={pending || state.status === 'conflict'}
            >
              {pending
                ? 'Saving…'
                : intent === 'completed'
                  ? 'Confirm completion'
                  : 'Confirm archive'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={pending}
              onClick={() => setIntent(null)}
            >
              Keep working
            </button>
          </div>
        </form>
      ) : (
        <div className="button-row">
          <button className="secondary-button" onClick={() => setIntent('completed')}>
            Mark complete
          </button>
          <button className="text-button" onClick={() => setIntent('archived')}>
            Archive goal
          </button>
        </div>
      )}
      <FormFeedback state={state} />
    </div>
  );
}

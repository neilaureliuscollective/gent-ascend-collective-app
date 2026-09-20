'use client';
import { useActionState, useState } from 'react';
import type { PersonRow } from '@/platform/supabase/database';
import { initialFormState, type FormAction } from '@/domains/shared/form-state';
import { FormFeedback, FieldError } from './form-feedback';
export function ProfileEditor({
  person,
  action,
}: {
  person: Pick<PersonRow, 'display_name' | 'timezone' | 'priority' | 'unit_system' | 'version'>;
  action: FormAction;
}) {
  const [state, submit, pending] = useActionState(action, initialFormState);
  const [fields, setFields] = useState({
    display_name: person.display_name,
    timezone: person.timezone,
    priority: person.priority,
    unit_system: person.unit_system,
  });
  const update = (key: keyof typeof fields, value: string) =>
    setFields((previous) => ({ ...previous, [key]: value }));
  const errorProps = (name: string) => ({
    'aria-invalid': Boolean(state.errors?.[name]),
    'aria-describedby': state.errors?.[name] ? `profile-${name}-error` : undefined,
  });
  return (
    <form action={submit} className="editor-form" aria-label="Personal profile" noValidate>
      <input type="hidden" name="version" value={state.version ?? person.version} />
      <fieldset disabled={pending}>
        <legend className="sr-only">Your personal profile</legend>
        <label htmlFor="profile-name">What should we call you?</label>
        <input
          id="profile-name"
          name="display_name"
          autoComplete="nickname"
          maxLength={100}
          value={fields.display_name}
          onChange={(e) => update('display_name', e.target.value)}
          {...errorProps('display_name')}
        />
        <FieldError state={state} name="display_name" id="profile-display_name-error" />
        <div className="form-columns">
          <div>
            <label htmlFor="profile-timezone">Timezone</label>
            <input
              id="profile-timezone"
              name="timezone"
              list="timezone-options"
              value={fields.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              {...errorProps('timezone')}
            />
            <datalist id="timezone-options">
              {[
                'America/Chicago',
                'America/New_York',
                'America/Denver',
                'America/Los_Angeles',
                'Europe/London',
                'UTC',
              ].map((zone) => (
                <option value={zone} key={zone} />
              ))}
            </datalist>
            <FieldError state={state} name="timezone" id="profile-timezone-error" />
            <button
              className="text-button"
              type="button"
              onClick={() => update('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone)}
            >
              Use device timezone
            </button>
          </div>
          <div>
            <label htmlFor="profile-units">Preferred units</label>
            <select
              id="profile-units"
              name="unit_system"
              value={fields.unit_system}
              onChange={(e) => update('unit_system', e.target.value)}
              {...errorProps('unit_system')}
            >
              <option value="imperial">Imperial · lb, ft</option>
              <option value="metric">Metric · kg, cm</option>
            </select>
            <FieldError state={state} name="unit_system" id="profile-unit_system-error" />
          </div>
        </div>
        <label htmlFor="profile-priority">
          What matters most right now? <span className="optional">Optional</span>
        </label>
        <textarea
          id="profile-priority"
          name="priority"
          rows={3}
          maxLength={280}
          value={fields.priority}
          placeholder="What would make this season of your life meaningful?"
          onChange={(e) => update('priority', e.target.value)}
          {...errorProps('priority')}
        />
        <FieldError state={state} name="priority" id="profile-priority-error" />
      </fieldset>
      <FormFeedback state={state} />
      <button className="button" type="submit" disabled={pending || state.status === 'conflict'}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

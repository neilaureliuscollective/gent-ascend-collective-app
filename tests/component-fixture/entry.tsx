import { DailyDashboard } from '@/components/dashboard/daily-dashboard';
import { sampleData } from '@/domains/daily/model';
import { createRoot } from 'react-dom/client';
import { ProfileEditor } from '@/components/profile-editor';
import { GoalEditor, GoalLifecycle } from '@/components/goal-editor';
import { profileSchema } from '@/domains/person/validation';
import { goalMutationSchema } from '@/domains/goals/validation';
import { validationErrors, type FormAction } from '@/domains/shared/form-state';
import type { GoalRow } from '@/platform/supabase/database';
import '@/app/globals.css';
const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'profile';
const goal: GoalRow = {
  id: '10000000-0000-4000-8000-000000000001',
  person_id: '20000000-0000-4000-8000-000000000001',
  title: 'Build a more deliberate daily rhythm',
  domain: 'life',
  reason: 'Make time for what matters most.',
  next_step: 'Plan one meaningful action for tomorrow.',
  target_date: '2026-12-31',
  status: 'active',
  version: 1,
  created_at: '2026-09-20T12:00:00Z',
  updated_at: '2026-09-20T12:00:00Z',
  closed_at: null,
};
const action: FormAction = async (_previous, form) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (params.get('outcome') === 'conflict')
    return {
      status: 'conflict',
      message: 'This record changed in another session. Reload before continuing.',
    };
  if (params.get('outcome') === 'error')
    return {
      status: 'error',
      message: 'We could not confirm the save. Your entries are still here.',
    };
  const result = (mode === 'profile' ? profileSchema : goalMutationSchema).safeParse(
    Object.fromEntries(form),
  );
  if (!result.success)
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      errors: validationErrors(result.error.issues),
    };
  return {
    status: 'saved',
    message: mode === 'profile' ? 'Profile saved.' : 'Goal updated.',
    version: Number(form.get('version')) + 1,
  };
};
const lifecycle: FormAction = async (_previous, form) => ({
  status: 'saved',
  message:
    form.get('status') === 'completed'
      ? 'Goal completed. Your progress is saved.'
      : 'Goal archived. It remains in your history.',
});
createRoot(document.getElementById('root')!).render(
  mode === 'daily' ? (
    <DailyDashboard
      initial={{ ...sampleData('2026-09-21'), mode: 'personal', name: 'Synthetic tester' }}
    />
  ) : (
    <main style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 20px' }}>
      <p className="eyebrow">Synthetic component fixture · no database</p>
      <div className="page-heading">
        <h1>{mode === 'profile' ? 'Make it yours.' : 'Keep moving.'}</h1>
      </div>
      <div className="personal-grid">
        <section className="panel">
          <h2>{mode === 'profile' ? 'Your personal profile' : 'Your active goal'}</h2>
          {mode === 'profile' ? (
            <ProfileEditor
              person={{
                display_name: 'Founder',
                timezone: 'America/Chicago',
                priority: 'Build a life with intention.',
                unit_system: 'imperial',
                version: 1,
              }}
              action={action}
            />
          ) : (
            <>
              <GoalEditor goal={goal} createId={goal.id} action={action} />
              <GoalLifecycle goal={goal} action={lifecycle} />
            </>
          )}
        </section>
        <aside className="panel perspective-panel">
          <p className="eyebrow">Your direction</p>
          <h2>
            Progress starts
            <br />
            with direction.
          </h2>
          <p>
            Choose something that matters to your life right now. Give it a next step small enough
            to act on.
          </p>
        </aside>
      </div>
    </main>
  ),
);

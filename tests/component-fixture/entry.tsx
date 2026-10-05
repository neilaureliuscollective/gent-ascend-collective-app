import { GuidedScan } from '@/components/grooming/guided-scan';
import { MemberContinuity } from '@/components/member-continuity';
import { projectContinuity } from '@/domains/continuity/model';
import { CustomerOrders } from '@/components/commerce/customer-orders';
import { FirstSession } from '@/components/first-session';
import { BrowserEntryNotice } from '@/components/browser-entry-notice';
import '@/app/(workspace)/app/welcome/welcome-entry.css';
import { DailyCommandWorkspace } from '@/components/daily-command/workspace';
import { CabinetImport } from '@/components/commerce/cabinet-import';
import { CabinetSave } from '@/components/commerce/cabinet-controls';
import { CabinetEditor } from '@/components/commerce/cabinet-controls';
import '@/app/(workspace)/app/collection/collection.css';
import { commandFixture } from './daily-command';
import { PerformanceWorkspace } from '@/components/performance/workspace';
import {
  performanceFixture,
  programFixture,
  learningFixture,
  outcomesFixture,
  fuelFixture,
  recoveryFixture,
  movementFixture,
} from './performance';
import '@/app/(workspace)/app/performance/performance.css';
import CommandError from '@/app/(workspace)/app/error';
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
import '@/app/interaction.css';
import { GroomingDirectionEditor } from '@/components/grooming/direction';
import '@/app/(workspace)/app/grooming/grooming.css';
import { CollectionShowroom } from '@/components/commerce/collection-showroom';
import { collectionEntries } from '@/domains/commerce/collection';
import { ProductExperience } from '@/components/commerce/product-experience';
import { resolveRelated } from '@/domains/commerce/discovery';
import { readProductStory } from '@/domains/commerce/product-story';
import { commerceFixture, relatedFixture } from './commerce';
import '@/app/(public)/world.css';
import '@/app/(public)/cinematic.css';
import '@/app/(public)/commerce-experience.css';
import { MembershipControls } from '@/components/membership-controls';
import '@/app/(workspace)/app/membership/membership.css';
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
  mode === 'mirror' ? (
    <main className="grooming mirror-page">
      <GuidedScan />
    </main>
  ) : mode === 'continuity' ? (
    <main style={{ maxWidth: 1000, margin: 'auto', padding: 16 }}>
      <p>Synthetic member records · no real account.</p>
      <MemberContinuity
        data={projectContinuity(
          {
            ...sampleData('2026-10-04'),
            mode: 'personal',
            conversation: {
              id: '60000000-0000-4000-8000-000000000001',
              title: 'Saved Council decision',
            },
          },
          {
            sessions: [
              {
                id: '1',
                title: 'Saved strength session',
                status: 'active',
                started_at: '2026-10-04T12:00:00Z',
                ended_at: null,
              },
            ],
            rituals: [{ id: 'r', title: 'Daily beard ritual', kind: 'morning' }],
            checkins: params.get('unavailable') === '1' ? null : [],
          },
        )}
      />
    </main>
  ) : mode === 'first-session' ? (
    <main style={{ maxWidth: 1000, margin: 'auto', padding: 16 }}>
      <p>Synthetic member fixture · no real account or model response.</p>
      <BrowserEntryNotice />
      <FirstSession
        canTalk={params.get('paid') === '1'}
        initial={{
          mode: 'personal',
          ownerId: '60000000-0000-4000-8000-000000000001',
          day: '2026-10-04',
          timezone: 'America/Chicago',
          version: 1,
          intention: 'Make room for deliberate progress',
          nextAction: null,
          updatedAt: null,
        }}
      />
    </main>
  ) : mode === 'command' ? (
    <DailyCommandWorkspace initial={commandFixture} />
  ) : mode === 'commerce-showroom' ? (
    <main className="reserve-commerce">
      <CollectionShowroom
        entries={collectionEntries([
          {
            ...commerceFixture,
            title: 'Hand & Body Wash, Patchouli & Amber Vanilla',
            priceRange: { minVariantPrice: commerceFixture.variants.nodes[0]!.price },
          },
        ])}
      />
    </main>
  ) : mode === 'customer-orders' ? (
    <>
      <p>Synthetic Shopify order fixture · no real customer or purchase.</p>
      <CustomerOrders
        view={{
          state: (params.get('state') ?? 'connected') as
            'connected' | 'unconfigured' | 'signed-out' | 'disconnected' | 'unavailable',
          displayName: 'Synthetic customer',
          orders:
            params.get('empty') === '1'
              ? []
              : [
                  {
                    id: 'gid://shopify/Order/1',
                    name: '#1001',
                    processedAt: '2026-10-04T12:00:00Z',
                    cancelledAt: null,
                    financialStatus: 'PAID',
                    fulfillmentStatus: 'UNFULFILLED',
                    totalPrice: { amount: '48.00', currencyCode: 'USD' },
                  },
                  {
                    id: 'gid://shopify/Order/2',
                    name: '#1002',
                    processedAt: '2026-10-01T12:00:00Z',
                    cancelledAt: '2026-10-02T12:00:00Z',
                    financialStatus: 'REFUNDED',
                    fulfillmentStatus: 'UNFULFILLED',
                    totalPrice: { amount: '30.00', currencyCode: 'USD' },
                  },
                ],
          more: true,
        }}
        failed={params.get('failed') === '1'}
      />
    </>
  ) : mode === 'cabinet-import' ? (
    <section className="member-collection">
      <p>Synthetic import fixture · no real account.</p>
      <CabinetImport
        reviewAction={async (_previous, form) => {
          const response = await fetch('/fixture-import-review', {
            method: 'POST',
            body: JSON.stringify(form.getAll('handle')),
          });
          return await response.json();
        }}
        importAction={async (_previous, form) => {
          const response = await fetch('/fixture-import-confirm', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(form)),
          });
          return await response.json();
        }}
      />
    </section>
  ) : mode === 'cabinet' ? (
    <section className="member-collection">
      <p>Synthetic Cabinet fixture · no member session or purchase.</p>
      <h1>Your Cabinet.</h1>
      <CabinetEditor
        record={{
          id: 'ce000000-0000-4000-8000-000000000001',
          person_id: 'ce000000-0000-4000-8000-000000000002',
          name: 'Test beard oil',
          category: 'beard',
          relation: 'owned',
          shopify_handle: null,
          catalog_product_id: null,
          note: '',
          version: 1,
          ritual_id: null,
          created_at: '2026-10-04T12:00:00Z',
          updated_at: '2026-10-04T12:00:00Z',
        }}
        rituals={[{ id: 'ce000000-0000-4000-8000-000000000003', title: 'Morning ritual' }]}
        action={async (_previous, form) => {
          const response = await fetch('/fixture-cabinet-save', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(form)),
          });
          return await response.json();
        }}
      />
    </section>
  ) : mode === 'commerce' ? (
    <div className="public-world">
      <p>Synthetic commerce fixture · no orders or payments.</p>
      <ProductExperience
        cabinetControl={
          params.get('account') === 'true' ? (
            <CabinetSave
              handle={commerceFixture.handle}
              action={async (_previous, form) => {
                const response = await fetch('/fixture-cabinet-save', {
                  method: 'POST',
                  body: JSON.stringify(Object.fromEntries(form)),
                });
                return await response.json();
              }}
            />
          ) : undefined
        }
        related={resolveRelated(
          readProductStory(commerceFixture.story),
          commerceFixture.handle,
          relatedFixture,
        )}
        product={{
          ...commerceFixture,
          launchState: { value: params.get('state') ?? 'ready' },
          ...(params.get('story') === 'missing' ? { story: null } : {}),
          ...(params.get('model') === 'fail'
            ? {
                media: {
                  nodes: [
                    {
                      mediaContentType: 'MODEL_3D',
                      sources: [
                        {
                          url: 'https://cdn.shopify.com/fixture/missing.glb',
                          format: 'glb',
                          filesize: 1000,
                        },
                      ],
                    },
                  ],
                },
              }
            : {}),
        }}
      />
    </div>
  ) : mode === 'grooming-direction' ? (
    <main className="grooming" style={{ padding: 24 }}>
      <p>Synthetic direction fixture; no account writes.</p>
      <GroomingDirectionEditor
        profile={null}
        saveAction={async () => {
          const response = await fetch('/fixture-direction-save', { method: 'POST' });
          return response.json();
        }}
      />
    </main>
  ) : mode === 'membership' ? (
    <main
      className="membership-grid"
      style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}
    >
      <section className="panel">
        <p className="eyebrow">Synthetic membership fixture · no database or payments</p>
        <h1>Your membership</h1>
        <MembershipControls
          founderAudit={params.get('founder-audit') === 'yes'}
          enrollment={params.get('enrollment') !== 'closed'}
          hasCustomer={params.get('customer') === 'yes'}
          hasSubscription={false}
          termsVersion="fixture-v1"
          terms="Synthetic launch terms. These controls only exercise browser behavior and do not accept payment."
        />
      </section>
    </main>
  ) : mode === 'performance' ||
    mode === 'performance-program' ||
    mode === 'performance-learning' ||
    mode === 'performance-outcomes' ||
    mode === 'performance-fuel' ||
    mode === 'performance-recovery' ||
    mode === 'performance-movement' ? (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <PerformanceWorkspace
        initial={
          mode === 'performance-movement'
            ? movementFixture
            : mode === 'performance-recovery'
              ? recoveryFixture
              : mode === 'performance-fuel'
                ? fuelFixture
                : mode === 'performance-outcomes'
                  ? outcomesFixture
                  : mode === 'performance-learning'
                    ? learningFixture
                    : mode === 'performance-program'
                      ? programFixture
                      : performanceFixture
        }
      />
    </main>
  ) : mode === 'command-error' ? (
    <CommandError reset={() => location.reload()} />
  ) : mode === 'daily' || mode === 'daily-summary' ? (
    <DailyDashboard
      dailyCommand={
        mode === 'daily-summary'
          ? {
              ...commandFixture,
              ownerId: '60000000-0000-4000-8000-000000000001',
              snapshot: { ...commandFixture.snapshot!, day: '2026-09-21' },
            }
          : undefined
      }
      initial={{
        ...sampleData('2026-09-21'),
        mode: 'personal',
        ownerId: '60000000-0000-4000-8000-000000000001',
        name: 'Synthetic tester',
        ...(params.get('state') === 'empty' ? { entries: [], goal: null } : {}),
        ...(params.get('state') === 'carry'
          ? {
              entries: [],
              goal: null,
              carryForward: {
                day: '2026-09-20',
                tomorrow: 'Call the partner',
                reflection: '',
                blocker: '',
                unfinished: [],
              },
            }
          : {}),
        decisionsAvailable: params.get('state') !== 'unavailable',
        pendingDecisions:
          params.get('state') === 'pending' || params.get('state') === 'several'
            ? [
                {
                  id: '10000000-0000-4000-8000-000000000009',
                  title: 'Protect 30 minutes for writing',
                  proposed_at: '2026-09-21T10:00:00Z',
                },
                ...(params.get('state') === 'several'
                  ? [
                      {
                        id: '10000000-0000-4000-8000-000000000010',
                        title: 'Call the partner',
                        proposed_at: '2026-09-21T11:00:00Z',
                      },
                    ]
                  : []),
              ]
            : [],
      }}
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

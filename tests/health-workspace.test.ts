import { describe, expect, it } from 'vitest';
import {
  acceptArchitectAttempt,
  architectBlockedMessage,
  ARCHITECT_APPS_DEPENDENCY,
  requestArchitectRevision,
  sanitizeArchitectBrief,
} from '../src/domains/health/architect-adapter';
import { interpretHealthAssist } from '../src/domains/health/assist';
import { bloodworkWorkspace, hostControlledValue } from '../src/domains/health/bloodwork';
import {
  acceptPendingPlan,
  defaultEveningProgress,
  formatTimer,
  pauseRoutineTimer,
  planEveningRoutine,
  proposeConstraintChange,
  resumeRoutineTimer,
  startRoutineTimer,
  tickRoutineTimer,
} from '../src/domains/health/routine';
import { sampleBloodwork, sampleWorkspaceNotice } from '../src/domains/health/sample';
import { comparisonKey } from '../src/domains/health/trends';
import { mutationSchema } from '../src/domains/health/schema';
import { defaultBloodworkSettings } from '../src/domains/health/workspace-model';

describe('Health evening planner', () => {
  it('packs selected steps into the stated minutes and does not invent substitutions', () => {
    const twenty = planEveningRoutine({
      availableMinutes: 20,
      finishAt: '18:00',
      selected: ['clear-counter', 'set-ingredients', 'cook-main', 'plate', 'tidy'],
    });
    expect(twenty.usedMinutes).toBeLessThanOrEqual(20);
    expect(twenty.dropped.map((item) => item.id)).toEqual(['tidy']);
    const shorter = planEveningRoutine({
      availableMinutes: 10,
      finishAt: '18:00',
      selected: ['clear-counter', 'set-ingredients', 'cook-main', 'plate', 'tidy'],
    });
    expect(shorter.dropped.length).toBeGreaterThan(0);
    expect(shorter.explanation).toMatch(/time packing/);
  });
  it('proposes constraint changes until they are accepted and keeps timers real', () => {
    let progress = defaultEveningProgress();
    progress = proposeConstraintChange(progress, { availableMinutes: 10 });
    expect(progress.pending).not.toBeNull();
    expect(progress.accepted.availableMinutes).toBe(20);
    progress = acceptPendingPlan(progress);
    expect(progress.pending).toBeNull();
    expect(progress.accepted.availableMinutes).toBe(10);
    const timer = startRoutineTimer('cook-main', 6, Date.parse('2026-10-15T18:00:00Z'));
    const later = tickRoutineTimer(timer, Date.parse('2026-10-15T18:01:00Z'));
    expect(later.remainingMs).toBe(5 * 60_000);
    expect(formatTimer(later.remainingMs)).toBe('5:00');
    const paused = pauseRoutineTimer(later, Date.parse('2026-10-15T18:01:00Z'));
    expect(paused.running).toBe(false);
    const resumed = resumeRoutineTimer(paused, Date.parse('2026-10-15T18:02:00Z'));
    expect(resumed.running).toBe(true);
  });
});

describe('Health bloodwork sample and comparisons', () => {
  it('labels synthetic records and refuses incompatible unit combination', () => {
    expect(sampleWorkspaceNotice).toMatch(/not your records/);
    const settings = defaultBloodworkSettings();
    const view = bloodworkWorkspace(sampleBloodwork, settings, true);
    expect(view.sample).toBe(true);
    expect(view.series.some((item) => item.difference !== null)).toBe(true);
    const mixed = [
      sampleBloodwork[0]!,
      { ...sampleBloodwork[4]!, unit: 'mmol/L', id: 's1000000-0000-4000-8000-000000000099' },
    ];
    expect(bloodworkWorkspace(mixed, settings, true).series).toHaveLength(2);
    expect(hostControlledValue(sampleBloodwork[0]!).host).toBe(true);
    expect(comparisonKey(sampleBloodwork[0]!)).not.toBe(
      comparisonKey({ ...sampleBloodwork[0]!, unit: 'mmol/L' }),
    );
  });
});

describe('Health assist and Architect adapter', () => {
  it('interprets time and foundation requests without claiming clinical reasoning', () => {
    expect(
      interpretHealthAssist(
        'Help me make evenings easier. I finish at six and have twenty minutes to cook.',
      ),
    ).toMatchObject({ kind: 'minutes', minutes: 20 });
    expect(interpretHealthAssist('change to ten minutes')).toMatchObject({
      kind: 'minutes',
      minutes: 10,
    });
    expect(interpretHealthAssist('open bloodwork')).toMatchObject({
      kind: 'open',
      foundation: 'bloodwork-tracker',
    });
  });
  it('redacts lab-like content and keeps working revision when compilation is blocked or fails', async () => {
    const sanitized = sanitizeArchitectBrief({
      instruction: 'Show my LDL 128 mg/dL and diagnose it',
      title: 'Neil evening notes',
    });
    expect(sanitized.instruction).not.toMatch(/128/);
    expect(sanitized.personalRecordsIncluded).toBe(false);
    expect(sanitized.titleIncluded).toBe(false);
    const blocked = await requestArchitectRevision({
      workspaceId: '00000000-0000-4000-8000-000000000010',
      workingRevision: 3,
      instruction: 'Add a date-range interaction and a compact comparison drawer.',
      presentation: {
        density: 'comfortable',
        arrangement: 'timeline',
        dateRange: true,
        comparisonDrawer: true,
        accent: 'quiet',
      },
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.workingRevision).toBe(3);
    expect(blocked.blocker).toContain(String(ARCHITECT_APPS_DEPENDENCY.pr));
    expect(blocked.blocker).toContain(ARCHITECT_APPS_DEPENDENCY.commit);
    const failed = await requestArchitectRevision({
      workspaceId: blocked.workspaceId,
      workingRevision: 3,
      instruction: 'Add a date-range interaction',
      presentation: blocked.diff.length
        ? {
            density: 'comfortable',
            arrangement: 'timeline',
            dateRange: true,
            comparisonDrawer: true,
            accent: 'quiet',
          }
        : {
            density: 'compact',
            arrangement: 'markers',
            dateRange: false,
            comparisonDrawer: false,
            accent: 'quiet',
          },
      runtime: {
        propose: async () => ({
          summary: 'change',
          files: [{ path: 'src/DateRange.tsx', content: 'x' }],
          diff: [],
        }),
        compile: async () => ({ ok: false, log: 'typecheck failed', isolation: 'unavailable' }),
        preview: async () => null,
      },
    });
    expect(failed.status).toBe('failed');
    expect(failed.workingRevision).toBe(3);
    expect(acceptArchitectAttempt(failed).workingRevision).toBe(3);
    expect(architectBlockedMessage()).toMatch(/not a running preview/);
  });
  it('accepts a real isolated compile from an injected runtime without replacing records', async () => {
    const ready = await requestArchitectRevision({
      workspaceId: '00000000-0000-4000-8000-000000000011',
      workingRevision: 1,
      instruction: 'Add a date-range interaction and a compact comparison drawer.',
      presentation: {
        density: 'comfortable',
        arrangement: 'timeline',
        dateRange: false,
        comparisonDrawer: false,
        accent: 'quiet',
      },
      runtime: {
        propose: async () => ({
          summary: 'drawer',
          files: [{ path: 'src/ComparisonDrawer.tsx', content: 'export const Drawer = true' }],
          diff: [{ path: 'src/ComparisonDrawer.tsx', before: 'hidden', after: 'drawer' }],
        }),
        compile: async () => ({ ok: true, log: 'ok', isolation: 'docker' }),
        preview: async () => ({ html: '<main>preview</main>' }),
      },
    });
    expect(ready.status).toBe('ready');
    const accepted = acceptArchitectAttempt(ready);
    expect(accepted.workingRevision).toBe(2);
  });
  it('rejects client-owned workspace payloads and extra mutation keys', () => {
    expect(
      mutationSchema.safeParse({
        kind: 'workspace_save',
        request: '00000000-0000-4000-8000-000000000012',
        id: '00000000-0000-4000-8000-000000000013',
        expected: 1,
        foundation: 'evening-routine',
        title: 'Evenings',
        sample: false,
        settings: {
          presentation: {
            density: 'comfortable',
            arrangement: 'sequence',
            dateRange: false,
            comparisonDrawer: false,
            accent: 'quiet',
          },
        },
        progress: defaultEveningProgress(),
        architect: null,
        person_id: 'forged',
      }).success,
    ).toBe(false);
  });
});

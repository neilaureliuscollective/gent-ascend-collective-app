import { describe, expect, it } from 'vitest';
import {
  acceptArchitectAttempt,
  architectDiagnostics,
  architectUnavailableMessage,
  classifyArchitectRequest,
  requestArchitectRevision,
  sanitizeArchitectBrief,
} from '../src/domains/health/architect-adapter';
import { interpretHealthAssist } from '../src/domains/health/assist';
import {
  bloodworkWorkspace,
  formatReportedValue,
  hostControlledValue,
  initialBloodworkSettings,
  selectMarkersByName,
} from '../src/domains/health/bloodwork';
import { shouldClearDraft } from '../src/domains/health/save-receipts';
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
import {
  createWorkspaceDraft,
  defaultBloodworkSettings,
  routineProgressSchema,
} from '../src/domains/health/workspace-model';

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
    const settings = initialBloodworkSettings(sampleBloodwork);
    const view = bloodworkWorkspace(sampleBloodwork, settings, true);
    expect(view.sample).toBe(true);
    expect(view.focus?.name).toBe('LDL cholesterol');
    expect(view.comparable.some((item) => item.difference !== null)).toBe(true);
    expect(view.chartRows.every((row) => row.name === 'LDL cholesterol')).toBe(true);
    const mixed = [
      sampleBloodwork[0]!,
      { ...sampleBloodwork[4]!, unit: 'mmol/L', id: 's1000000-0000-4000-8000-000000000099' },
    ];
    expect(bloodworkWorkspace(mixed, settings, true).markers).toHaveLength(2);
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
    expect(interpretHealthAssist('show LDL')).toMatchObject({
      kind: 'markers',
      names: ['LDL cholesterol'],
    });
  });
  it('keeps working revision when compilation is blocked, fails, or lacks isolation', async () => {
    expect(classifyArchitectRequest('Show my LDL 128 mg/dL and diagnose it').kind).toBe(
      'sensitive',
    );
    const sanitized = sanitizeArchitectBrief({
      instruction: 'Show my LDL 128 mg/dL and diagnose it',
      title: 'Neil evening notes',
    });
    expect(sanitized.instruction).toBe('');
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
    expect(blocked.verified).toBe(false);
    expect(blocked.blocker).toBe(architectUnavailableMessage());
    expect(architectDiagnostics().commit).toMatch(/^[0-9a-f]{40}$/);
    const presentation = {
      density: 'comfortable' as const,
      arrangement: 'timeline' as const,
      dateRange: true,
      comparisonDrawer: true,
      accent: 'quiet' as const,
    };
    const failed = await requestArchitectRevision({
      workspaceId: blocked.workspaceId,
      workingRevision: 3,
      instruction: 'Add a date-range interaction',
      presentation,
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
    const host = await requestArchitectRevision({
      workspaceId: blocked.workspaceId,
      workingRevision: 3,
      instruction: 'Add a compact comparison drawer',
      presentation,
      runtime: {
        propose: async () => ({
          summary: 'host',
          files: [{ path: 'src/ComparisonDrawer.tsx', content: 'x' }],
          diff: [],
        }),
        compile: async () => ({ ok: true, log: 'ok', isolation: 'host-fixture' }),
        preview: async () => ({ html: '<main>not isolated</main>' }),
      },
    });
    expect(host.status).toBe('failed');
    expect(host.isolation).toBe('host-fixture');
    expect(acceptArchitectAttempt(host).verified).toBe(false);
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
    expect(ready.isolation).toBe('docker');
    expect(ready.previewOk).toBe(true);
    const accepted = acceptArchitectAttempt(ready);
    expect(accepted.workingRevision).toBe(2);
    expect(accepted.verified).toBe(true);
  });
  it('selects named markers, keeps an empty selection empty, and formats reported values', () => {
    expect(formatReportedValue('128')).toBe('128');
    expect(formatReportedValue('1.8000000001')).toBe('1.8');
    expect(formatReportedValue('Clear')).toBe('Clear');
    const empty = bloodworkWorkspace(sampleBloodwork, defaultBloodworkSettings(), true);
    expect(empty.emptySelection).toBe(true);
    expect(empty.visible).toHaveLength(0);
    expect(empty.chartRows).toHaveLength(0);
    const keys = selectMarkersByName(sampleBloodwork, ['LDL cholesterol']);
    const focused = bloodworkWorkspace(
      sampleBloodwork,
      { ...defaultBloodworkSettings(), markerKeys: keys, focusKey: keys[0]! },
      true,
    );
    expect(focused.focus?.name).toBe('LDL cholesterol');
    const qualitative = bloodworkWorkspace(
      [
        {
          ...sampleBloodwork[0]!,
          id: 's1000000-0000-4000-8000-000000000080',
          value: 'Clear',
          unit: '',
        },
      ],
      {
        ...defaultBloodworkSettings(),
        markerKeys: [comparisonKey({ ...sampleBloodwork[0]!, value: 'Clear', unit: '' })],
        focusKey: comparisonKey({ ...sampleBloodwork[0]!, value: 'Clear', unit: '' }),
      },
      true,
    );
    expect(qualitative.chartRows).toHaveLength(0);
    expect(qualitative.qualitative[0]?.value).toBe('Clear');
  });
  it('validates routine progress and keeps newer drafts after a confirmed older save', () => {
    expect(routineProgressSchema.safeParse(defaultEveningProgress()).success).toBe(true);
    const draft = createWorkspaceDraft('evening-routine', {
      id: '00000000-0000-4000-8000-000000000014',
      now: '2026-10-15T12:00:00Z',
    });
    expect(shouldClearDraft(draft, draft.id, 1, 1, { status: 'confirmed' })).toBe(true);
    expect(shouldClearDraft(draft, draft.id, 1, 2, { status: 'confirmed' })).toBe(false);
    expect(
      shouldClearDraft(draft, draft.id, 2, 2, {
        status: 'failed',
        message: 'Save failed',
      }),
    ).toBe(false);
    expect(
      mutationSchema.safeParse({
        kind: 'workspace_copy',
        request: '00000000-0000-4000-8000-000000000015',
        id: '00000000-0000-4000-8000-000000000016',
        sourceId: draft.id,
        title: 'Evenings copy',
        includeDraft: true,
        settings: draft.settings,
        progress: draft.progress,
      }).success,
    ).toBe(true);
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

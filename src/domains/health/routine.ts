export const eveningStepIds = [
  'clear-counter',
  'set-ingredients',
  'cook-main',
  'plate',
  'tidy',
] as const;
export type EveningStepId = (typeof eveningStepIds)[number];

export type EveningStep = {
  id: EveningStepId;
  title: string;
  minutes: number;
  kind: 'timer' | 'action';
  note: string;
  optional: boolean;
};

export const eveningCatalog: EveningStep[] = [
  {
    id: 'clear-counter',
    title: 'Clear a working space',
    minutes: 2,
    kind: 'action',
    note: 'Put away anything that is not for this meal.',
    optional: true,
  },
  {
    id: 'set-ingredients',
    title: 'Set out ingredients',
    minutes: 3,
    kind: 'action',
    note: 'Pan, board, oil, the protein or vegetables you already have.',
    optional: false,
  },
  {
    id: 'cook-main',
    title: 'Cook the main',
    minutes: 10,
    kind: 'timer',
    note: 'A single pan meal. Keep the heat moderate so ten minutes is enough.',
    optional: false,
  },
  {
    id: 'plate',
    title: 'Plate and reset the pan',
    minutes: 5,
    kind: 'action',
    note: 'Move food off the heat. Leave washing for later if time is gone.',
    optional: false,
  },
  {
    id: 'tidy',
    title: 'Quick wipe',
    minutes: 3,
    kind: 'action',
    note: 'Only the board and the pan. Not a full clean.',
    optional: true,
  },
];

export const unavailableExternalActions = [
  {
    id: 'calendar',
    label: 'Add to calendar',
    reason: 'No authorized calendar integration is connected.',
  },
  {
    id: 'groceries',
    label: 'Order missing ingredients',
    reason: 'Purchases stay unavailable until a real commerce connection exists.',
  },
  {
    id: 'message',
    label: 'Message household',
    reason: 'Messages are not sent from Health.',
  },
  {
    id: 'device',
    label: 'Start a kitchen device',
    reason: 'Health does not control appliances or medical devices.',
  },
] as const;

export type RoutineConstraint = {
  availableMinutes: number;
  finishAt: string;
  selected: EveningStepId[];
};

export type PlannedStep = EveningStep & { scheduledMinutes: number; included: boolean };
export type RoutinePlan = {
  availableMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  steps: PlannedStep[];
  dropped: { id: EveningStepId; title: string; reason: string }[];
  shortened: { id: EveningStepId; from: number; to: number }[];
  explanation: string;
};

const finishAtPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseFinishAt(value: string) {
  return finishAtPattern.test(value) ? value : null;
}

export function defaultEveningConstraint(): RoutineConstraint {
  return {
    availableMinutes: 20,
    finishAt: '18:00',
    selected: [...eveningStepIds],
  };
}

/** Bounded packing: keep required steps first, then optional, never invent substitutions. */
export function planEveningRoutine(input: RoutineConstraint): RoutinePlan {
  const availableMinutes = clampMinutes(input.availableMinutes);
  const selected = eveningCatalog.filter((step) => input.selected.includes(step.id));
  const required = selected.filter((step) => !step.optional);
  const optional = selected.filter((step) => step.optional);
  const ordered = [...required, ...optional];
  let remaining = availableMinutes;
  const included: PlannedStep[] = [];
  const dropped: RoutinePlan['dropped'] = [];
  const shortened: RoutinePlan['shortened'] = [];

  for (const step of ordered) {
    if (remaining <= 0) {
      dropped.push({
        id: step.id,
        title: step.title,
        reason: `No time remains in the ${availableMinutes}-minute limit.`,
      });
      continue;
    }
    if (step.minutes <= remaining) {
      included.push({ ...step, scheduledMinutes: step.minutes, included: true });
      remaining -= step.minutes;
      continue;
    }
    if (step.kind === 'timer' && remaining >= 4) {
      shortened.push({ id: step.id, from: step.minutes, to: remaining });
      included.push({ ...step, scheduledMinutes: remaining, included: true });
      remaining = 0;
      continue;
    }
    dropped.push({
      id: step.id,
      title: step.title,
      reason: `${step.minutes} minutes does not fit the remaining ${remaining} minutes.`,
    });
  }

  const usedMinutes = availableMinutes - remaining;
  return {
    availableMinutes,
    usedMinutes,
    remainingMinutes: remaining,
    steps: [
      ...included,
      ...dropped.map((item) => {
        const step = eveningCatalog.find((row) => row.id === item.id)!;
        return { ...step, scheduledMinutes: 0, included: false };
      }),
    ],
    dropped,
    shortened,
    explanation: explainPlan(availableMinutes, usedMinutes, remaining, dropped, shortened),
  };
}

export function routineDiff(previous: RoutinePlan, next: RoutinePlan) {
  const dropped = next.dropped.filter(
    (item) => !previous.dropped.some((row) => row.id === item.id),
  );
  const restored = previous.dropped.filter(
    (item) => !next.dropped.some((row) => row.id === item.id),
  );
  const shortened = next.shortened.filter(
    (item) => !previous.shortened.some((row) => row.id === item.id && row.to === item.to),
  );
  return {
    dropped,
    restored,
    shortened,
    changed: Boolean(dropped.length || restored.length || shortened.length),
  };
}

export type RoutineTimer = {
  stepId: EveningStepId;
  durationMs: number;
  remainingMs: number;
  running: boolean;
  startedAt: string | null;
};

export function startRoutineTimer(
  stepId: EveningStepId,
  durationMinutes: number,
  now = Date.now(),
): RoutineTimer {
  const durationMs = Math.max(1, durationMinutes) * 60_000;
  return {
    stepId,
    durationMs,
    remainingMs: durationMs,
    running: true,
    startedAt: new Date(now).toISOString(),
  };
}

export function tickRoutineTimer(timer: RoutineTimer, now = Date.now()): RoutineTimer {
  if (!timer.running || !timer.startedAt) return timer;
  const elapsed = Math.max(0, now - Date.parse(timer.startedAt));
  const remainingMs = Math.max(0, timer.durationMs - elapsed);
  return {
    ...timer,
    remainingMs,
    running: remainingMs > 0,
    startedAt: remainingMs > 0 ? timer.startedAt : null,
  };
}

export function pauseRoutineTimer(timer: RoutineTimer, now = Date.now()): RoutineTimer {
  const next = tickRoutineTimer(timer, now);
  return { ...next, running: false, startedAt: null };
}

export function resumeRoutineTimer(timer: RoutineTimer, now = Date.now()): RoutineTimer {
  if (timer.remainingMs <= 0) return { ...timer, running: false, startedAt: null };
  return {
    ...timer,
    durationMs: timer.remainingMs,
    running: true,
    startedAt: new Date(now).toISOString(),
  };
}

export type RoutineProgress = {
  constraint: RoutineConstraint;
  accepted: RoutinePlan;
  pending: RoutinePlan | null;
  timer: RoutineTimer | null;
  completed: EveningStepId[];
  notes: Partial<Record<EveningStepId, string>>;
  activeStepId: EveningStepId | null;
};

export function defaultEveningProgress(): RoutineProgress {
  const constraint = defaultEveningConstraint();
  return {
    constraint,
    accepted: planEveningRoutine(constraint),
    pending: null,
    timer: null,
    completed: [],
    notes: {},
    activeStepId: null,
  };
}

export function proposeConstraintChange(
  progress: RoutineProgress,
  patch: Partial<RoutineConstraint>,
): RoutineProgress {
  const constraint: RoutineConstraint = {
    availableMinutes: clampMinutes(patch.availableMinutes ?? progress.constraint.availableMinutes),
    finishAt:
      parseFinishAt(patch.finishAt ?? progress.constraint.finishAt) ?? progress.constraint.finishAt,
    selected: patch.selected ?? progress.constraint.selected,
  };
  const pending = planEveningRoutine(constraint);
  const diff = routineDiff(progress.accepted, pending);
  return {
    ...progress,
    constraint,
    pending: diff.changed ? pending : null,
    accepted: diff.changed ? progress.accepted : pending,
  };
}

export function acceptPendingPlan(progress: RoutineProgress): RoutineProgress {
  if (!progress.pending) return progress;
  const allowed = new Set(
    progress.pending.steps.filter((step) => step.included).map((step) => step.id),
  );
  return {
    ...progress,
    accepted: progress.pending,
    pending: null,
    completed: progress.completed.filter((id) => allowed.has(id)),
    activeStepId:
      progress.activeStepId && allowed.has(progress.activeStepId) ? progress.activeStepId : null,
    timer: progress.timer && allowed.has(progress.timer.stepId) ? progress.timer : null,
  };
}

export function completeRoutineStep(progress: RoutineProgress, id: EveningStepId): RoutineProgress {
  if (progress.completed.includes(id)) return progress;
  return {
    ...progress,
    completed: [...progress.completed, id],
    activeStepId: progress.activeStepId === id ? null : progress.activeStepId,
    timer: progress.timer?.stepId === id ? null : progress.timer,
  };
}

export function formatTimer(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function nextRoutineStep(progress: RoutineProgress) {
  const plan = progress.pending ?? progress.accepted;
  return plan.steps.find((step) => step.included && !progress.completed.includes(step.id)) ?? null;
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 20;
  return Math.min(90, Math.max(4, Math.round(value)));
}

function explainPlan(
  available: number,
  used: number,
  remaining: number,
  dropped: RoutinePlan['dropped'],
  shortened: RoutinePlan['shortened'],
) {
  const parts = [`${used} of ${available} minutes scheduled.`];
  if (shortened.length)
    parts.push(
      shortened
        .map((item) => `${item.id} shortened from ${item.from} to ${item.to} minutes.`)
        .join(' '),
    );
  if (dropped.length) parts.push(`Held back: ${dropped.map((item) => item.title).join(', ')}.`);
  else parts.push(`${remaining} minutes remain.`);
  parts.push('This is a time packing of the selected steps, not unrestricted reasoning.');
  return parts.join(' ');
}

import { interpretHealthAssist, type AssistAction } from './assist';
import { initialBloodworkSettings } from './bloodwork';
import { type HealthFoundationId } from './foundations';
import { defaultEveningProgress } from './routine';
import { sampleBloodwork } from './sample';
import type { SavedObservation } from './schema';
import {
  createWorkspaceDraft,
  defaultBloodworkSettings,
  type HealthWorkspaceRecord,
  type ToolComposition,
  type ToolDisplay,
  type ToolSection,
  type ToolSectionKind,
} from './workspace-model';

export const toolSectionCatalog: {
  kind: ToolSectionKind;
  title: string;
  display: ToolDisplay;
  summary: string;
}[] = [
  {
    kind: 'hero',
    title: 'Next action',
    display: 'hero-next',
    summary: 'The current step, packed minutes and in-app timer.',
  },
  {
    kind: 'sequence',
    title: 'Evening sequence',
    display: 'sequence-list',
    summary: 'Ordered steps, durations, completion and time limits.',
  },
  {
    kind: 'notes',
    title: 'Preparation notes',
    display: 'notes-panel',
    summary: 'Notes on the selected step.',
  },
  {
    kind: 'trend',
    title: 'Marker trend',
    display: 'chart',
    summary: 'One selected laboratory marker over collection dates.',
  },
  {
    kind: 'table',
    title: 'Results table',
    display: 'table',
    summary: 'Dated observations with original units and ranges.',
  },
  {
    kind: 'source',
    title: 'Source inspection',
    display: 'source-inspect',
    summary: 'The original report behind a selected marker.',
  },
];

const displaysForKind: Record<ToolSectionKind, ToolDisplay[]> = {
  hero: ['hero-next'],
  sequence: ['sequence-list'],
  notes: ['notes-panel'],
  trend: ['chart'],
  table: ['table'],
  source: ['source-inspect'],
};

export type CompositionCommand =
  | { kind: 'add-section'; sectionKind: ToolSectionKind }
  | { kind: 'remove-section'; id?: string; sectionKind?: ToolSectionKind }
  | { kind: 'move-section'; id: string; direction: 'up' | 'down' }
  | { kind: 'rename-section'; id: string; title: string }
  | { kind: 'set-display'; id: string; display: ToolDisplay }
  | { kind: 'set-visible'; id: string; visible: boolean }
  | { kind: 'rename-tool'; title: string };

export type CreationIntent =
  | { kind: 'blank'; reason: string }
  | { kind: 'command'; command: CompositionCommand; reason: string }
  | { kind: 'assist'; action: AssistAction }
  | { kind: 'handoff'; text: string; reason: string };

export function catalogEntry(kind: ToolSectionKind) {
  return toolSectionCatalog.find((item) => item.kind === kind)!;
}

export function allowedDisplays(kind: ToolSectionKind) {
  return displaysForKind[kind];
}

export function createToolSection(
  kind: ToolSectionKind,
  options?: { id?: string; title?: string },
): ToolSection {
  const item = catalogEntry(kind);
  return {
    id: options?.id ?? crypto.randomUUID(),
    kind,
    title: options?.title ?? item.title,
    display: item.display,
    visible: true,
  };
}

export function defaultComposition(
  foundation: HealthFoundationId,
  intent?: string,
): ToolComposition {
  const kinds: ToolSectionKind[] =
    foundation === 'evening-routine' ? ['hero', 'sequence', 'notes'] : ['trend', 'table', 'source'];
  return {
    schemaVersion: 1,
    intent: intent?.slice(0, 400) || undefined,
    sections: kinds.map((kind) => createToolSection(kind)),
  };
}

export function emptyComposition(intent?: string): ToolComposition {
  return {
    schemaVersion: 1,
    intent: intent?.slice(0, 400) || undefined,
    sections: [],
  };
}

export function resolveComposition(workspace: HealthWorkspaceRecord): ToolComposition {
  return workspace.settings.composition ?? defaultComposition(workspace.foundation);
}

export function visibleSections(workspace: HealthWorkspaceRecord) {
  return resolveComposition(workspace).sections.filter((section) => section.visible);
}

export function withComposition(
  workspace: HealthWorkspaceRecord,
  composition: ToolComposition,
): HealthWorkspaceRecord {
  return {
    ...workspace,
    settings: { ...workspace.settings, composition },
  };
}

export function ensureSectionBindings(
  workspace: HealthWorkspaceRecord,
  composition: ToolComposition,
  observations: SavedObservation[] = [],
): HealthWorkspaceRecord {
  const kinds = new Set(composition.sections.map((section) => section.kind));
  let next = withComposition(workspace, composition);
  if ((kinds.has('hero') || kinds.has('sequence') || kinds.has('notes')) && !next.progress) {
    next = { ...next, progress: defaultEveningProgress() };
  }
  if (kinds.has('trend') || kinds.has('table') || kinds.has('source')) {
    const bloodwork =
      next.settings.bloodwork ??
      (next.sample || !observations.some((row) => row.status === 'active')
        ? initialBloodworkSettings(next.sample ? sampleBloodwork : observations)
        : defaultBloodworkSettings());
    next = {
      ...next,
      sample: next.sample || !observations.some((row) => row.status === 'active'),
      settings: { ...next.settings, bloodwork },
    };
  }
  return next;
}

export function createComposedTool(input: {
  foundation?: HealthFoundationId;
  blank?: boolean;
  title?: string;
  intent?: string;
  sample?: boolean;
  observations?: SavedObservation[];
  now?: string;
  id?: string;
}): HealthWorkspaceRecord {
  const foundation = input.foundation ?? 'evening-routine';
  const created = createWorkspaceDraft(foundation, {
    id: input.id,
    title: input.title,
    sample: input.sample,
    now: input.now,
  });
  const composition = input.blank
    ? emptyComposition(input.intent)
    : defaultComposition(foundation, input.intent);
  if (input.intent && !input.title) {
    created.title = titleFromIntent(input.intent, foundation, Boolean(input.blank));
  }
  if (foundation === 'bloodwork-tracker') {
    created.settings.bloodwork = initialBloodworkSettings(
      created.sample ? sampleBloodwork : (input.observations ?? []),
    );
  }
  return ensureSectionBindings(created, composition, input.observations ?? []);
}

export function titleFromIntent(intent: string, foundation: HealthFoundationId, blank: boolean) {
  const cleaned = intent.replace(/\s+/g, ' ').trim();
  if (cleaned && !/^(create|make|build|new|blank|empty)(\s+a)?(\s+tool)?$/i.test(cleaned)) {
    return cleaned.slice(0, 80);
  }
  if (blank) return 'Untitled tool';
  return foundation === 'evening-routine' ? 'Evenings, made usable' : 'Bloodwork Tracker';
}

export function applyCompositionCommand(
  workspace: HealthWorkspaceRecord,
  command: CompositionCommand,
  observations: SavedObservation[] = [],
): { workspace: HealthWorkspaceRecord; note: string } {
  const composition = resolveComposition(workspace);
  if (command.kind === 'rename-tool') {
    const title = command.title.trim().slice(0, 120);
    if (!title) return { workspace, note: 'A tool still needs a name.' };
    return { workspace: { ...workspace, title }, note: `Renamed this tool to ${title}.` };
  }
  if (command.kind === 'add-section') {
    if (composition.sections.length >= 12) {
      return { workspace, note: 'This tool already has the maximum number of sections.' };
    }
    if (composition.sections.some((section) => section.kind === command.sectionKind)) {
      return { workspace, note: `${catalogEntry(command.sectionKind).title} is already on this tool.` };
    }
    const sections = [...composition.sections, createToolSection(command.sectionKind)];
    const next = ensureSectionBindings(workspace, { ...composition, sections }, observations);
    return { workspace: next, note: `Added ${catalogEntry(command.sectionKind).title}.` };
  }
  const index = composition.sections.findIndex((section) =>
    command.kind === 'remove-section'
      ? section.id === command.id || section.kind === command.sectionKind
      : 'id' in command && section.id === command.id,
  );
  if (index < 0) return { workspace, note: 'That section is not on this tool.' };
  const current = composition.sections[index]!;
  let sections = composition.sections;
  let note = '';
  if (command.kind === 'remove-section') {
    sections = sections.filter((section) => section.id !== current.id);
    note = `Removed ${current.title}.`;
  }
  if (command.kind === 'move-section') {
    const target = command.direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) {
      return { workspace, note: 'That section is already at the edge.' };
    }
    sections = [...sections];
    const [moved] = sections.splice(index, 1);
    sections.splice(target, 0, moved!);
    note = `Moved ${current.title} ${command.direction}.`;
  }
  if (command.kind === 'rename-section') {
    const title = command.title.trim().slice(0, 80);
    if (!title) return { workspace, note: 'A section still needs a name.' };
    sections = sections.map((section) =>
      section.id === current.id ? { ...section, title } : section,
    );
    note = `Renamed the section to ${title}.`;
  }
  if (command.kind === 'set-display') {
    if (!allowedDisplays(current.kind).includes(command.display)) {
      return { workspace, note: `${current.title} cannot use that display.` };
    }
    sections = sections.map((section) =>
      section.id === current.id ? { ...section, display: command.display } : section,
    );
    note = `Changed how ${current.title} is shown.`;
  }
  if (command.kind === 'set-visible') {
    sections = sections.map((section) =>
      section.id === current.id ? { ...section, visible: command.visible } : section,
    );
    note = command.visible ? `Showing ${current.title}.` : `Hidden ${current.title}.`;
  }
  return {
    workspace: ensureSectionBindings(workspace, { ...composition, sections }, observations),
    note,
  };
}

export function interpretHealthCreation(text: string): CreationIntent {
  const value = text.trim();
  if (!value) {
    return { kind: 'handoff', text: '', reason: 'Describe the tool, or start from a foundation.' };
  }
  const lower = value.toLowerCase();
  const add = lower.match(
    /\badd(?:\s+a|\s+an|\s+the)?\s+(next action|hero|sequence|notes?|trend|chart|table|source|inspection)\b/,
  );
  if (add) {
    const sectionKind = sectionKindFromPhrase(add[1]!);
    if (sectionKind)
      return {
        kind: 'command',
        command: { kind: 'add-section', sectionKind },
        reason: `Add ${catalogEntry(sectionKind).title} to this tool.`,
      };
  }
  const remove = lower.match(
    /\b(?:remove|delete|hide)\s+(?:the\s+)?(next action|hero|sequence|notes?|trend|chart|table|source|inspection)\b/,
  );
  if (remove) {
    const sectionKind = sectionKindFromPhrase(remove[1]!);
    if (sectionKind)
      return {
        kind: 'command',
        command: { kind: 'remove-section', sectionKind },
        reason: `Remove ${catalogEntry(sectionKind).title} from this tool.`,
      };
  }
  const renameTool = value.match(/\brename(?:\s+this)?(?:\s+tool)?\s+to\s+(.+)$/i);
  if (renameTool) {
    return {
      kind: 'command',
      command: { kind: 'rename-tool', title: renameTool[1]!.trim() },
      reason: `Rename this tool to ${renameTool[1]!.trim()}.`,
    };
  }
  if (/\b(blank|empty|new tool|from scratch|start empty)\b/.test(lower)) {
    return {
      kind: 'blank',
      reason: 'Start an empty personal tool. Add supported sections yourself.',
    };
  }
  const assist = interpretHealthAssist(value);
  if (assist.kind !== 'help') return { kind: 'assist', action: assist };
  return {
    kind: 'handoff',
    text: value,
    reason:
      'That request is kept as an Architect brief. Generated-code execution is unavailable. Add or rearrange supported sections here instead of mapping the idea onto a preset.',
  };
}

function sectionKindFromPhrase(phrase: string): ToolSectionKind | null {
  if (/next action|hero/.test(phrase)) return 'hero';
  if (/sequence/.test(phrase)) return 'sequence';
  if (/note/.test(phrase)) return 'notes';
  if (/trend|chart/.test(phrase)) return 'trend';
  if (/table/.test(phrase)) return 'table';
  if (/source|inspect/.test(phrase)) return 'source';
  return null;
}

const HISTORY_LIMIT = 20;

export function pushToolHistory(
  past: HealthWorkspaceRecord[],
  snapshot: HealthWorkspaceRecord,
): HealthWorkspaceRecord[] {
  return [...past, structuredClone(snapshot)].slice(-HISTORY_LIMIT);
}

export function cloneTool(workspace: HealthWorkspaceRecord): HealthWorkspaceRecord {
  return structuredClone(workspace);
}

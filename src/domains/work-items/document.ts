import type { BriefContent, PlanContent, PaletteContent } from '@/domains/talk-creation/schema';
import type { DesignBoardContent } from '@/domains/talk-creation/design-board';
import { selectedDirection } from '@/domains/talk-creation/design-board';
import type { WorkItemKind } from './kinds';

export const talkDocumentViews = ['Edit', 'Preview', 'Split'] as const;
export type TalkDocumentView = (typeof talkDocumentViews)[number];

export type TalkDocumentField = {
  id: string;
  label: string;
  value: string;
};

export type TalkRevisionChange = {
  field: string;
  from: string;
  to: string;
};

const fieldLabels = {
  title: 'Title',
  purpose: 'Purpose',
  audience: 'Audience',
  visualDirection: 'Visual direction',
  requirements: 'Requirements',
  unresolved: 'Unresolved',
  summary: 'Summary',
  steps: 'Steps',
  notes: 'Notes',
  swatches: 'Swatches',
  selectedDirection: 'Selected direction',
} as const;

export function talkFieldLabel(field: string) {
  return field in fieldLabels ? fieldLabels[field as keyof typeof fieldLabels] : field;
}

export function talkDocumentFields(kind: WorkItemKind, content: unknown): TalkDocumentField[] {
  if (kind === 'brief') {
    const brief = content as BriefContent;
    return [
      { id: 'title', label: fieldLabels.title, value: brief.title },
      { id: 'purpose', label: fieldLabels.purpose, value: brief.purpose },
      { id: 'audience', label: fieldLabels.audience, value: brief.audience },
      { id: 'visualDirection', label: fieldLabels.visualDirection, value: brief.visualDirection },
      { id: 'requirements', label: fieldLabels.requirements, value: brief.requirements.join('\n') },
      { id: 'unresolved', label: fieldLabels.unresolved, value: brief.unresolved.join('\n') },
    ];
  }
  if (kind === 'plan') {
    const plan = content as PlanContent;
    return [
      { id: 'title', label: fieldLabels.title, value: plan.title },
      { id: 'summary', label: fieldLabels.summary, value: plan.summary },
      {
        id: 'steps',
        label: fieldLabels.steps,
        value: plan.steps.map((step) => `${step.title}: ${step.detail}`).join('\n'),
      },
    ];
  }
  if (kind === 'palette') {
    const palette = content as PaletteContent;
    return [
      { id: 'title', label: fieldLabels.title, value: palette.title },
      { id: 'notes', label: fieldLabels.notes, value: palette.notes },
      {
        id: 'swatches',
        label: fieldLabels.swatches,
        value: palette.swatches.map((swatch) => `${swatch.name} ${swatch.hex}`).join('\n'),
      },
    ];
  }
  if (kind === 'board') {
    const board = content as DesignBoardContent;
    const selected = selectedDirection(board);
    return [
      { id: 'title', label: fieldLabels.title, value: board.title },
      { id: 'selectedDirection', label: fieldLabels.selectedDirection, value: selected.name },
    ];
  }
  return [];
}

export function compileTalkDocument(kind: WorkItemKind, content: unknown): string | null {
  if (kind === 'brief') {
    const brief = content as BriefContent;
    return [
      `# ${brief.title}`,
      '',
      brief.purpose,
      '',
      brief.audience ? `Audience: ${brief.audience}` : '',
      '',
      brief.visualDirection ? `Visual direction: ${brief.visualDirection}` : '',
      '',
      ...(brief.requirements.length ? ['## Requirements', ...brief.requirements.map((item) => `- ${item}`)] : []),
      ...(brief.unresolved.length ? ['', '## Unresolved', ...brief.unresolved.map((item) => `- ${item}`)] : []),
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .trim();
  }
  if (kind === 'plan') {
    const plan = content as PlanContent;
    return [
      `# ${plan.title}`,
      '',
      plan.summary,
      '',
      '## Steps',
      ...plan.steps.map((step) => `- **${step.title}**: ${step.detail}`),
    ].join('\n');
  }
  if (kind === 'palette') {
    const palette = content as PaletteContent;
    return [`# ${palette.title}`, '', ...palette.swatches.map((swatch) => `- ${swatch.name} ${swatch.hex} (${swatch.role})`)].join(
      '\n',
    );
  }
  return null;
}

export function compareTalkRevisions(previous: unknown, current: unknown): TalkRevisionChange[] {
  const older = flattenRecord(previous);
  const newer = flattenRecord(current);
  const keys = [...new Set([...Object.keys(older), ...Object.keys(newer)])].sort();
  return keys
    .filter((key) => (older[key] ?? '') !== (newer[key] ?? ''))
    .map((key) => ({
      field: talkFieldLabel(key),
      from: older[key] ?? '',
      to: newer[key] ?? '',
    }));
}

function flattenRecord(value: unknown, prefix = ''): Record<string, string> {
  if (value == null) return {};
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return prefix ? { [prefix]: String(value) } : {};
  }
  if (Array.isArray(value)) {
    return { [prefix || 'items']: value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n') };
  }
  if (typeof value !== 'object') return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((fields, [key, item]) => {
    Object.assign(fields, flattenRecord(item, prefix ? `${prefix}.${key}` : key));
    return fields;
  }, {});
}

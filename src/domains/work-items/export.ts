import type { BriefContent, PlanContent, PaletteContent } from '@/domains/talk-creation/schema';
import type { DesignBoardContent } from '@/domains/talk-creation/design-board';
import type { WorkItemKind } from './kinds';

export type WorkItemExport = {
  filename: string;
  mime: 'text/markdown' | 'application/json';
  body: string;
  label: string;
};

export function exportTalkDocument(kind: WorkItemKind, content: unknown): WorkItemExport | null {
  if (kind === 'brief') {
    const brief = content as BriefContent;
    return {
      filename: `${slug(brief.title)}.md`,
      mime: 'text/markdown',
      label: 'Download Markdown',
      body: [
        `# ${brief.title}`,
        '',
        brief.purpose,
        '',
        brief.audience ? `Audience: ${brief.audience}` : '',
        brief.visualDirection ? `Visual direction: ${brief.visualDirection}` : '',
        '',
        ...(brief.requirements.length ? ['## Requirements', ...brief.requirements.map((item) => `- ${item}`)] : []),
        ...(brief.unresolved.length ? ['', '## Unresolved', ...brief.unresolved.map((item) => `- ${item}`)] : []),
        '',
        '_Talk Markdown export. Browser Print/PDF is a separate control._',
      ]
        .filter((line) => line !== undefined)
        .join('\n'),
    };
  }
  if (kind === 'plan') {
    const plan = content as PlanContent;
    return {
      filename: `${slug(plan.title)}.md`,
      mime: 'text/markdown',
      label: 'Download Markdown',
      body: [
        `# ${plan.title}`,
        '',
        plan.summary,
        '',
        '## Steps',
        ...plan.steps.map((step) => `- **${step.title}**: ${step.detail}`),
        '',
        '_Talk Markdown export. Browser Print/PDF is a separate control._',
      ].join('\n'),
    };
  }
  if (kind === 'palette') {
    const palette = content as PaletteContent;
    return {
      filename: `${slug(palette.title)}.md`,
      mime: 'text/markdown',
      label: 'Download Markdown',
      body: [`# ${palette.title}`, '', ...palette.swatches.map((swatch) => `- ${swatch.name} ${swatch.hex} (${swatch.role})`)].join(
        '\n',
      ),
    };
  }
  if (kind === 'board') {
    const board = content as DesignBoardContent;
    return {
      filename: `${slug(board.title)}.json`,
      mime: 'application/json',
      label: 'Download board JSON',
      body: JSON.stringify(board, null, 2),
    };
  }
  return null;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'talk-work';
}

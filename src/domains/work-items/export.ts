import type { BriefContent, PlanContent, PaletteContent } from '@/domains/talk-creation/schema';
import type { DesignBoardContent } from '@/domains/talk-creation/design-board';
import type { WorkItemKind } from './kinds';
import { compileTalkDocument } from './document';

export type WorkItemExport = {
  filename: string;
  mime: 'text/markdown' | 'application/json';
  body: string;
  label: string;
};

const exportNote = '_Talk Markdown export. Browser Print/PDF is a separate control. Native DOCX/PPTX/XLSX and stored-file PDF are not implemented._';

export function exportTalkDocument(kind: WorkItemKind, content: unknown): WorkItemExport | null {
  const compiled = compileTalkDocument(kind, content);
  if (compiled) {
    const title =
      kind === 'brief'
        ? (content as BriefContent).title
        : kind === 'plan'
          ? (content as PlanContent).title
          : (content as PaletteContent).title;
    return {
      filename: `${slug(title)}.md`,
      mime: 'text/markdown',
      label: 'Download Markdown',
      body: `${compiled}\n\n${exportNote}\n`,
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

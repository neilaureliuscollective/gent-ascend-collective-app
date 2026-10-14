import { offeredTextSchema, imageRequestSchema, type ImageRequest } from './schema';
import { designBoardContentSchema } from './design-board';
import { refineSelectedDirection } from './design-board';
import { withCalculatedContrast } from './contrast';
import { persistKind } from './persist';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database';

type Client = SupabaseClient<Database>;

export const talkLiveOfferTool = {
  type: 'function',
  name: 'offer_text_work',
  description:
    'Offer a reviewable brief, plan, palette and/or design board. Palettes and boards use exact hex tokens, never generated images or executable markup.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      brief: { type: 'object' },
      plan: { type: 'object' },
      palette: { type: 'object' },
      board: { type: 'object' },
    },
  },
};

export const talkLiveRefineTool = {
  type: 'function',
  name: 'refine_selected_direction',
  description:
    'Revise the selected design-board direction. Preserves other directions and previous versions. Use for requests such as make this warmer.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      warmer: { type: 'boolean' },
      role: {
        type: 'string',
        enum: ['background', 'surface', 'text', 'accent', 'highlight', 'muted', 'border'],
      },
      hex: { type: 'string' },
    },
  },
};

export const talkLiveCreationTools = [talkLiveOfferTool, talkLiveRefineTool];

export async function runTalkLiveOffer(
  client: Client,
  input: {
    conversationId: string;
    arguments: string;
    selected: Partial<Record<'brief' | 'plan' | 'palette' | 'board', string>>;
  },
) {
  const parsed = offeredTextSchema.parse(JSON.parse(input.arguments));
  const kinds: Array<'brief' | 'plan' | 'palette' | 'board'> = [];
  for (const kind of ['brief', 'plan', 'palette', 'board'] as const) {
    const content =
      kind === 'palette' && parsed.palette
        ? withCalculatedContrast(parsed.palette)
        : parsed[kind];
    if (!content) continue;
    await persistKind(client, {
      conversationId: input.conversationId,
      sourceTurnId: null,
      kind,
      predecessorId: input.selected[kind] ?? null,
      content,
    });
    kinds.push(kind);
  }
  return { accepted: true, saved: false, kinds, count: kinds.length };
}

export async function runTalkLiveRefine(
  client: Client,
  input: {
    conversationId: string;
    arguments: string;
    selectedBoardId: string | null;
    board: unknown;
  },
) {
  if (!input.selectedBoardId || !input.board)
    return { accepted: false, reason: 'Select a design board direction before refining it.' };
  const patch = JSON.parse(input.arguments) as { warmer?: boolean; role?: string; hex?: string };
  const next = refineSelectedDirection(designBoardContentSchema.parse(input.board), {
    warmer: patch.warmer,
    role: patch.role as 'highlight' | undefined,
    hex: patch.hex,
  });
  const result = await persistKind(client, {
    conversationId: input.conversationId,
    sourceTurnId: null,
    kind: 'board',
    predecessorId: input.selectedBoardId,
    content: next,
  });
  return { accepted: true, id: result.id, version: result.version, saved: false };
}

export function talkLiveImageRequest(raw: string): ImageRequest | null {
  try {
    return imageRequestSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

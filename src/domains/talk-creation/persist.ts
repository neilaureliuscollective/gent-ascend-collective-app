import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database';
import { contentForKind, type CreationKind, type OfferedText, type TalkCreation } from './schema';
import { withCalculatedContrast } from './contrast';

type Client = SupabaseClient<Database>;

export async function persistKind(
  client: Client,
  input: {
    id?: string;
    conversationId: string;
    sourceTurnId?: string | null;
    kind: CreationKind;
    predecessorId?: string | null;
    content: unknown;
  },
) {
  const content =
    input.kind === 'brief'
      ? contentForKind('brief', input.content)
      : input.kind === 'plan'
        ? contentForKind('plan', input.content)
        : input.kind === 'palette'
          ? withCalculatedContrast(contentForKind('palette', input.content))
          : contentForKind('handoff', input.content);
  const id = input.id ?? crypto.randomUUID();
  const result = await client.rpc('ai_talk_save_creation', {
    p_id: id,
    p_conversation: input.conversationId,
    p_turn: input.sourceTurnId ?? null,
    p_kind: input.kind,
    p_predecessor: input.predecessorId ?? null,
    p_content: content,
  });
  if (result.error || !result.data) {
    const message = result.error?.message ?? '';
    if (result.error?.code === 'P0001' && /stale/i.test(message))
      throw new Error('Stale creation version');
    if (/reused with different inputs/i.test(message))
      throw new Error('Creation request reused with different inputs');
    throw new Error('Creation could not be saved.');
  }
  const receipt = result.data as { lineageId?: string; version?: number; recovered?: boolean };
  if (!receipt.lineageId || !receipt.version)
    throw new Error('Creation could not be saved.');
  return {
    id,
    lineageId: receipt.lineageId,
    version: receipt.version,
    content,
    recovered: Boolean(receipt.recovered),
  };
}

export async function persistOfferedCreations(
  client: Client,
  conversationId: string,
  sourceTurnId: string,
  offered: OfferedText[],
  selected: Partial<Record<'brief' | 'plan' | 'palette', string>>,
) {
  const saved: TalkCreation[] = [];
  const current = { ...selected };
  for (const offer of offered) {
    for (const kind of ['brief', 'plan', 'palette'] as const) {
      const content = offer[kind];
      if (!content) continue;
      const result = await persistKind(client, {
        conversationId,
        sourceTurnId,
        kind,
        predecessorId: current[kind] ?? null,
        content,
      });
      current[kind] = result.id;
      saved.push({
        id: result.id,
        person_id: '',
        conversation_id: conversationId,
        source_turn_id: sourceTurnId,
        lineage_id: result.lineageId,
        version: result.version,
        kind,
        content: result.content,
        predecessor_id: selected[kind] ?? null,
        superseded_by: null,
        created_at: new Date().toISOString(),
      });
    }
  }
  return saved;
}

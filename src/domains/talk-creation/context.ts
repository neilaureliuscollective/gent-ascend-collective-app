import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database';
import { contentForKind, selectedCreationContext, type TalkCreation } from './schema';

export async function selectedTalkContext(
  client: SupabaseClient<Database>,
  personId: string,
  conversationId: string,
) {
  const selected = await client
    .from('ai_talk_selection')
    .select('kind,creation_id')
    .eq('person_id', personId)
    .eq('conversation_id', conversationId);
  if (selected.error || !selected.data?.length) return '';
  const ids = selected.data.map((row) => row.creation_id);
  const rows = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('person_id', personId)
    .eq('conversation_id', conversationId)
    .in('id', ids);
  if (rows.error) return '';
  const creations: TalkCreation[] = [];
  for (const row of rows.data ?? []) {
    try {
      creations.push({
        ...row,
        kind: row.kind as TalkCreation['kind'],
        content: contentForKind(row.kind as TalkCreation['kind'], row.content),
      });
    } catch {
      /* Invalid stored rows are omitted from model context. */
    }
  }
  return selectedCreationContext(creations);
}

export async function selectedTalkPredecessors(
  client: SupabaseClient<Database>,
  personId: string,
  conversationId: string,
) {
  const selected = await client
    .from('ai_talk_selection')
    .select('kind,creation_id')
    .eq('person_id', personId)
    .eq('conversation_id', conversationId);
  const current: Partial<Record<'brief' | 'plan' | 'palette', string>> = {};
  for (const item of selected.data ?? []) {
    if (item.kind === 'brief' || item.kind === 'plan' || item.kind === 'palette')
      current[item.kind] = item.creation_id;
  }
  return current;
}

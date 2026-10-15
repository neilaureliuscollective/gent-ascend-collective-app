import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseConnection } from '@/platform/supabase/connection';
import type { Database } from '@/platform/supabase/database';

/**
 * Narrow trusted write of a server-observed provider item. Uses the loopback
 * or hosted service-role key only inside this helper. The key is never returned
 * to the browser. Authenticated PostgREST cannot execute this RPC.
 */
export async function observeTrustedVoiceItem(input: {
  sessionId: string;
  conversationId: string;
  item: string;
  response: string | null;
  turnId: string;
}): Promise<{ observed: boolean; trusted: boolean }> {
  const connection = supabaseConnection(process.env);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!connection || !key)
    return { observed: false, trusted: false };
  const client = createClient<Database>(connection.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const saved = await client.rpc('ai_live_observe_trusted_item', {
    p_session: input.sessionId,
    p_conversation: input.conversationId,
    p_item: input.item,
    p_response: input.response,
    p_turn: input.turnId,
  });
  if (saved.error || !saved.data) return { observed: false, trusted: false };
  return { observed: true, trusted: true };
}

import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabaseConnection } from '@/platform/supabase/connection';
import type { Database } from '@/platform/supabase/database';
import { hangup, validTag } from './cleanup';

export function expiryAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim().length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get('authorization') ?? '');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
const claimedCall = z
  .object({
    id: z.uuid(),
    person_id: z.uuid(),
    lease_token: z.uuid(),
    call_id: z.string().min(1).max(200),
    call_tag: z.string().length(64),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();
export async function sweepExpiredLive() {
  const connection = supabaseConnection(process.env);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.OPENAI_API_KEY;
  if (!connection || !serviceKey || !key) throw new Error('Expiry configuration unavailable');
  // Infrastructure-only client. No table reads or normal user/AI action path.
  const client = createClient<Database>(connection.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const claim = await client
    .rpc('ai_live_claim_expired', {})
    .abortSignal(AbortSignal.timeout(5000));
  if (claim.error) throw new Error('Expiry claim unavailable');
  const rows = z.array(z.unknown()).max(5).parse(claim.data);
  let confirmed = 0;
  const results = await Promise.allSettled(
    rows.map(async (raw) => {
      const row = claimedCall.parse(raw);
      if (
        Date.parse(row.expires_at) > Date.now() ||
        !validTag(key, row.person_id, row.id, row.call_id, row.call_tag)
      )
        throw new Error('Expiry binding invalid');
      await hangup(key, row.call_id);
      const saved = await client
        .rpc('ai_live_confirm_expired', {
          p_id: row.id,
          p_token: row.lease_token,
        })
        .abortSignal(AbortSignal.timeout(5000));
      if (saved.error || saved.data !== true) throw new Error('Expiry confirmation unavailable');
      confirmed++;
    }),
  );
  return {
    claimed: rows.length,
    confirmed,
    pending: results.filter((r) => r.status === 'rejected').length,
  };
}

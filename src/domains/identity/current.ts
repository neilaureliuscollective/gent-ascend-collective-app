import 'server-only';
import { cache } from 'react';
import { serverClient } from '@/platform/supabase/server';
export const currentIdentity = cache(async () => {
  const client = await serverClient();
  if (!client) return null;
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { authUserId: data.claims.sub, client };
});

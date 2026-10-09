import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { IntelligenceError } from '@/domains/intelligence/service';
import { supabaseConnection } from '@/platform/supabase/connection';
import type { Database } from '@/platform/supabase/database';
import { connectionConfig } from './config';
import {
  credentialSchema,
  identitySchema,
  tokensSchema,
  scheduleSchema,
  windowSchema,
  type Connection,
} from './schema';
import { nonce, challenge, seal, unseal, equalState } from './crypto';
const cookie = 'aethelios-business-link';
const flowSchema = z
  .object({
    person: z.uuid(),
    authUser: z.uuid(),
    session: z.string(),
    id: z.uuid(),
    state: z.string(),
    verifier: z.string(),
    expires: z.number(),
  })
  .strict();
export async function businessSession() {
  const identity = await currentIdentity(),
    person = await currentPerson();
  if (!identity || !person) throw new IntelligenceError('Sign in to connect your business.', 401);
  const [user, claims] = await Promise.all([
    identity.client.auth.getUser(),
    identity.client.auth.getClaims(),
  ]);
  if (
    user.error ||
    claims.error ||
    !user.data.user?.email_confirmed_at ||
    user.data.user.id !== identity.authUserId ||
    user.data.user.is_anonymous ||
    claims.data?.claims.sub !== identity.authUserId ||
    !claims.data?.claims.session_id
  )
    throw new IntelligenceError('Use your confirmed account to connect a business.', 401);
  return {
    client: identity.client,
    person,
    authUser: identity.authUserId,
    session: String(claims.data.claims.session_id),
  };
}
async function control(
  command: string,
  person: string,
  id: string,
  lease: string | null = null,
  payload: unknown = {},
) {
  const config = supabaseConnection(process.env);
  if (!config || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new IntelligenceError('Connection broker is awaiting activation.', 503);
  const db = createClient<Database>(config.url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await db.rpc('business_control', {
    p_command: command,
    p_person: person,
    p_id: id,
    p_lease: lease,
    p_payload: payload,
  });
  if (result.error)
    throw new IntelligenceError(
      'Connection changed or requires reconnection. Refresh before retrying.',
      409,
    );
  return result.data as { ciphertext?: string };
}
export async function listConnections() {
  const { client, person } = await businessSession();
  if (process.env.BUSINESS_CONNECTIONS_ENABLED !== 'true')
    return { connections: [] as Connection[], enabled: false };
  const result = await client
    .from('business_connections')
    .select('*')
    .eq('person_id', person.id)
    .order('created_at', { ascending: false });
  if (result.error)
    throw new IntelligenceError('Business connection migration is awaiting activation.', 503);
  return { connections: result.data ?? [], enabled: true };
}
export async function ownedConnection(id: string) {
  const session = await businessSession();
  const result = await session.client
    .from('business_connections')
    .select('*')
    .eq('id', id)
    .eq('person_id', session.person.id)
    .single();
  if (result.error || !result.data)
    throw new IntelligenceError('Business connection not found.', 404);
  return { ...session, connection: result.data };
}
export async function beginConnection(company: string) {
  const config = connectionConfig(),
    session = await businessSession(),
    id = randomUUID(),
    state = nonce(),
    verifier = nonce();
  const result = await session.client.rpc('business_begin', { p_id: id, p_company: company });
  if (result.error)
    throw new IntelligenceError('Choose your own company room, or disconnect an older link.', 409);
  const value = seal(
    {
      person: session.person.id,
      authUser: session.authUser,
      session: session.session,
      id,
      state,
      verifier,
      expires: Date.now() + 600000,
    },
    config.key,
    'oauth-start',
  );
  (await cookies()).set(cookie, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/business-connections',
    maxAge: 600,
  });
  const url = new URL(config.auth + '/auth/v1/oauth/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.client,
    redirect_uri: config.callback,
    scope: 'openid',
    state,
    code_challenge: challenge(verifier),
    code_challenge_method: 'S256',
  }).toString();
  return url.href;
}
async function oauth(body: Record<string, string>) {
  const config = connectionConfig();
  const response = await fetch(config.auth + '/auth/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(config.client + ':' + config.secret).toString('base64'),
    },
    body: new URLSearchParams(body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new IntelligenceError('Reserve authorization could not be renewed. Reconnect.', 409);
  return tokensSchema.parse(await response.json());
}
async function remote(path: string, access: string, link: string, method = 'GET', body?: unknown) {
  const config = connectionConfig();
  const response = await fetch(config.origin + '/api/business-connections/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + access,
      'x-business-link': link,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new IntelligenceError(
      response.status === 403
        ? 'Reserve access was revoked or changed. Reconnect.'
        : response.status === 409
          ? 'Reserve content changed. Reload before preparing a new proposal.'
          : response.status === 429
            ? 'Reserve’s proposal limit was reached. Review existing changes.'
            : 'Reserve is unavailable or sign-in expired.',
      [401, 403, 404, 409, 429].includes(response.status) ? response.status : 503,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new IntelligenceError('Reserve response unavailable.', 503);
  const decoder = new TextDecoder();
  let size = 0,
    text = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > 24000) {
      await reader.cancel();
      throw new IntelligenceError('Reserve response exceeded its limit.', 503);
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return JSON.parse(text + decoder.decode()) as unknown;
}
export async function completeConnection(url: URL) {
  const config = connectionConfig(),
    session = await businessSession(),
    jar = await cookies(),
    raw = jar.get(cookie)?.value;
  jar.set(cookie, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/business-connections',
    maxAge: 0,
  });
  if (!raw) throw new IntelligenceError('Connection expired. Start again.', 409);
  let flow: z.infer<typeof flowSchema>;
  try {
    flow = flowSchema.parse(unseal(raw, config.key, 'oauth-start'));
  } catch {
    throw new IntelligenceError('Connection state was refused.', 403);
  }
  if (
    flow.person !== session.person.id ||
    flow.authUser !== session.authUser ||
    flow.session !== session.session ||
    flow.expires < Date.now() ||
    !equalState(flow.state, url.searchParams.get('state') ?? '')
  )
    throw new IntelligenceError('Connection session changed. Start again.', 403);
  if (url.searchParams.has('error'))
    throw new IntelligenceError('Connection declined. No business access was activated.', 409);
  const code = z.string().min(1).max(2000).parse(url.searchParams.get('code')),
    lease = randomUUID();
  await control('exchange', session.person.id, flow.id, lease);
  try {
    const tokens = await oauth({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.callback,
      code_verifier: flow.verifier,
    });
    const identity = identitySchema.parse(
      await remote('identity', tokens.access_token, flow.state),
    );
    if (new Date(identity.expiresAt).getTime() <= Date.now()) throw Error('Expired grant');
    const credential = {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expires: Date.now() + tokens.expires_in * 1000,
      link: flow.state,
    };
    await control('finish', session.person.id, flow.id, lease, {
      ...identity,
      ciphertext: seal(credential, config.key, session.person.id + ':' + flow.id),
    });
    return flow.id;
  } catch (error) {
    await control('fail', session.person.id, flow.id, lease).catch(() => undefined);
    throw error;
  }
}
async function credentialFor(person: string, connection: Connection) {
  const config = connectionConfig(),
    data = await control('read', person, connection.id);
  if (!data.ciphertext) throw new IntelligenceError('Reconnect your business.', 409);
  let credential = credentialSchema.parse(
    unseal(data.ciphertext, config.key, person + ':' + connection.id),
  );
  if (credential.expires > Date.now() + 60000) return credential;
  const lease = randomUUID(),
    claimed = await control('refresh', person, connection.id, lease);
  try {
    credential = credentialSchema.parse(
      unseal(claimed.ciphertext!, config.key, person + ':' + connection.id),
    );
    const tokens = await oauth({ grant_type: 'refresh_token', refresh_token: credential.refresh });
    const identity = identitySchema.parse(
      await remote('identity', tokens.access_token, credential.link),
    );
    if (
      identity.subject !== connection.remote_subject ||
      identity.providerId !== connection.provider_id ||
      identity.grantId !== connection.grant_id
    )
      throw Error('Grant changed');
    credential = {
      ...credential,
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expires: Date.now() + tokens.expires_in * 1000,
    };
    await control('finish', person, connection.id, lease, {
      ...identity,
      ciphertext: seal(credential, config.key, person + ':' + connection.id),
    });
    return credential;
  } catch (error) {
    await control('fail', person, connection.id, lease).catch(() => undefined);
    throw error;
  }
}
export async function readSchedule(id: string, window: unknown) {
  const scope = windowSchema.parse(window),
    { person, connection } = await ownedConnection(id);
  if (
    connection.status !== 'active' ||
    !connection.grant_expires_at ||
    new Date(connection.grant_expires_at).getTime() <= Date.now()
  )
    throw new IntelligenceError('Reconnect to read this professional’s schedule.', 409);
  const credential = await credentialFor(person.id, connection);
  const query = new URLSearchParams({
    date: scope.date,
    days: String(scope.days),
    page: String(scope.page),
  });
  const schedule = scheduleSchema.parse(
    await remote('schedule?' + query, credential.access, credential.link),
  );
  if (
    schedule.providerId !== connection.provider_id ||
    schedule.date !== scope.date ||
    schedule.days !== scope.days ||
    schedule.page !== scope.page
  )
    throw new IntelligenceError('Schedule scope mismatch.', 403);
  // Check disconnect races before returning or using data as model context.
  const current = await ownedConnection(id);
  if (current.connection.status !== 'active')
    throw new IntelligenceError('Business disconnected.', 403);
  return { schedule, connection };
}
export async function disconnectConnection(id: string) {
  const { person } = await ownedConnection(id),
    config = connectionConfig();
  const data = await control('disconnect', person.id, id); // Disable locally before network work.
  let remoteRevoked = false;
  if (data.ciphertext) {
    try {
      const credential = credentialSchema.parse(
        unseal(data.ciphertext, config.key, person.id + ':' + id),
      );
      await remote('revoke', credential.access, credential.link, 'POST');
      remoteRevoked = true;
    } catch {
      /* Local disconnect remains effective; surface unconfirmed remote revocation. */
    }
  }
  return { disconnected: true, remoteRevoked };
}
export async function saveBusinessSource(id: string, requestId: string, snapshot: unknown) {
  const { person } = await ownedConnection(id);
  await control('source', person.id, id, null, { requestId, snapshot });
}

async function websiteCredential(id: string, permission: string) {
  if (process.env.BUSINESS_WEBSITES_ENABLED !== 'true')
    throw new IntelligenceError('Business websites are awaiting activation.', 503);
  const { person, connection } = await ownedConnection(id);
  if (
    connection.status !== 'active' ||
    !connection.permissions.includes(permission) ||
    !connection.grant_expires_at ||
    new Date(connection.grant_expires_at).getTime() <= Date.now()
  )
    throw new IntelligenceError('Reconnect with website permission.', 403);
  return { connection, credential: await credentialFor(person.id, connection) };
}
export async function readWebsite(id: string) {
  const { connection, credential } = await websiteCredential(id, 'website.read');
  const { websiteSourceSchema } = await import('./website-schema');
  const source = websiteSourceSchema.parse(
    await remote('website', credential.access, credential.link),
  );
  if (source.providerId !== connection.provider_id)
    throw new IntelligenceError('Website scope mismatch.', 403);
  const current = await ownedConnection(id);
  if (current.connection.status !== 'active')
    throw new IntelligenceError('Business disconnected.', 403);
  return { source, connection };
}
export async function proposeWebsiteChange(raw: unknown) {
  const { websiteInputSchema } = await import('./website-schema');
  const input = websiteInputSchema.parse(raw),
    { connection, credential } = await websiteCredential(input.connectionId, 'website.propose');
  const { connectionId, ...body } = input;
  void connectionId;
  const result = z
    .object({ id: z.uuid(), state: z.enum(['review', 'approved', 'rejected']) })
    .strict()
    .parse(await remote('website', credential.access, credential.link, 'POST', body));
  const config = connectionConfig();
  return {
    ...result,
    reviewUrl: config.origin + '/studio/websites',
    companyId: connection.company_id,
  };
}

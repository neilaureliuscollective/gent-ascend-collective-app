import { legacyReserveDestination } from '@/platform/ecosystem';
export function connectionConfig(env: Record<string, string | undefined> = process.env) {
  if (env.BUSINESS_CONNECTIONS_ENABLED !== 'true')
    throw Error('Business connections are awaiting activation.');
  const origin = legacyReserveDestination(env.RESERVE_BUSINESS_ORIGIN),
    auth = legacyReserveDestination(env.RESERVE_AUTH_ORIGIN),
    callbackOrigin = legacyReserveDestination(env.BUSINESS_APP_ORIGIN);
  if (
    !origin ||
    !auth ||
    !callbackOrigin ||
    new URL(origin).pathname !== '/' ||
    new URL(auth).pathname !== '/' ||
    new URL(callbackOrigin).pathname !== '/' ||
    !env.RESERVE_OAUTH_CLIENT_ID ||
    !env.RESERVE_OAUTH_CLIENT_SECRET ||
    !/^[a-f0-9]{64}$/i.test(env.BUSINESS_CONNECTION_KEY ?? '')
  )
    throw Error('Business connection setup is incomplete.');
  return {
    origin: origin.replace(/\/$/, ''),
    auth: auth.replace(/\/$/, ''),
    callback: callbackOrigin.replace(/\/$/, '') + '/api/business-connections/callback',
    client: env.RESERVE_OAUTH_CLIENT_ID,
    secret: env.RESERVE_OAUTH_CLIENT_SECRET,
    key: env.BUSINESS_CONNECTION_KEY!,
  };
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConnection } from '@/platform/supabase/connection';
import type { Database } from '@/platform/supabase/database';
import { ConnectionError } from './errors';
import type { ConnectionProvider, ConnectionRecord, FlowRecord } from './schema';

export type ConnectionStore = {
  beginFlow(flow: FlowRecord): Promise<void>;
  readFlow(state: string): Promise<FlowRecord | null>;
  consumeFlow(state: string, consumedAt: string): Promise<boolean>;
  claimInstallation(state: string, installationId: string): Promise<boolean>;
  readConnection(personId: string, provider: ConnectionProvider): Promise<ConnectionRecord | null>;
  listConnections(personId: string): Promise<ConnectionRecord[]>;
  upsertConnection(record: ConnectionRecord): Promise<void>;
  putSecret(connectionId: string, ciphertext: string): Promise<void>;
  takeSecret(connectionId: string): Promise<string | null>;
  clearConnection(personId: string, provider: ConnectionProvider): Promise<boolean>;
  recordEvent(provider: ConnectionProvider, deliveryId: string): Promise<boolean>;
  applyProviderStatus(
    provider: ConnectionProvider,
    installationId: string,
    status: ConnectionRecord['status'],
    error: string | null,
  ): Promise<void>;
};

function row(value: Record<string, unknown>): ConnectionRecord {
  return {
    id: String(value.id),
    personId: String(value.person_id),
    provider: value.provider as ConnectionProvider,
    status: value.status as ConnectionRecord['status'],
    accountLogin: typeof value.account_login === 'string' ? value.account_login : null,
    accountId: typeof value.account_id === 'string' ? value.account_id : null,
    installationId: typeof value.installation_id === 'string' ? value.installation_id : null,
    selectedId: typeof value.selected_id === 'string' ? value.selected_id : null,
    selectedName: typeof value.selected_name === 'string' ? value.selected_name : null,
    capabilities:
      value.capabilities && typeof value.capabilities === 'object'
        ? (value.capabilities as Record<string, unknown>)
        : {},
    lastVerifiedAt: typeof value.last_verified_at === 'string' ? value.last_verified_at : null,
    lastError: typeof value.last_error === 'string' ? value.last_error : null,
    createdAt: String(value.created_at),
    updatedAt: String(value.updated_at),
  };
}

function flowRow(value: Record<string, unknown>): FlowRecord {
  return {
    id: String(value.id),
    personId: String(value.person_id),
    provider: value.provider as ConnectionProvider,
    state: String(value.state),
    nonce: String(value.nonce),
    verifier: String(value.verifier),
    claimedInstallationId:
      typeof value.claimed_installation_id === 'string' ? value.claimed_installation_id : null,
    expiresAt: String(value.expires_at),
    consumedAt: typeof value.consumed_at === 'string' ? value.consumed_at : null,
  };
}

export function memoryStore(seed: ConnectionRecord[] = []): ConnectionStore {
  const flows = new Map<string, FlowRecord>();
  const connections = new Map<string, ConnectionRecord>();
  const secrets = new Map<string, string>();
  const events = new Set<string>();
  for (const item of seed) connections.set(`${item.personId}:${item.provider}`, item);
  return {
    async beginFlow(flow) {
      flows.set(flow.state, { ...flow });
    },
    async readFlow(state) {
      return flows.get(state) ?? null;
    },
    async consumeFlow(state, consumedAt) {
      const flow = flows.get(state);
      if (!flow || flow.consumedAt) return false;
      flows.set(state, { ...flow, consumedAt });
      return true;
    },
    async claimInstallation(state, installationId) {
      const flow = flows.get(state);
      if (!flow || flow.consumedAt) return false;
      flows.set(state, { ...flow, claimedInstallationId: installationId });
      return true;
    },
    async readConnection(personId, provider) {
      return connections.get(`${personId}:${provider}`) ?? null;
    },
    async listConnections(personId) {
      return [...connections.values()].filter((item) => item.personId === personId);
    },
    async upsertConnection(record) {
      connections.set(`${record.personId}:${record.provider}`, { ...record });
    },
    async putSecret(connectionId, ciphertext) {
      secrets.set(connectionId, ciphertext);
    },
    async takeSecret(connectionId) {
      return secrets.get(connectionId) ?? null;
    },
    async clearConnection(personId, provider) {
      const current = connections.get(`${personId}:${provider}`);
      if (!current) return false;
      secrets.delete(current.id);
      connections.delete(`${personId}:${provider}`);
      return true;
    },
    async recordEvent(provider, deliveryId) {
      const key = `${provider}:${deliveryId}`;
      if (events.has(key)) return false;
      events.add(key);
      return true;
    },
    async applyProviderStatus(provider, installationId, status, error) {
      for (const [key, item] of connections) {
        if (item.provider === provider && item.installationId === installationId) {
          connections.set(key, {
            ...item,
            status,
            lastError: error,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    },
  };
}

type RpcClient = SupabaseClient<Database>;

async function rpc<T>(
  client: RpcClient,
  name: string,
  args: Record<string, unknown>,
  missing = 'Connections could not be saved.',
): Promise<T> {
  const result = await client.rpc(name as never, args as never);
  if (result.error)
    throw new ConnectionError(
      result.error.message?.includes('Founder access')
        ? 'Founder access required.'
        : result.error.message?.includes('Sign in')
          ? 'Sign in required.'
          : missing,
      result.error.message?.includes('Founder') ? 403 : 503,
      result.error.message?.includes('Founder') ? 'denied' : 'unavailable',
    );
  return result.data as T;
}

export function sessionStore(client: RpcClient): ConnectionStore {
  return {
    async beginFlow(flow) {
      await rpc(client, 'service_connection_begin_flow', {
        p_id: flow.id,
        p_provider: flow.provider,
        p_state: flow.state,
        p_nonce: flow.nonce,
        p_verifier: flow.verifier,
        p_expires: flow.expiresAt,
      });
    },
    async readFlow(state) {
      const data = await rpc<Record<string, unknown> | null>(
        client,
        'service_connection_read_flow',
        { p_state: state },
        'The authorization attempt could not be read.',
      );
      return data ? flowRow(data) : null;
    },
    async consumeFlow(state, consumedAt) {
      return rpc<boolean>(client, 'service_connection_consume_flow', {
        p_state: state,
        p_consumed: consumedAt,
      });
    },
    async claimInstallation(state, installationId) {
      return rpc<boolean>(client, 'service_connection_claim_install', {
        p_state: state,
        p_installation: installationId,
      });
    },
    async readConnection(personId, provider) {
      const data = await rpc<Record<string, unknown> | null>(
        client,
        'service_connection_read',
        { p_provider: provider },
        'The connection could not be read.',
      );
      if (!data) return null;
      const parsed = row(data);
      return parsed.personId === personId ? parsed : null;
    },
    async listConnections(personId) {
      const data = await rpc<Record<string, unknown>[]>(
        client,
        'service_connection_list',
        {},
        'Connections could not be loaded.',
      );
      return (data ?? []).map(row).filter((item) => item.personId === personId);
    },
    async upsertConnection(record) {
      await rpc(client, 'service_connection_upsert', {
        p_id: record.id,
        p_provider: record.provider,
        p_status: record.status,
        p_account_login: record.accountLogin,
        p_account_id: record.accountId,
        p_installation: record.installationId,
        p_selected_id: record.selectedId,
        p_selected_name: record.selectedName,
        p_capabilities: record.capabilities,
        p_verified: record.lastVerifiedAt,
        p_error: record.lastError,
      });
    },
    async putSecret(connectionId, ciphertext) {
      await rpc(client, 'service_connection_put_secret', {
        p_id: connectionId,
        p_ciphertext: ciphertext,
      });
    },
    async takeSecret(connectionId) {
      return rpc<string | null>(client, 'service_connection_take_secret', { p_id: connectionId });
    },
    async clearConnection(personId, provider) {
      return rpc<boolean>(client, 'service_connection_clear', { p_provider: provider });
    },
    async recordEvent() {
      return false;
    },
    async applyProviderStatus() {
      /* Session clients cannot apply unsigned webhook state. */
    },
  };
}

export function webhookStore(): ConnectionStore {
  const connection = supabaseConnection(process.env);
  if (!connection || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new ConnectionError('Webhook persistence is not configured.', 503, 'setup_required');
  const client = createClient<Database>(connection.url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    ...sessionStore(client),
    async beginFlow() {
      throw new ConnectionError('Webhook store cannot start authorization.', 403, 'denied');
    },
    async recordEvent(provider, deliveryId) {
      return rpc<boolean>(client, 'service_connection_record_event', {
        p_provider: provider,
        p_delivery: deliveryId,
      });
    },
    async applyProviderStatus(provider, installationId, status, error) {
      await rpc(client, 'service_connection_apply_status', {
        p_provider: provider,
        p_installation: installationId,
        p_status: status,
        p_error: error,
      });
    },
  };
}

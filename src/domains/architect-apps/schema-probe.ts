export const requiredAppsSchemaContracts = {
  tables: {
    architect_apps: ['id'],
    architect_app_revisions: ['id'],
    architect_app_artifacts: ['revision_id'],
    architect_app_jobs: ['id'],
    architect_app_events: ['id'],
    architect_app_records: ['id'],
    architect_app_preview_sessions: ['nonce'],
    architect_app_generation_runs: ['request_id'],
    architect_app_worker_presence: ['worker_id'],
    architect_apps_execution_policy: ['founder_pilot'],
    architect_app_generation_budgets: ['run_id'],
  },
  rpcs: [
    'architect_apps_approve',
    'architect_apps_start',
    'architect_apps_claim',
    'architect_apps_heartbeat',
    'architect_apps_finish',
    'architect_apps_write_record',
    'architect_apps_timeout',
    'architect_apps_schema_probe',
    'architect_apps_preview_issue',
    'architect_apps_preview_read',
    'architect_apps_preview_current',
    'architect_apps_preview_revoke',
    'architect_apps_reserve_generation',
    'architect_apps_begin_generation',
    'architect_apps_finish_generation',
    'architect_apps_report_worker_presence',
    'architect_apps_worker_readiness',
    'architect_apps_set_execution_policy',
    'architect_apps_require_execution',
    'architect_apps_lock_generation_budget',
  ],
} as const;

export type AppsSchemaTableName = keyof typeof requiredAppsSchemaContracts.tables;
export type AppsSchemaProbeClassification = 'ok' | 'unavailable' | 'denied' | 'misconfigured';

export type AppsSchemaProbe = {
  ok: boolean;
  classification: AppsSchemaProbeClassification;
  missing: string[];
  details: { name: string; kind: 'table' | 'rpc'; classification: AppsSchemaProbeClassification; column?: string }[];
};

export type AppsSchemaLookup = (
  kind: 'table' | 'rpc',
  name: string,
  column?: string,
) => Promise<{ ok: boolean; error?: { message?: string; code?: string } | null } | boolean>;

export function classifySchemaProbeError(error: { message?: string; code?: string } | null | undefined): AppsSchemaProbeClassification {
  if (!error) return 'ok';
  const code = error.code ?? '';
  const message = error.message ?? '';
  if (
    code === '42501' ||
    /permission denied|row-level security|not authorized|worker authorization required/i.test(message)
  )
    return 'denied';
  if (code === '42703' || /column .+ does not exist|incorrect configuration|schema contract/i.test(message))
    return 'misconfigured';
  if (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42883' ||
    /could not find the function|schema cache|relation .+ does not exist|function .+ does not exist|does not exist/i.test(message)
  )
    return 'unavailable';
  return 'unavailable';
}

export function tableKeyColumn(name: string) {
  const columns = requiredAppsSchemaContracts.tables[name as AppsSchemaTableName];
  return columns?.[0] ?? 'id';
}

export async function probeAppsSchemaCompatibility(lookup: AppsSchemaLookup): Promise<AppsSchemaProbe> {
  const details: AppsSchemaProbe['details'] = [];
  for (const [table, columns] of Object.entries(requiredAppsSchemaContracts.tables)) {
    const column = columns[0];
    const result = await lookup('table', table, column);
    const ok = typeof result === 'boolean' ? result : result.ok;
    const classification = ok
      ? 'ok'
      : classifySchemaProbeError(typeof result === 'boolean' ? { message: `Missing table ${table}` } : result.error);
    if (!ok) details.push({ name: table, kind: 'table', classification, column });
  }
  for (const rpc of requiredAppsSchemaContracts.rpcs) {
    const result = await lookup('rpc', rpc);
    const ok = typeof result === 'boolean' ? result : result.ok;
    const classification = ok
      ? 'ok'
      : classifySchemaProbeError(typeof result === 'boolean' ? { message: `Missing function ${rpc}` } : result.error);
    if (!ok) details.push({ name: rpc, kind: 'rpc', classification });
  }
  const missing = details.map((row) => row.name);
  const denied = details.some((row) => row.classification === 'denied');
  const misconfigured = details.some((row) => row.classification === 'misconfigured');
  return {
    ok: missing.length === 0,
    classification: missing.length === 0 ? 'ok' : denied ? 'denied' : misconfigured ? 'misconfigured' : 'unavailable',
    missing,
    details,
  };
}

export type AppsSchemaClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => PromiseLike<{ error: { message: string; code?: string } | null }>;
    };
  };
};

export async function probeAppsSchemaFromClient(client: AppsSchemaClient): Promise<AppsSchemaProbe> {
  const probed = await client.rpc('architect_apps_schema_probe');
  if (!probed.error && probed.data && typeof probed.data === 'object') {
    const report = probed.data as { ok?: boolean; missing?: string[] };
    if (report.ok) {
      return { ok: true, classification: 'ok', missing: [], details: [] };
    }
    const missing = Array.isArray(report.missing) ? report.missing.map(String) : ['architect_apps_schema_probe'];
    return {
      ok: false,
      classification: 'unavailable',
      missing,
      details: missing.map((name) => ({
        name,
        kind: requiredAppsSchemaContracts.rpcs.includes(name as (typeof requiredAppsSchemaContracts.rpcs)[number])
          ? 'rpc'
          : 'table',
        classification: 'unavailable',
      })),
    };
  }
  const rpcError = classifySchemaProbeError(probed.error);
  if (rpcError === 'denied') {
    return {
      ok: false,
      classification: 'denied',
      missing: ['architect_apps_schema_probe'],
      details: [{ name: 'architect_apps_schema_probe', kind: 'rpc', classification: 'denied' }],
    };
  }
  return probeAppsSchemaCompatibility(async (kind, name, column) => {
    if (kind === 'rpc') {
      const result = await client.rpc(name, {});
      if (!result.error) return { ok: true };
      return { ok: false, error: result.error };
    }
    const result = await client.from(name).select(column ?? tableKeyColumn(name)).limit(0);
    if (!result.error) return { ok: true };
    return { ok: false, error: result.error };
  });
}

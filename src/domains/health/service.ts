import 'server-only';
import { createHash } from 'node:crypto';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { IntelligenceError } from '@/domains/intelligence/service';
import {
  emptyHealth,
  observationSchema,
  type HealthData,
  type HealthRecord,
  type HealthWorkspaceRecord,
  type Mutation,
  type SavedObservation,
} from './schema';
import {
  acceptArchitectAttempt,
  architectAttemptSchema,
  architectUnavailableMessage,
  ARCHITECT_APPS_DEPENDENCY,
  requestArchitectRevision,
} from './architect-adapter';
import { projectBridgeObservations } from './bloodwork';
import { sampleBloodwork, sampleProjection } from './sample';
import { originalMime, parseLabImport } from './imports';
import { weightKg } from './trends';
import { localDay } from '@/domains/daily/model';
import { shiftDay } from '@/domains/performance/fuel';

export async function healthSession() {
  const identity = await currentIdentity(),
    person = await currentPerson();
  if (!identity || !person)
    throw new IntelligenceError('Sign in to open your private Health environment.', 401);
  return { ...identity, person };
}
export async function healthRpc(kind: string, request: string, payload: unknown) {
  const { client } = await healthSession();
  const result = await client.rpc('health_mutate', {
    p_kind: kind,
    p_request: request,
    p_payload: payload,
  });
  if (result.error) {
    const code = result.error.code;
    throw new IntelligenceError(
      code === '40001' || code === '23505'
        ? 'This record or request changed. Reload before continuing.'
        : code === '42501'
          ? 'Health permission is unavailable. Review your consent and release status.'
          : 'Health could not save this request. Your original remains private.',
      code === '40001' || code === '23505' ? 409 : code === '42501' ? 403 : 503,
    );
  }
  return result.data;
}
export async function readHealth(): Promise<HealthData> {
  const identity = await currentIdentity(),
    person = await currentPerson();
  if (!identity || !person) return emptyHealth();
  const snapshot = await identity.client.rpc('health_read', {});
  if (snapshot.error || !snapshot.data) return { ...emptyHealth('unavailable'), owner: person.id };
  const data = snapshot.data as Pick<
    HealthData,
    'records' | 'observations' | 'consents' | 'jobs' | 'turns'
  > & {
    activation: { ingestion: boolean; ai: boolean };
    workspaces?: HealthWorkspaceRecord[];
  };
  const result: HealthData = {
    ...emptyHealth('personal'),
    ...data,
    owner: person.id,
    workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
    architect: {
      status: 'blocked',
      blocker: architectUnavailableMessage(),
      dependency: ARCHITECT_APPS_DEPENDENCY,
    },
    ingestionEnabled: process.env.HEALTH_INGESTION_ENABLED === 'true' && data.activation.ingestion,
    aiEnabled: process.env.HEALTH_AI_ENABLED === 'true' && data.activation.ai,
  };
  if (!data.consents.some((c) => c.purpose === 'wellness' && c.granted)) return result;
  const today = localDay(new Date(), person.timezone),
    since = shiftDay(today, -27);
  const [checks, movements] = await Promise.allSettled([
    identity.client
      .from('performance_checkins')
      .select('*')
      .eq('person_id', person.id)
      .gte('day', since)
      .lte('day', today)
      .order('day'),
    identity.client
      .from('performance_movements')
      .select('*')
      .eq('person_id', person.id)
      .gte('day', since)
      .lte('day', today)
      .order('day')
      .limit(560),
  ]);
  if (checks.status === 'fulfilled' && !checks.value.error) {
    for (const c of checks.value.data ?? []) {
      const provenance = {
        date: c.day,
        source: 'Performance · your self-report',
        updatedAt: c.updated_at,
        version: c.version,
      };
      if (c.energy !== null || c.soreness !== null)
        result.wellness.recovery.push({
          date: c.day,
          energy: c.energy,
          soreness: c.soreness,
          updatedAt: c.updated_at,
          version: c.version,
        });
      if (c.sleep_minutes !== null)
        result.wellness.sleep.push({
          ...provenance,
          value: c.sleep_minutes / 60,
          originalValue: c.sleep_minutes,
          originalUnit: 'min',
        });
      if (c.weight !== null)
        result.wellness.weight.push({
          ...provenance,
          value: weightKg(c.weight, c.unit),
          originalValue: c.weight,
          originalUnit: c.unit,
        });
    }
  } else result.wellness.unavailable.push('Sleep and body records');
  if (movements.status === 'fulfilled' && !movements.value.error) {
    for (const r of movements.value.data ?? []) {
      const entry = r.entry as { day: string; minutes: number; voided?: boolean };
      if (!entry.voided)
        result.wellness.movement.push({
          date: entry.day,
          value: entry.minutes,
          source: 'Performance · recorded movement',
          updatedAt: r.updated_at,
          version: r.version,
        });
    }
  } else result.wellness.unavailable.push('Movement records');
  return result;
}
export async function verifyHealthOwner(request: Request) {
  const { person } = await healthSession();
  if (request.headers.get('x-aethelios-health-owner') !== person.id)
    throw new IntelligenceError('Your account changed. Reopen Health before continuing.', 409);
}
export async function requireRecentAuth() {
  const { client } = await healthSession();
  const user = await client.auth.getUser();
  const at = user.data.user?.last_sign_in_at;
  if (user.error || !at || Date.now() - Date.parse(at) > 15 * 60 * 1000)
    throw new IntelligenceError(
      'Sign in again before exporting, deleting or granting sensitive access.',
      403,
    );
}
export async function uploadRecord(file: File, request: string, id: string, title: string) {
  if (process.env.HEALTH_INGESTION_ENABLED !== 'true')
    throw new IntelligenceError('Private ingestion is awaiting release acceptance.', 403);
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw new IntelligenceError('Choose a file smaller than 8 MB.', 413);
  const { client } = await healthSession();
  const permitted = await readHealth();
  if (
    !permitted.ingestionEnabled ||
    !permitted.consents.some((c) => c.purpose === 'records' && c.granted)
  )
    throw new IntelligenceError('Allow private record storage before processing.', 403);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mime = originalMime(bytes);
  const format = file.name.toLowerCase().endsWith('.csv')
    ? 'csv'
    : file.name.toLowerCase().endsWith('.json')
      ? 'json'
      : null;
  let candidates: ReturnType<typeof parseLabImport> = [],
    status = 'unsupported';
  if (format) {
    mime = format === 'csv' ? 'text/csv' : 'application/json';
    try {
      candidates = parseLabImport(new TextDecoder('utf-8', { fatal: true }).decode(bytes), format);
      status = 'review_required';
    } catch {
      candidates = [];
      status = 'unsupported';
    }
  } else if (mime === 'application/pdf') {
    // Known form-based exchange layout only. No clinical inference or arbitrary OCR.
    const { extractExchangePdf } = await import('./pdf');
    const text = await extractExchangePdf(bytes);
    if (text !== null) {
      try {
        candidates = parseLabImport(text, 'json');
        status = 'review_required';
      } catch {
        candidates = [];
        status = 'unsupported';
      }
    }
  }
  candidates = candidates.map((o, i) => {
    const hex = createHash('sha256').update(`${id}:${i}`).digest('hex');
    return {
      ...o,
      id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
    };
  });
  if (!mime) throw new IntelligenceError('Choose a PDF, JPEG, PNG, lab CSV or lab JSON file.', 415);
  const record = (await healthRpc('reserve', request, {
    id,
    title,
    mime,
    size: file.size,
  })) as HealthRecord;
  const uploaded = await client.storage
    .from('aethelios-health')
    .upload(record.path, bytes, { contentType: mime, upsert: false });
  if (uploaded.error && uploaded.error.message !== 'The resource already exists')
    throw new IntelligenceError(
      'Upload was interrupted. Retry this same file or remove the pending record.',
      503,
    );
  // Re-read the persisted original: never finalize from an assumed successful upload.
  const original = await client.storage.from('aethelios-health').download(record.path);
  if (original.error || !original.data)
    throw new IntelligenceError('Original could not be verified. Retry the same upload.', 503);
  const saved = new Uint8Array(await original.data.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== createHash('sha256').update(saved).digest('hex'))
    throw new IntelligenceError(
      'The saved file differs from this request. Remove the pending record.',
      409,
    );
  return healthRpc('finalize', id, { id, expected: record.version, hash, status, candidates });
}
export async function downloadOriginal(id: string) {
  const data = await readHealth();
  const record = data.records.find(
    (r) => r.id === id && r.status !== 'deleting' && r.status !== 'reserved',
  );
  if (!record) throw new IntelligenceError('Private record not found.', 404);
  const { client } = await healthSession();
  const file = await client.storage.from('aethelios-health').download(record.path);
  if (file.error || !file.data) throw new IntelligenceError('Original could not be loaded.', 503);
  return { record, file: file.data };
}
export async function resumeDeletion(id: string) {
  const { client } = await healthSession();
  const current = await readHealth();
  if (current.jobs.some((j) => j.id === id && j.kind === 'delete' && j.status === 'complete'))
    return {};
  const claim = (await healthRpc('claim', crypto.randomUUID(), { id })) as {
    lease: string;
    kind: string;
    record_id: string | null;
  };
  if (claim.kind !== 'delete') throw new IntelligenceError('Use Export to resume this job.', 409);
  const data = await readHealth();
  const paths = data.records
    .filter((r) => r.status === 'deleting' && (!claim.record_id || r.id === claim.record_id))
    .map((r) => r.path);
  if (paths.length) {
    const deleted = await client.storage.from('aethelios-health').remove(paths);
    if (deleted.error)
      throw new IntelligenceError('Deletion is pending. Resume it after reconnecting.', 503);
  }
  return healthRpc('finish_job', crypto.randomUUID(), { id, lease: claim.lease });
}
export async function exportHealth(request: string) {
  await requireRecentAuth();
  const data = await readHealth(),
    { client } = await healthSession();
  if (data.mode !== 'personal') throw new IntelligenceError('Health records are unavailable.', 503);
  await healthRpc('export', request, {});
  const claim = (await healthRpc('claim', crypto.randomUUID(), { id: request })) as {
    lease: string;
  };
  const audit = await client.rpc('health_export_history', {});
  if (audit.error) throw new IntelligenceError('Export history is unavailable.', 503);
  const metadata = {
    format: 'aethelios-health-export-v1',
    exportedAt: new Date().toISOString(),
    records: data.records,
    observations: data.observations,
    consents: data.consents,
    conversations: data.turns,
    wellness: data.wellness,
    workspaces: data.workspaces,
    history: audit.data,
  };
  return (async function* streamExport() {
    yield JSON.stringify(metadata).slice(0, -1) + ',"originals":[';
    let first = true,
      renewed = Date.now();
    for (const record of data.records.filter((r) => r.status !== 'deleting')) {
      if (Date.now() - renewed > 45000) {
        await healthRpc('renew_job', crypto.randomUUID(), { id: request, lease: claim.lease });
        renewed = Date.now();
      }
      const file = await client.storage.from('aethelios-health').download(record.path);
      if (file.error || !file.data)
        throw new IntelligenceError('Export remains pending: an original is unavailable.', 503);
      const original = {
        recordId: record.id,
        title: record.title,
        mime: record.mime,
        base64: Buffer.from(await file.data.arrayBuffer()).toString('base64'),
      };
      const serialized = (first ? '' : ',') + JSON.stringify(original);
      first = false;
      for (let offset = 0; offset < serialized.length; offset += 65536)
        yield serialized.slice(offset, offset + 65536);
    }
    await healthRpc('finish_job', crypto.randomUUID(), { id: request, lease: claim.lease });
    yield ']}';
  })();
}
export async function mutateHealth(input: Mutation) {
  if (
    (input.kind === 'confirm' ||
      input.kind === 'amend' ||
      (input.kind === 'consent' && input.granted && input.purpose === 'records')) &&
    process.env.HEALTH_INGESTION_ENABLED !== 'true'
  )
    throw new IntelligenceError('Private ingestion is awaiting release acceptance.', 403);
  if (
    input.kind === 'consent' &&
    input.granted &&
    input.purpose === 'ai' &&
    process.env.HEALTH_AI_ENABLED !== 'true'
  )
    throw new IntelligenceError('Health AI is awaiting provider privacy acceptance.', 403);
  if (input.kind === 'consent') {
    if (input.granted && input.purpose !== 'wellness') await requireRecentAuth();
    await healthRpc('consent', input.request, {
      purpose: input.purpose,
      granted: input.granted,
      adult: input.adult,
    });
  } else if (input.kind === 'delete') {
    await requireRecentAuth();
    await healthRpc('delete', input.request, { id: input.id });
    await resumeDeletion(input.request);
  } else if (input.kind === 'resume') {
    await requireRecentAuth();
    await resumeDeletion(input.id);
  } else if (input.kind === 'confirm')
    await healthRpc('confirm', input.request, {
      id: input.id,
      expected: input.expected,
      observations: input.observations,
    });
  else if (input.kind === 'amend') {
    observationSchema.parse(input.observation);
    await healthRpc('amend', input.request, {
      id: input.id,
      expected: input.expected,
      observation: input.observation,
      reason: input.reason,
      excluded: input.excluded,
    });
  } else if (input.kind === 'ask') {
    const { askHealth } = await import('./conversation');
    await askHealth(input);
  } else if (input.kind === 'workspace_architect') {
    await compileHealthArchitect(input);
  } else if (
    input.kind === 'workspace_save' ||
    input.kind === 'workspace_copy' ||
    input.kind === 'workspace_restore' ||
    input.kind === 'workspace_bridge'
  ) {
    await healthRpc(input.kind, input.request, workspacePayload(input));
  }
  return readHealth();
}

function storedArchitect(value: unknown) {
  const parsed = architectAttemptSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    verified: false,
    status: parsed.data.status === 'accepted' ? ('failed' as const) : parsed.data.status,
  };
}

function workspacePayload(input: Extract<Mutation, { kind: `workspace_${string}` }>) {
  if (input.kind === 'workspace_save') {
    return {
      id: input.id,
      expected: input.expected,
      foundation: input.foundation,
      title: input.title,
      sample: input.sample,
      settings: input.settings,
      progress: input.progress,
      architect: storedArchitect(input.architect),
      open: input.open ?? false,
    };
  }
  if (input.kind === 'workspace_copy') {
    return {
      id: input.id,
      sourceId: input.sourceId,
      title: input.title,
      includeDraft: input.includeDraft,
      settings: input.includeDraft ? input.settings : undefined,
      progress: input.includeDraft ? input.progress : undefined,
      architect: input.includeDraft ? storedArchitect(input.architect) : undefined,
    };
  }
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== 'kind' && key !== 'request'),
  );
}

async function compileHealthArchitect(input: Extract<Mutation, { kind: 'workspace_architect' }>) {
  const snapshot = await readHealth();
  const workspace = snapshot.workspaces.find((row) => row.id === input.id);
  if (!workspace) throw new IntelligenceError('Health workspace not found.', 404);
  if (workspace.version !== input.expected)
    throw new IntelligenceError('This record or request changed. Reload before continuing.', 409);
  if (input.action === 'compile') {
    const attempt = await requestArchitectRevision({
      workspaceId: workspace.id,
      workingRevision: workspace.workingRevision,
      instruction: input.instruction || '',
      presentation: workspace.settings.presentation,
      runtime: null,
    });
    await healthRpc('workspace_architect', input.request, {
      id: input.id,
      expected: input.expected,
      action: 'compile',
      architect: { ...attempt, verified: false },
    });
    return;
  }
  if (input.action === 'accept') {
    const parsed = architectAttemptSchema.safeParse(workspace.architect);
    if (!parsed.success || parsed.data.status !== 'ready')
      throw new IntelligenceError('There is no verified customization to accept.', 409);
    const accepted = acceptArchitectAttempt(parsed.data);
    if (!accepted.verified)
      throw new IntelligenceError('There is no verified customization to accept.', 409);
    await healthRpc('workspace_architect', input.request, {
      id: input.id,
      expected: input.expected,
      action: 'accept',
      architect: accepted,
    });
    return;
  }
  await healthRpc('workspace_architect', input.request, {
    id: input.id,
    expected: input.expected,
    action: 'reopen',
  });
}

export async function readHealthBridge(token: string) {
  const { client, person } = await healthSession();
  const result = await (
    client as unknown as {
      rpc: (
        fn: string,
        args: { p_token: string },
      ) => Promise<{ error: { message: string } | null; data: unknown }>;
    }
  ).rpc('health_bridge_read', { p_token: token });
  if (result.error || !result.data) throw new IntelligenceError('Health bridge unavailable.', 403);
  const session = result.data as {
    owner: string;
    workspaceId: string;
    revision: number;
    sample: boolean;
    fields: string[];
    hostControlled: boolean;
  };
  if (session.owner !== person.id) throw new IntelligenceError('Health bridge unavailable.', 403);
  const snapshot = await readHealth();
  const workspace = snapshot.workspaces.find((row) => row.id === session.workspaceId);
  if (!workspace || workspace.version !== session.revision)
    throw new IntelligenceError('Health bridge unavailable.', 403);
  const allowed = new Set(
    session.fields.length
      ? session.fields
      : ['name', 'value', 'unit', 'date', 'range', 'specimen', 'method', 'flag'],
  );
  const source = session.sample
    ? sampleBloodwork
    : snapshot.observations.filter((row) => row.status === 'active');
  const rows = projectBridgeObservations(source, workspace.settings.bloodwork, allowed);
  return {
    sample: session.sample,
    workspaceId: workspace.id,
    revision: session.revision,
    hostControlled: true,
    notice: session.sample
      ? sampleProjection().notice
      : 'Host-controlled reviewed observations. Generated tools cannot replace these values.',
    observations: rows,
  };
}
export type HealthEvidence = SavedObservation;

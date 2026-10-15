import 'server-only';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { initialProject } from '@/domains/architect-origin/schema';
import { originReady } from '@/domains/architect-origin/service';
import { memoryAppStoreAllowed } from '@/domains/architect-apps/readiness';
import {
  DESIGN_DIRECTION_SCHEMA,
  TEXT_HANDOFF_SCHEMA,
  receiveDesignDirectionCommand,
  type DesignDirectionReceipt,
} from './contract';
import { resolveAuthorizedTalkSource, talkSourceAdapterStatus } from './talk-source';
import {
  DesignDirectionStoreError,
  MemoryDesignDirectionStore,
  type DesignDirectionStore,
  type RetainedDirection,
} from './store';

let memory: MemoryDesignDirectionStore | null = null;

export function designDirectionStore(): DesignDirectionStore {
  if (memoryAppStoreAllowed() || process.env.ARCHITECT_APPS_STORE === 'memory') {
    memory ??= new MemoryDesignDirectionStore();
    return memory;
  }
  throw new DesignDirectionStoreError(
    'Durable design-direction retention requires the additive Apps migration. Memory retention is labelled test-only.',
  );
}

function requireSessionReady() {
  if (process.env.ARCHITECT_ORIGIN_ENABLED !== 'true' && process.env.ARCHITECT_APPS_STORE !== 'memory')
    throw new IntelligenceError(
      'Architect cannot retain a Talk design direction until Origin persistence is enabled.',
      503,
    );
}

async function bindOriginProject(
  personId: string,
  projectId: string,
  requestId: string,
  receipt: DesignDirectionReceipt,
  client: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
          };
        };
      };
    };
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: number | null; error: { message: string } | null }>;
  },
) {
  if (!originReady()) return;
  const owned = await client
    .from('architect_origin_projects')
    .select('id')
    .eq('person_id', personId)
    .eq('id', projectId)
    .maybeSingle();
  if (owned.error) throw new IntelligenceError('Project unavailable.', 503);
  if (owned.data) return;
  const content = initialProject(receipt.content.summary, 'application');
  content.name = receipt.content.name.slice(0, 100);
  content.description = receipt.content.summary.slice(0, 2000);
  content.blueprint.vision = receipt.content.summary.slice(0, 3000);
  content.blueprint.next =
    'Design direction retained. App generation stays unstarted until an explicit Architect approval.';
  const saved = await client.rpc('architect_origin_save', {
    p_project: projectId,
    p_request: requestId,
    p_expected: 0,
    p_content: content,
    p_note: `Retained ${TEXT_HANDOFF_SCHEMA} compatible design direction. Execution was not started.`,
  });
  if (saved.error || saved.data == null)
    throw new IntelligenceError(
      'Design direction was not bound to a private Origin project. Retry uses the same request.',
      409,
    );
}

async function retainDurably(
  client: {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: RetainedDirection | null; error: { message: string } | null }>;
          };
        };
      };
    };
  },
  input: {
    requestId: string;
    personId: string;
    projectId: string;
    digest: string;
    receipt: DesignDirectionReceipt;
    sourceKind: RetainedDirection['source_kind'];
    verified: boolean;
  },
): Promise<RetainedDirection> {
  const saved = await client.rpc('architect_apps_retain_design', {
    p_request: input.requestId,
    p_project: input.projectId,
    p_digest: input.digest,
    p_receipt: input.receipt,
    p_source_kind: input.sourceKind,
    p_verified: input.verified,
  });
  if (saved.error) throw new DesignDirectionStoreError(saved.error.message);
  const stored = await client
    .from('architect_design_directions')
    .select('*')
    .eq('request_id', input.requestId)
    .eq('person_id', input.personId)
    .maybeSingle();
  if (stored.error || !stored.data) throw new DesignDirectionStoreError('Design direction was not retained.');
  return {
    ...stored.data,
    verified: Boolean(stored.data.verified),
    source_kind: stored.data.source_kind,
    receipt: stored.data.receipt ?? input.receipt,
  };
}

export async function receiveDesignDirection(input: unknown): Promise<RetainedDirection> {
  const parsed = receiveDesignDirectionCommand.safeParse(input);
  if (!parsed.success)
    throw new IntelligenceError('Check the design-direction identity, copy bounds and receipt fields.', 400);
  requireSessionReady();
  const { person, client } = await intelligenceSession();
  const authorized = await resolveAuthorizedTalkSource({
    personId: person.id,
    receipt: parsed.data.receipt,
  });
  try {
    await bindOriginProject(
      person.id,
      parsed.data.projectId,
      parsed.data.requestId,
      authorized.receipt,
      client as never,
    );
    const payload = {
      requestId: parsed.data.requestId,
      personId: person.id,
      projectId: parsed.data.projectId,
      digest: authorized.digest,
      receipt: authorized.receipt,
      sourceKind: authorized.kind,
      verified: authorized.kind === 'talk-authorized' || authorized.kind === 'text-import',
    };
    if (memoryAppStoreAllowed() || process.env.ARCHITECT_APPS_STORE === 'memory') {
      return await designDirectionStore().retain(payload);
    }
    return await retainDurably(client as never, payload);
  } catch (error) {
    if (error instanceof IntelligenceError) throw error;
    if (error instanceof DesignDirectionStoreError)
      throw new IntelligenceError(error.message, error.code === 'not_found' ? 404 : 409);
    throw new IntelligenceError('Design direction could not be retained.', 503);
  }
}

export async function readRetainedDirection(projectId: string) {
  const { person, client } = await intelligenceSession();
  requireSessionReady();
  if (memoryAppStoreAllowed() || process.env.ARCHITECT_APPS_STORE === 'memory') {
    return designDirectionStore().readProject(person.id, projectId);
  }
  const query = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    };
  };
  const { data, error } = await query
    .from('architect_design_directions')
    .select('*')
    .eq('project_id', projectId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (error) throw new IntelligenceError('Design direction unavailable.', 503);
  return (data as RetainedDirection | null) ?? null;
}

export { talkSourceAdapterStatus, DESIGN_DIRECTION_SCHEMA };

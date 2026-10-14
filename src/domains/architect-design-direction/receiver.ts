import 'server-only';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { initialProject } from '@/domains/architect-origin/schema';
import { originReady } from '@/domains/architect-origin/service';
import {
  DESIGN_DIRECTION_SCHEMA,
  TEXT_HANDOFF_SCHEMA,
  designDirectionDigest,
  receiveDesignDirectionCommand,
  type DesignDirectionReceipt,
} from './contract';
import {
  DesignDirectionStoreError,
  MemoryDesignDirectionStore,
  type DesignDirectionStore,
  type RetainedDirection,
} from './store';

let memory: MemoryDesignDirectionStore | null = null;

export function designDirectionStore(): DesignDirectionStore {
  memory ??= new MemoryDesignDirectionStore();
  return memory;
}

function requireSessionReady() {
  if (process.env.ARCHITECT_ORIGIN_ENABLED !== 'true' && process.env.ARCHITECT_APPS_STORE !== 'memory')
    throw new IntelligenceError(
      'Architect cannot retain a Talk design direction until Origin persistence is enabled.',
      503,
    );
}

export function authorizeDesignDirectionDigest(receipt: DesignDirectionReceipt) {
  const digest = designDirectionDigest(receipt.content, receipt.sourceRecords);
  if (digest !== receipt.digest)
    throw new IntelligenceError(
      'Design-direction digest does not match server-authorized records. A client-supplied hash is not authority.',
      409,
    );
  if (receipt.content.schema !== DESIGN_DIRECTION_SCHEMA)
    throw new IntelligenceError('Incompatible or unknown design-direction schema.', 400);
  if (
    receipt.identity.conversationId !== receipt.content.identity.conversationId ||
    receipt.identity.boardId !== receipt.content.identity.boardId ||
    receipt.identity.directionId !== receipt.content.identity.directionId ||
    receipt.identity.boardVersion !== receipt.content.identity.boardVersion
  )
    throw new IntelligenceError('Foreign conversation or board identity.', 409);
  return digest;
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

export async function receiveDesignDirection(input: unknown): Promise<RetainedDirection> {
  const parsed = receiveDesignDirectionCommand.safeParse(input);
  if (!parsed.success)
    throw new IntelligenceError('Check the design-direction identity, copy bounds and receipt fields.', 400);
  requireSessionReady();
  const { person, client } = await intelligenceSession();
  const digest = authorizeDesignDirectionDigest(parsed.data.receipt);
  try {
    await bindOriginProject(
      person.id,
      parsed.data.projectId,
      parsed.data.requestId,
      parsed.data.receipt,
      client as never,
    );
    return await designDirectionStore().retain({
      requestId: parsed.data.requestId,
      personId: person.id,
      projectId: parsed.data.projectId,
      digest,
      receipt: parsed.data.receipt,
    });
  } catch (error) {
    if (error instanceof IntelligenceError) throw error;
    if (error instanceof DesignDirectionStoreError)
      throw new IntelligenceError(error.message, error.code === 'not_found' ? 404 : 409);
    throw new IntelligenceError('Design direction could not be retained.', 503);
  }
}

export async function readRetainedDirection(projectId: string) {
  const { person } = await intelligenceSession();
  requireSessionReady();
  return designDirectionStore().readProject(person.id, projectId);
}

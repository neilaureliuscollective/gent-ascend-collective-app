import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-000000000001',
  project: '00000000-0000-4000-8000-000000000111',
  row: null as unknown,
  writes: vi.fn(),
}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => {
    type Query = {
      select: () => Query;
      eq: () => Query;
      maybeSingle: () => Promise<{ data: unknown; error: null }>;
    };
    const query: Query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: state.row, error: null }),
    };
    return { person: { id: state.owner }, client: { from: () => query, rpc: state.writes } };
  },
}));
import {
  designDirectionDigest,
  designDirectionReceiptSchema,
  mapTextHandoffToDirection,
  TEXT_HANDOFF_SCHEMA,
} from '@/domains/architect-design-direction/contract';
import {
  createTalkAuthorizedSourceAdapter,
  registerTalkSourceAdapter,
  resolveAuthorizedTalkSource,
} from '@/domains/architect-design-direction/talk-source';
import {
  designDirectionStore,
  receiveDesignDirection,
  readRetainedDirection,
} from '@/domains/architect-design-direction/receiver';
import type {
  MemoryDesignDirectionStore,
  RetainedDirection,
} from '@/domains/architect-design-direction/store';
import { produceArchitectDirection } from '@/domains/talk-creation/architect-direction';
import { lifestyleLaunchBoard } from '@/domains/talk-creation/design-board';
import {
  supportedDirectionForGeneration,
  buildAppGenerationContext,
} from '@/domains/architect-apps/context';
import { generateAppProposal } from '@/domains/architect-apps/generation';
import { POST, GET } from '@/app/api/architect-design-direction/route';

function forgedReceipt() {
  const receipt = produceArchitectDirection({
    conversationId: '30000000-0000-4000-8000-000000000031',
    boardId: '50000000-0000-4000-8000-000000000031',
    version: 2,
    board: lifestyleLaunchBoard(),
  });
  receipt.content.compatibleTextImport = TEXT_HANDOFF_SCHEMA;
  receipt.digest = designDirectionDigest(receipt.content, receipt.sourceRecords);
  return receipt;
}
function command() {
  return {
    action: 'receive',
    requestId: '00000000-0000-4000-8000-000000000301',
    projectId: state.project,
    receipt: forgedReceipt(),
  };
}
function staleRow(
  verified = false,
  sourceKind: RetainedDirection['source_kind'] = 'text-import',
): RetainedDirection {
  const receipt = forgedReceipt();
  return {
    request_id: command().requestId,
    person_id: state.owner,
    project_id: state.project,
    revision: 1,
    digest: receipt.digest,
    receipt,
    verified,
    source_kind: sourceKind,
    started: false,
    created_at: '2026-10-16',
  };
}
beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  vi.stubEnv('APP_ENV', 'local');
  state.row = { id: state.project };
  state.writes.mockReset();
  (designDirectionStore() as MemoryDesignDirectionStore).rows.clear();
});
it('rejects the mixed receipt schema even when the client digest matches', () => {
  expect(designDirectionReceiptSchema.safeParse(forgedReceipt()).success).toBe(false);
});
it('rejects mixed receipts at direct source resolution before the Talk adapter', async () => {
  await expect(
    resolveAuthorizedTalkSource({ personId: state.owner, receipt: forgedReceipt() }),
  ).rejects.toThrow(/text imports cannot carry/i);
  expect(state.writes).not.toHaveBeenCalled();
});
it('rejects mixed receipts at direct domain receive before any retention or project binding', async () => {
  await expect(receiveDesignDirection(command())).rejects.toThrow();
  expect((designDirectionStore() as MemoryDesignDirectionStore).rows.size).toBe(0);
  expect(state.writes).not.toHaveBeenCalled();
});
it('rejects the forged combination through the actual POST route before binding or retention', async () => {
  const response = await POST(
    new Request('http://localhost/api/architect-design-direction', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        host: 'localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify(command()),
    }),
  );
  expect(response.status).toBe(400);
  expect((designDirectionStore() as MemoryDesignDirectionStore).rows.size).toBe(0);
  expect(state.writes).not.toHaveBeenCalled();
});
it.each([
  [false, 'text-import'],
  [false, 'talk-authorized'],
  [true, 'text-import'],
  [true, 'talk-authorized'],
] as const)(
  'blocks contaminated stored premium receipts at read/API consumption (%s, %s)',
  async (verified, kind) => {
    const row = staleRow(verified, kind);
    (designDirectionStore() as MemoryDesignDirectionStore).rows.set(row.request_id, row);
    await expect(readRetainedDirection(state.project)).rejects.toThrow(/not verified/);
    const response = await GET(
      new Request(`http://localhost/api/architect-design-direction?project=${state.project}`),
    );
    expect(response.status).toBe(409);
  },
);
it.each([
  [false, 'text-import'],
  [false, 'talk-authorized'],
  [true, 'text-import'],
  [true, 'talk-authorized'],
] as const)(
  'blocks contaminated snapshot generation, including direct context entry (%s, %s)',
  (verified, sourceKind) => {
    const content = forgedReceipt().content;
    const direction = { ...content, verified, sourceKind };
    expect(() => supportedDirectionForGeneration(direction)).toThrow(/not verified/);
    expect(() =>
      buildAppGenerationContext({
        instruction: 'Use this design',
        kind: 'create',
        files: [],
        direction,
      }),
    ).toThrow(/not verified/);
  },
);
it('preserves ordinary unverified compatible text import without elevating it to premium authority', async () => {
  const receipt = forgedReceipt();
  receipt.content = mapTextHandoffToDirection({
    identity: receipt.identity,
    name: 'Ordinary text',
    summary: 'Reviewed text brief.',
    title: 'Text brief',
  });
  receipt.digest = designDirectionDigest(receipt.content, receipt.sourceRecords);
  state.row = { id: state.project };
  const retained = await receiveDesignDirection({ ...command(), receipt });
  expect(retained.verified).toBe(false);
  expect(retained.source_kind).toBe('text-import');
  expect(retained.receipt.content.designSnapshot).toBeUndefined();
  expect(await readRetainedDirection(state.project)).toEqual(retained);
  expect(
    supportedDirectionForGeneration({
      ...receipt.content,
      verified: false,
      sourceKind: 'text-import',
    })?.designSnapshot,
  ).toBeUndefined();
});

it.each([
  [false, 'text-import'],
  [false, 'talk-authorized'],
  [true, 'text-import'],
] as const)(
  'also rejects an unverified snapshot without the text compatibility flag (%s, %s)',
  async (verified, sourceKind) => {
    const receipt = forgedReceipt();
    delete receipt.content.compatibleTextImport;
    receipt.digest = designDirectionDigest(receipt.content, receipt.sourceRecords);
    const row = { ...staleRow(verified, sourceKind), receipt, digest: receipt.digest };
    (designDirectionStore() as MemoryDesignDirectionStore).rows.set(row.request_id, row);
    await expect(readRetainedDirection(state.project)).rejects.toThrow(/not verified/);
    const direction = { ...receipt.content, verified, sourceKind };
    expect(() => supportedDirectionForGeneration(direction)).toThrow(/not verified/);
    const transport = vi.fn();
    await expect(
      generateAppProposal(
        { instruction: 'Use this design', kind: 'create', demo: 'none', baseFiles: [], direction },
        transport,
        { ARCHITECT_APPS_FIXTURE: 'true' },
      ),
    ).rejects.toThrow(/not verified/);
    expect(transport).not.toHaveBeenCalled();
  },
);

it('rejects an unverified adapter result and a direct memory-store write before persistence', async () => {
  const receipt = forgedReceipt();
  delete receipt.content.compatibleTextImport;
  receipt.digest = designDirectionDigest(receipt.content, receipt.sourceRecords);
  registerTalkSourceAdapter(
    createTalkAuthorizedSourceAdapter(async () => ({
      kind: 'text-import',
      receipt,
      digest: receipt.digest,
      note: 'Not verified',
    })),
  );
  try {
    await expect(resolveAuthorizedTalkSource({ personId: state.owner, receipt })).rejects.toThrow(
      /authorized Talk source/,
    );
    await expect(receiveDesignDirection({ ...command(), receipt })).rejects.toThrow(
      /authorized Talk source/,
    );
  } finally {
    registerTalkSourceAdapter(null);
  }
  await expect(
    designDirectionStore().retain({
      requestId: command().requestId,
      personId: state.owner,
      projectId: state.project,
      receipt,
      digest: receipt.digest,
      sourceKind: 'text-import',
      verified: false,
    }),
  ).rejects.toThrow(/not verified/);
  expect((designDirectionStore() as MemoryDesignDirectionStore).rows.size).toBe(0);
  expect(state.writes).not.toHaveBeenCalled();
});

import { z } from 'zod';
import { createHash } from 'node:crypto';

/** Talk conversational text import this contract extends. Talk owns the producer UI. */
export const TEXT_HANDOFF_SCHEMA = 'talk-architect-handoff/v1';
/** Architect-owned receiving contract. Talk must not treat a client hash as authority. */
export const DESIGN_DIRECTION_SCHEMA = 'talk-architect-direction/v1';

export const designColorRole = z.enum([
  'canvas',
  'ink',
  'muted',
  'accent',
  'reserve',
  'emerald',
  'danger',
]);

export const designLayoutToken = z.enum([
  'stack',
  'split',
  'board',
  'form',
  'gallery',
  'table',
]);

export const designTypeToken = z.enum(['display', 'body', 'label', 'numeric']);

export const designAssetRefSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(['image', 'icon', 'font']),
    href: z.string().max(2048).optional(),
    provenance: z.enum(['owner', 'talk', 'system']),
    note: z.string().max(400).optional(),
  })
  .strict();

export const designDirectionIdentitySchema = z
  .object({
    conversationId: z.uuid(),
    boardId: z.uuid(),
    boardVersion: z.number().int().positive().max(500),
    directionId: z.uuid(),
  })
  .strict();

export const designDirectionContentSchema = z
  .object({
    schema: z.literal(DESIGN_DIRECTION_SCHEMA),
    identity: designDirectionIdentitySchema,
    name: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(2000),
    colors: z
      .array(
        z
          .object({
            role: designColorRole,
            value: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          })
          .strict(),
      )
      .max(12),
    typography: z.array(designTypeToken).min(1).max(4),
    layout: z.array(designLayoutToken).min(1).max(6),
    demo: z
      .object({
        kind: z.enum(['tracker', 'none']),
        labelled: z.boolean(),
        note: z.string().max(400),
      })
      .strict(),
    copy: z
      .object({
        title: z.string().trim().min(1).max(120),
        approved: z.array(z.string().trim().min(1).max(400)).max(16),
      })
      .strict(),
    assets: z.array(designAssetRefSchema).max(16),
    compatibleTextImport: z.literal(TEXT_HANDOFF_SCHEMA).optional(),
  })
  .strict();

export type DesignDirectionContent = z.infer<typeof designDirectionContentSchema>;

export const designDirectionReceiptSchema = z
  .object({
    schema: z.literal(DESIGN_DIRECTION_SCHEMA),
    identity: designDirectionIdentitySchema,
    content: designDirectionContentSchema,
    digest: z.string().regex(/^[0-9a-f]{64}$/),
    sourceRecords: z
      .array(
        z
          .object({
            kind: z.enum(['conversation', 'board', 'direction', 'handoff']),
            id: z.uuid(),
            revision: z.number().int().nonnegative().max(500).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

export type DesignDirectionReceipt = z.infer<typeof designDirectionReceiptSchema>;

export function designDirectionDigest(
  content: DesignDirectionContent,
  sourceRecords: DesignDirectionReceipt['sourceRecords'],
) {
  return createHash('sha256')
    .update(JSON.stringify({ content, sourceRecords }), 'utf8')
    .digest('hex');
}

export const receiveDesignDirectionCommand = z
  .object({
    action: z.literal('receive'),
    requestId: z.uuid(),
    projectId: z.uuid(),
    receipt: designDirectionReceiptSchema,
  })
  .strict();

export const architectDesignDirectionContract = {
  id: 'architect.design_direction.receive',
  version: '2026-10-14.1',
  schema: DESIGN_DIRECTION_SCHEMA,
  compatibleTextImport: TEXT_HANDOFF_SCHEMA,
  module: 'src/domains/architect-design-direction/contract.ts',
  receiver: 'src/domains/architect-design-direction/receiver.ts',
  path: '/api/architect-design-direction',
  method: 'POST',
  authorization:
    'Authenticated session cookie. Owner, project and digest authority come from server-owned records, never from a browser-supplied owner ID or a client-computed hash.',
  input: {
    action: 'receive',
    requestId: 'uuid used for exactly-one private project',
    projectId: 'uuid of the Origin project to create or reopen',
    receipt: 'validated talk-architect-direction/v1 receipt',
  },
  output: {
    projectId: 'string',
    requestId: 'string',
    revision: 'number',
    digest: 'server-recomputed sha256',
    started: false,
  },
  refusals: [
    'Unauthenticated session',
    'Digest does not match server-authorized records',
    'Foreign conversation or board identity',
    'Incompatible or unknown schema',
    'Replay with a different project or receipt',
  ],
  talk: 'Talk owns generating or selecting the design board and requesting transfer. Architect owns receiving and retaining it. Do not edit Talk producer UI from this module. Retry of the same requestId creates exactly one private project. Execution never starts on import.',
} as const;

export function mapTextHandoffToDirection(input: {
  identity: DesignDirectionContent['identity'];
  name: string;
  summary: string;
  title: string;
  approvedCopy?: string[];
}): DesignDirectionContent {
  return designDirectionContentSchema.parse({
    schema: DESIGN_DIRECTION_SCHEMA,
    identity: input.identity,
    name: input.name,
    summary: input.summary,
    colors: [
      { role: 'canvas', value: '#050706' },
      { role: 'ink', value: '#E8E4DC' },
      { role: 'reserve', value: '#C4912F' },
      { role: 'emerald', value: '#0B3B32' },
    ],
    typography: ['display', 'body', 'label'],
    layout: ['stack', 'form', 'board'],
    demo: {
      kind: 'none',
      labelled: true,
      note: 'Compatible talk-architect-handoff/v1 text import. Not a generated application.',
    },
    copy: {
      title: input.title,
      approved: input.approvedCopy?.length ? input.approvedCopy : [input.summary],
    },
    assets: [],
    compatibleTextImport: TEXT_HANDOFF_SCHEMA,
  });
}

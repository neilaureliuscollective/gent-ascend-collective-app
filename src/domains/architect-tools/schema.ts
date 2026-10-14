import { z } from 'zod';
import {
  ESTIMATOR_KIND,
  ESTIMATOR_LIMITS,
  estimatorCurrencies,
  type EstimatorConfig,
  type EstimatorResult,
} from './engine';

const decimalText = (field: string, maxScale: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is missing.`)
    .max(20)
    .refine((value) => /^-?\d+(\.\d+)?$/.test(value), `${field} must be a plain decimal.`)
    .refine((value) => (value.split('.')[1] ?? '').length <= maxScale, `${field} has too many decimal places.`);

export const estimatorItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(ESTIMATOR_LIMITS.maxName),
    quantity: decimalText('Quantity', ESTIMATOR_LIMITS.quantityScale),
    unit: z.string().trim().min(1).max(ESTIMATOR_LIMITS.maxUnit),
    unit_cost: decimalText('Unit cost', 4),
  })
  .strict();

export const estimatorConfigSchema = z
  .object({
    kind: z.literal(ESTIMATOR_KIND),
    currency: z.enum(estimatorCurrencies),
    rounding: z.literal('half-up-minor'),
    waste_percent: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Waste percent must be a plain non-negative decimal.')
      .nullable(),
    markup_percent: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Markup percent must be a plain non-negative decimal.')
      .nullable(),
    assumptions: z.string().max(ESTIMATOR_LIMITS.maxAssumptions),
    items: z.array(estimatorItemSchema).min(1).max(ESTIMATOR_LIMITS.maxItems),
  })
  .strict()
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).length <= ESTIMATOR_LIMITS.maxConfigBytes,
    'Estimator configuration exceeds the 32 KB bound.',
  )
  .refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length, 'Item IDs must be unique.');

export type SavedEstimatorTool = {
  id: string;
  person_id: string;
  project_id: string;
  kind: typeof ESTIMATOR_KIND;
  name: string;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type SavedEstimatorVersion = {
  id: string;
  tool_id: string;
  person_id: string;
  project_id: string;
  revision: number;
  name: string;
  configuration: EstimatorConfig;
  note: string;
  created_at: string;
};

export type SavedEstimatorInvocation = {
  id: string;
  tool_id: string;
  person_id: string;
  project_id: string;
  tool_revision: number;
  inputs: Record<string, unknown>;
  result: EstimatorResult;
  source: 'architect' | 'agent-fixture';
  created_at: string;
};

export const saveToolCommand = z
  .object({
    action: z.literal('save'),
    projectId: z.uuid(),
    toolId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().min(0).max(ESTIMATOR_LIMITS.maxRevisions - 1),
    name: z.string().trim().min(1).max(100),
    configuration: estimatorConfigSchema,
    note: z.string().trim().min(1).max(300),
  })
  .strict();

export const invokeToolCommand = z
  .object({
    action: z.literal('invoke'),
    projectId: z.uuid(),
    toolId: z.uuid(),
    revision: z.number().int().positive().max(ESTIMATOR_LIMITS.maxRevisions),
    requestId: z.uuid(),
    quantities: z.record(z.uuid(), decimalText('Override quantity', ESTIMATOR_LIMITS.quantityScale)).default({}),
    source: z.enum(['architect', 'agent-fixture']).default('architect'),
  })
  .strict();

export const readToolsQuery = z
  .object({
    projectId: z.uuid(),
    toolId: z.uuid().optional(),
  })
  .strict();

export const toolCommand = z.discriminatedUnion('action', [saveToolCommand, invokeToolCommand]);

export type SaveToolCommand = z.infer<typeof saveToolCommand>;
export type InvokeToolCommand = z.infer<typeof invokeToolCommand>;

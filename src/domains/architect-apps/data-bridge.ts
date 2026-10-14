import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import type { AppCollection } from './schema';
import { defaultAppLimits } from './schema';
import { APP_DATA_SCHEMA } from './preview';

export const appDataMessageSchema = z
  .object({
    schema: z.literal(APP_DATA_SCHEMA),
    session: z.string().min(16).max(200),
    requestId: z.uuid(),
    operation: z.enum(['list', 'get', 'create', 'update']),
    collection: z.string().trim().min(1).max(40),
    payload: z.record(z.string(), z.unknown()).optional(),
    idempotencyKey: z.string().min(1).max(80).optional(),
  })
  .strict();

export type AppDataMessage = z.infer<typeof appDataMessageSchema>;

const rates = new Map<string, { window: number; count: number }>();

export function assertDataRate(personId: string, now = Date.now()) {
  const current = rates.get(personId);
  if (!current || now - current.window > 60000) {
    rates.set(personId, { window: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > defaultAppLimits.data_rate_per_minute)
    throw new IntelligenceError('App data rate exceeded.', 429);
}

export function validateCollectionPayload(
  collection: AppCollection,
  payload: Record<string, unknown>,
  previous?: Record<string, unknown>,
) {
  const next: Record<string, unknown> = { ...(previous ?? {}) };
  for (const field of collection.fields) {
    const value = payload[field.name];
    if (value == null) {
      if (field.required && previous?.[field.name] == null)
        throw new IntelligenceError(`${field.name} is required.`, 400);
      continue;
    }
    if (field.type === 'string') {
      if (typeof value !== 'string' || value.length > (field.max ?? 400))
        throw new IntelligenceError(`${field.name} is not a valid string.`, 400);
      next[field.name] = value;
    } else if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new IntelligenceError(`${field.name} is not a valid number.`, 400);
      next[field.name] = value;
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') throw new IntelligenceError(`${field.name} is not a valid boolean.`, 400);
      next[field.name] = value;
    } else if (field.type === 'enum') {
      if (typeof value !== 'string' || !field.values?.includes(value))
        throw new IntelligenceError(`${field.name} is not an allowed value.`, 400);
      next[field.name] = value;
    }
  }
  const bytes = new TextEncoder().encode(JSON.stringify(next)).length;
  if (bytes > defaultAppLimits.max_record_bytes) throw new IntelligenceError('Record exceeds the 8 KB bound.', 413);
  return next;
}

export function assertAdditiveSchema(previous: AppCollection[], next: AppCollection[]) {
  const before = new Map(previous.map((collection) => [collection.name, collection]));
  for (const [name, collection] of before) {
    const updated = next.find((row) => row.name === name);
    if (!updated) throw new IntelligenceError(`Refusing destructive removal of collection ${name}.`, 409);
    for (const field of collection.fields) {
      const match = updated.fields.find((row) => row.name === field.name);
      if (!match) throw new IntelligenceError(`Refusing destructive removal of ${name}.${field.name}.`, 409);
      if (match.type !== field.type)
        throw new IntelligenceError(`Refusing destructive type change of ${name}.${field.name}.`, 409);
    }
  }
}

export function recordToItem(record: { id: string; payload: Record<string, unknown> }) {
  return {
    id: record.id,
    persisted: true,
    ...record.payload,
  };
}

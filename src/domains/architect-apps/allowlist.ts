import type { z } from 'zod';
import { APP_DATA_SCHEMA, appDataCommand } from './schema';

type DataCommand = z.infer<typeof appDataCommand>;

/** Allowlisted parent→API payload. Untrusted iframe fields never overwrite owner, project or revision. */
export function allowlistedAppDataPayload(
  message: unknown,
  trusted: { projectId: string; revisionId: string },
): DataCommand {
  const raw = message && typeof message === 'object' ? (message as Record<string, unknown>) : {};
  return appDataCommand.parse({
    action: 'data',
    schema: raw.schema === APP_DATA_SCHEMA ? APP_DATA_SCHEMA : raw.schema,
    projectId: trusted.projectId,
    revisionId: trusted.revisionId,
    session: raw.session,
    requestId: raw.requestId,
    operation: raw.operation,
    collection: raw.collection,
    payload: raw.payload,
    idempotencyKey: raw.idempotencyKey,
  });
}

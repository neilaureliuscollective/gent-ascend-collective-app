import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FootageJob } from '@/domains/studio/footage';
export function footageConfigured() {
  return (
    process.env.STUDIO_FOOTAGE_ENABLED === 'true' &&
    Boolean(process.env.RUNWAYML_API_SECRET) &&
    (process.env.STUDIO_FOOTAGE_SIGNING_KEY?.length ?? 0) >= 32
  );
}
function sign(value: unknown) {
  const key = process.env.STUDIO_FOOTAGE_SIGNING_KEY;
  if (!key || key.length < 32) throw new Error('Footage receipt signing is unavailable.');
  return createHmac('sha256', key).update(JSON.stringify(value)).digest('hex');
}
export function quoteSignature(
  job: Pick<
    FootageJob,
    | 'id'
    | 'person_id'
    | 'project_id'
    | 'title'
    | 'prompt'
    | 'duration'
    | 'ratio'
    | 'estimate'
    | 'policy'
    | 'expires_at'
  >,
) {
  return sign([
    'quote',
    job.id,
    job.person_id,
    job.project_id,
    job.title,
    job.prompt,
    job.duration,
    job.ratio,
    job.estimate,
    job.policy,
    Date.parse(job.expires_at),
  ]);
}
export function taskSignature(job: Pick<FootageJob, 'id' | 'person_id'>, providerId: string) {
  return sign(['task', job.id, job.person_id, providerId]);
}
export function validSignature(actual: string | null, expected: string) {
  return Boolean(
    actual &&
    /^[a-f0-9]{64}$/.test(actual) &&
    timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex')),
  );
}

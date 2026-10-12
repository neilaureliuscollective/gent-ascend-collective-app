import { z } from 'zod';

export const footageModel = 'gen4.5';
export const footagePolicy = 'runway-gen45-2026-10-12';
export const footageBrief = z
  .object({
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(80),
    prompt: z.string().trim().min(3).max(1000),
    duration: z.union([z.literal(5), z.literal(10)]),
    ratio: z.enum(['1280:720', '720:1280']),
  })
  .strict();
export type FootageBrief = z.infer<typeof footageBrief>;
export type FootageJob = {
  id: string;
  person_id: string;
  project_id: string;
  title: string;
  prompt: string;
  duration: 5 | 10;
  ratio: '1280:720' | '720:1280';
  estimate: number;
  policy: string;
  expires_at: string;
  quote_signature: string;
  provider_id: string | null;
  provider_signature: string | null;
  status: 'quoted' | 'submitting' | 'queued' | 'complete' | 'failed' | 'uncertain';
  created_at: string;
  storage_key: string | null;
  provider_credits: number | null;
};
export type FootageItem = Pick<
  FootageJob,
  | 'id'
  | 'title'
  | 'prompt'
  | 'duration'
  | 'ratio'
  | 'estimate'
  | 'expires_at'
  | 'status'
  | 'created_at'
  | 'provider_credits'
>;
export function footageItem(job: FootageJob): FootageItem {
  const {
    id,
    title,
    prompt,
    duration,
    ratio,
    estimate,
    expires_at,
    status,
    created_at,
    provider_credits,
  } = job;
  return {
    id,
    title,
    prompt,
    duration,
    ratio,
    estimate,
    expires_at,
    status,
    created_at,
    provider_credits,
  };
}
export function footageRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error('Invalid video range.');
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    start >= size
  )
    throw new Error('Invalid video range.');
  return { start, end };
}

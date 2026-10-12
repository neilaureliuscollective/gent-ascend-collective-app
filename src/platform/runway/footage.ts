import 'server-only';
import { isIP } from 'node:net';
import { z } from 'zod';
import type { FootageJob } from '@/domains/studio/footage';
import { footageModel } from '@/domains/studio/footage';
import { IntelligenceError } from '@/domains/intelligence/service';
const host = 'https://api.dev.runwayml.com';
const credits = z.object({ credits: z.number().nonnegative().finite() });
const receipt = z.object({ id: z.uuid(), estimatedCost: credits.optional() });
const task = z.object({
  id: z.uuid(),
  status: z.enum(['PENDING', 'THROTTLED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
  output: z.array(z.string().max(8192)).max(4).optional(),
  cost: credits.optional(),
  estimatedCost: credits.optional(),
});
async function bounded(response: Response, limit: number) {
  if (!response.body) throw new IntelligenceError('No footage response was returned.', 502);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit)
        throw new IntelligenceError('Footage response exceeded the supported limit.', 502);
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  return Buffer.concat(parts);
}
async function api(path: string, body?: unknown) {
  const key = process.env.RUNWAYML_API_SECRET;
  if (!key) throw new IntelligenceError('AI footage is not connected.', 503);
  const response = await fetch(`${host}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'X-Runway-Version': '2024-11-06',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok)
    throw new IntelligenceError(
      'The footage provider could not confirm this request. Do not submit it again.',
      503,
    );
  try {
    return JSON.parse((await bounded(response, 64000)).toString());
  } catch {
    throw new IntelligenceError('The footage provider receipt could not be verified.', 502);
  }
}
// One POST only. A timeout is an uncertain paid submission, never permission to retry.
export async function submitFootage(job: FootageJob) {
  return receipt.parse(
    await api('/v1/text_to_video', {
      model: footageModel,
      promptText: job.prompt,
      duration: job.duration,
      ratio: job.ratio,
    }),
  );
}
export async function inspectFootage(id: string) {
  z.uuid().parse(id);
  const result = task.parse(await api(`/v1/tasks/${id}`));
  if (result.id !== id) throw new IntelligenceError('Footage receipt identity did not match.', 502);
  return result;
}
export function footageOutputUrl(value: string) {
  const url = new URL(value);
  const hosts = [
    'dnznrvs05pmza.cloudfront.net',
    ...(process.env.STUDIO_FOOTAGE_OUTPUT_HOSTS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    isIP(url.hostname.replace(/^\[|\]$/g, '')) ||
    !url.hostname.includes('.') ||
    !hosts.includes(url.hostname) ||
    url.hash
  )
    throw new IntelligenceError('The footage output host has not been approved.', 502);
  return url;
}
export async function downloadFootage(value: string) {
  const response = await fetch(footageOutputUrl(value), {
    signal: AbortSignal.timeout(60000),
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok)
    throw new IntelligenceError(
      'The completed clip could not be copied. Check its status again.',
      503,
    );
  return bounded(response, 30_000_000);
}

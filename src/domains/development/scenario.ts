import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export const founderAuthId = '00000000-0000-4000-8000-000000000001';
export const founderEmail = 'founder@aurelius.test';
export const scenarioSchema = z.object({
  membership: z.enum(['founder', 'free', 'aurelius', 'health', 'beta', 'admin']),
  billing: z.enum(['none', 'trialing', 'active', 'past_due', 'canceled']),
  onboarded: z.boolean(),
});
export type Scenario = z.infer<typeof scenarioSchema>;
export const defaultScenario: Scenario = {
  membership: 'founder',
  billing: 'active',
  onboarded: true,
};
export function tokenMatches(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function signScenario(scenario: Scenario, key: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      scenario: scenarioSchema.parse(scenario),
      sub: founderAuthId,
      exp: now + 8 * 60 * 60 * 1000,
    }),
  ).toString('base64url');
  return payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
}
export function readScenario(
  value: string | undefined,
  key: string,
  now = Date.now(),
): Scenario | null {
  if (!value || value.length > 2000) return null;
  const [payload, signature, ...extra] = value.split('.');
  if (!payload || !signature || extra.length) return null;
  if (!tokenMatches(signature, createHmac('sha256', key).update(payload).digest('base64url')))
    return null;
  try {
    const parsed = z
      .object({ sub: z.literal(founderAuthId), exp: z.number().gt(now), scenario: scenarioSchema })
      .parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
    return parsed.scenario;
  } catch {
    return null;
  }
}

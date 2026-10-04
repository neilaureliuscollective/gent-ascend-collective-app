import { z } from 'zod';
export const performanceEvent = z
  .object({
    name: z.enum(['LCP', 'INP', 'CLS']),
    value: z.number().finite().min(0).max(600000),
    surface: z.enum([
      'public',
      'command',
      'intelligence',
      'grooming',
      'training',
      'collection',
      'account',
      'other',
    ]),
    viewport: z.enum(['compact', 'medium', 'wide']),
  })
  .strict()
  .refine((event) => event.name !== 'CLS' || event.value <= 100);
export function performanceSurface(pathname: string) {
  if (pathname === '/app') return 'command';
  if (/^\/app\/aethelios(?:\/|$)/.test(pathname)) return 'intelligence';
  if (/^\/app\/grooming(?:\/|$)/.test(pathname)) return 'grooming';
  if (/^\/app\/performance(?:\/|$)/.test(pathname)) return 'training';
  if (/^\/app\/collection(?:\/|$)/.test(pathname) || /^\/shop(?:\/|$)/.test(pathname))
    return 'collection';
  if (/^\/app\/(you|membership|welcome|install)(?:\/|$)/.test(pathname) || pathname === '/join')
    return 'account';
  return pathname.startsWith('/app/') || pathname.startsWith('/api/') || pathname.startsWith('/dev')
    ? 'other'
    : 'public';
}
export function performancePayload(
  metric: { name: string; value: number },
  pathname: string,
  width: number,
) {
  const result = performanceEvent.safeParse({
    name: metric.name,
    value: Math.round(metric.value * 1000) / 1000,
    surface: performanceSurface(pathname),
    viewport: width < 600 ? 'compact' : width < 1000 ? 'medium' : 'wide',
  });
  return result.success ? result.data : null;
}

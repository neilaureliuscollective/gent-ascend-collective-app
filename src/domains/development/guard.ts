import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLoopback, parseEnvironment } from '@/platform/environment';
export async function requireLocalHarness(mutation = false) {
  const env = parseEnvironment(process.env);
  if (!env.harnessEnabled) notFound();
  const h = await headers();
  const host = h.get('host');
  if (!host || !isLoopback('http://' + host)) notFound();
  if (mutation) {
    const origin = h.get('origin');
    if (!origin || !isLoopback(origin) || new URL(origin).host !== host) notFound();
  }
  return env;
}

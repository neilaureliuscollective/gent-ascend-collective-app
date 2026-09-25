import 'server-only';
import { cookies } from 'next/headers';
import { currentFounderAccess } from '@/domains/access/founder';
import { currentIdentity } from '@/domains/identity/current';

export const privateOrigin = 'https://aethelios.vercel.app';
export const bridgeCookie = 'aethelios-founder-link';
export const stateCookie = 'aethelios-link-state';
export const verifierCookie = 'aethelios-link-verifier';

export async function founderBridgeContext(question: string): Promise<string | null> {
  if (!(await currentFounderAccess())) return null;
  const identity = await currentIdentity();
  const grant = (await cookies()).get(bridgeCookie)?.value;
  if (!identity || !grant || !/^[A-Za-z0-9_-]{43}$/.test(grant)) return null;
  try {
    const result = await fetch(`${privateOrigin}/api/collective/context`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json', authorization: `Bearer ${grant}`,
        'x-collective-user-id': identity.authUserId,
      },
      body: JSON.stringify({ question: question.slice(0, 8000) }),
      cache: 'no-store', signal: AbortSignal.timeout(19000),
    });
    if (!result.ok) return null;
    const payload: unknown = await result.json();
    if (!payload || typeof payload !== 'object' || !('memories' in payload) || !Array.isArray(payload.memories)) return null;
    const items = payload.memories.filter((m): m is { title: string; content: string; scope: string; updatedAt: string } =>
      !!m && typeof m === 'object' && typeof m.title === 'string' && typeof m.content === 'string' &&
      typeof m.scope === 'string' && typeof m.updatedAt === 'string' &&
      ['global', 'gent-ascend'].includes(m.scope) && m.title.length <= 300 && m.content.length <= 3000,
    ).slice(0, 24);
    const knowledge = 'knowledge' in payload && Array.isArray(payload.knowledge)
      ? payload.knowledge.filter((k): k is { title: string; content: string; domain: string; evidence_level: string; source: { title: string; url: string | null; reviewed_at: string } } =>
        !!k && typeof k === 'object' && typeof k.title === 'string' && k.title.length <= 300 &&
        typeof k.content === 'string' && k.content.length <= 5000 &&
        typeof k.domain === 'string' && typeof k.evidence_level === 'string' &&
        !!k.source && typeof k.source === 'object' && typeof k.source.title === 'string' &&
        (k.source.url === null || typeof k.source.url === 'string') && typeof k.source.reviewed_at === 'string',
      ).slice(0, 5) : [];
    const bounded = { memories: [] as typeof items, knowledge: [] as typeof knowledge };
    for (const item of items) {
      bounded.memories.push(item);
      if (JSON.stringify(bounded).length > 21000) bounded.memories.pop();
    }
    for (const item of knowledge) {
      bounded.knowledge.push(item);
      if (JSON.stringify(bounded).length > 21000) bounded.knowledge.pop();
    }
    return JSON.stringify(bounded);
  } catch { return null; }
}

export async function founderBridgeLinked() {
  return (await currentFounderAccess()) && Boolean((await cookies()).get(bridgeCookie)?.value);
}

import 'server-only';
import { currentIdentity } from '@/domains/identity/current';
import { currentFounderAccess } from '@/domains/access/founder';
import { savedWorkRelations, savedWorkStatus, type SavedWorkReport } from './saved-work';

// Verify the person-bound founder grant before any probe. Reuse the
// normal session client; never substitute service credentials for a denied read.
export async function probeSavedWork(): Promise<SavedWorkReport | null> {
  if (!(await currentFounderAccess())) return null;
  const identity = await currentIdentity();
  const checkedAt = new Date().toISOString();
  const checks = await Promise.all(
    savedWorkRelations.map(async (relation) => {
      if (!identity) return { relation, status: 'unknown' as const };
      try {
        const query =
          relation === 'mission_deliverable_summaries'
            ? identity.client.from('mission_deliverable_summaries')
            : identity.client.from(relation);
        const result = await query
          .select('person_id', { head: true })
          .limit(0)
          .abortSignal(AbortSignal.timeout(4000));
        return { relation, status: savedWorkStatus(result) };
      } catch {
        return { relation, status: 'unknown' as const };
      }
    }),
  );
  return { checkedAt, checks };
}

import 'server-only';
import { currentFounderAccess } from '@/domains/access/founder';
import { IntelligenceError } from '@/domains/intelligence/service';
/** Shared database previews must not expand the pilot to ordinary beta accounts. */
export async function requireCanonicalPilotAccess(
  canonicalPilot: boolean,
  verifyFounder: () => Promise<boolean> = currentFounderAccess,
) {
  if (canonicalPilot && !(await verifyFounder()))
    throw new IntelligenceError(
      'This hosted voice pilot is restricted to the founder account.',
      403,
    );
}

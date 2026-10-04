import 'server-only';
import { currentFounderAccess } from '@/domains/access/founder';
import { releaseReadiness } from './model';
export async function readReleaseReadiness() {
  if (!(await currentFounderAccess())) return null;
  return releaseReadiness(process.env);
}

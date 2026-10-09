import 'server-only';
import { currentFounderAccess } from '@/domains/access/founder';
import { releaseReadiness } from './model';
import { probeSavedWork } from './saved-work-service';
export async function readReleaseReadiness() {
  if (!(await currentFounderAccess())) return null;
  const savedWork = await probeSavedWork();
  if (!savedWork) return null;
  return { ...releaseReadiness(process.env), savedWork };
}

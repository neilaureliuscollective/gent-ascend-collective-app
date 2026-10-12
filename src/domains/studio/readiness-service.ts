import 'server-only';
import { currentFounderAccess } from '@/domains/access/founder';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { studioConfiguration, type StudioSetupCheck } from './readiness';
export async function studioReadiness() {
  if (!(await currentFounderAccess())) throw new IntelligenceError('Founder access required.', 403);
  const { client, person } = await intelligenceSession();
  const tables = [
    ['Image projects', 'ai_studio_projects', 'id,brief'],
    ['Image versions', 'ai_studio_versions', 'id,status,storage_key'],
    ['Storyboard', 'ai_studio_scenes', 'id,position,asset_version_id'],
    ['Finish recipes', 'ai_studio_finishes', 'id,format,treatment'],
    ['Narration records', 'ai_studio_narrations', 'id,status,storage_key'],
    ['Narration allowance', 'ai_studio_narration_usage', 'id,created_at'],
    ['Footage records', 'ai_studio_footage', 'id,status,quote_signature,provider_signature'],
    ['Footage allowance', 'ai_studio_footage_usage', 'id,estimate'],
  ] as const;
  const schemas = await Promise.all(
    tables.map(async ([name, table, columns]): Promise<StudioSetupCheck> => {
      try {
        const result = await client.from(table).select(columns).eq('person_id', person.id).limit(0);
        return {
          name,
          status: result.error
            ? ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(result.error.code)
              ? 'missing'
              : 'unavailable'
            : 'detected',
          next: 'Checks expected columns through your session without reading rows. Does not verify RPC definitions, RLS policy correctness or private storage. Review additive migrations for the existing Gent Ascend database.',
        };
      } catch {
        return {
          name,
          status: 'unavailable',
          next: 'The schema probe could not be confirmed. Nothing was changed.',
        };
      }
    }),
  );
  return {
    version: 1,
    mode: 'read-only; no provider calls or mutations',
    liveAccepted: false,
    configuration: studioConfiguration(process.env),
    schemas,
  };
}

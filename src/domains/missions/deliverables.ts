import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { deliverableAction, deliverableExport } from './deliverable-schema';
import type { z } from 'zod';
export async function readDeliverables(missionId?: string) {
  const { client, person } = await intelligenceSession();
  let query = client.from('mission_deliverable_summaries').select('*').eq('person_id', person.id);
  if (missionId) query = query.eq('mission_id', missionId);
  const docs = await query.order('created_at', { ascending: false }).limit(500);
  if (docs.error) throw new IntelligenceError('Deliverables could not be loaded.', 503);
  return docs.data ?? [];
}
export async function readDeliverable(id: string) {
  const { client, person } = await intelligenceSession();
  const doc = await client
    .from('mission_deliverables')
    .select('*')
    .eq('person_id', person.id)
    .eq('id', id)
    .maybeSingle();
  if (doc.error) throw new IntelligenceError('Deliverable could not be loaded.', 503);
  if (!doc.data) throw new IntelligenceError('Deliverable not found.', 404);
  const versions = await client
    .from('mission_deliverable_versions')
    .select('id,person_id,deliverable_id,revision,title,source,reviewed_at,created_at')
    .eq('person_id', person.id)
    .eq('deliverable_id', id)
    .order('revision', { ascending: false })
    .limit(100);
  if (versions.error || !versions.data?.length)
    throw new IntelligenceError('Versions could not be loaded.', 503);
  const current = await readDeliverableVersion(id, versions.data[0]!.id);
  return { deliverable: doc.data, versions: versions.data, current };
}
/** Exact version retrieval is owner- and document-bound, including exports. */
export async function readDeliverableVersion(id: string, versionId: string) {
  const { client, person } = await intelligenceSession();
  const result = await client
    .from('mission_deliverable_versions')
    .select('*')
    .eq('person_id', person.id)
    .eq('deliverable_id', id)
    .eq('id', versionId)
    .maybeSingle();
  if (result.error) throw new IntelligenceError('Version could not be loaded.', 503);
  if (!result.data) throw new IntelligenceError('Version not found.', 404);
  return result.data;
}
export async function changeDeliverable(input: z.infer<typeof deliverableAction>) {
  const { client } = await intelligenceSession();
  const result =
    input.action === 'delete'
      ? await client.rpc('mission_delete_deliverable', {
          p_id: input.id,
          p_expected: input.expected,
        })
      : input.action === 'create'
        ? await client.rpc('mission_create_deliverable', {
            p_mission: input.missionId,
            p_turn: input.turnId,
            p_revision: input.revision,
          })
        : input.action === 'save'
          ? await client.rpc('mission_save_deliverable', {
              p_id: input.id,
              p_version: input.versionId,
              p_expected: input.expected,
              p_title: input.title,
              p_body: input.body,
              p_acceptance: input.acceptance,
            })
          : await client.rpc('mission_review_deliverable', {
              p_id: input.id,
              p_version: input.versionId,
              p_note: input.note,
            });
  if (result.error || !result.data)
    throw new IntelligenceError(
      'The work changed or its save was not confirmed. Reload saved work before retrying.',
      409,
    );
  return { id: input.action === 'create' ? result.data : input.id };
}
export async function exportDeliverable(id: string, versionId: string) {
  return deliverableExport(await readDeliverableVersion(id, versionId));
}

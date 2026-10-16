import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { maxReferenceBytes, referenceType } from './image-validation';

/** Select the existing owned object; never copy, transform, generate or delete an asset. */
export async function selectStudioReference(projectId: string, referenceId: string | null) {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Studio access unavailable.', 403);
  const project = await client
    .from('ai_studio_projects')
    .select('id,brief,updated_at')
    .eq('id', projectId)
    .eq('person_id', person.id)
    .is('company_id', null)
    .maybeSingle();
  if (project.error) throw new IntelligenceError('Project could not be verified.', 503);
  if (!project.data) throw new IntelligenceError('Project unavailable.', 404);
  if (referenceId) {
    const reference = await client
      .from('ai_studio_references')
      .select('id,storage_key,media_type,byte_size')
      .eq('id', referenceId)
      .eq('project_id', projectId)
      .eq('person_id', person.id)
      .maybeSingle();
    if (reference.error) throw new IntelligenceError('Reference could not be verified.', 503);
    if (!reference.data) throw new IntelligenceError('Reference unavailable in this project.', 404);
    const stored = await client.storage
      .from('aethelios-studio')
      .download(reference.data.storage_key);
    if (stored.error || !stored.data)
      throw new IntelligenceError('Reference file unavailable. Choose another image.', 409);
    if (stored.data.size > maxReferenceBytes || stored.data.size !== reference.data.byte_size)
      throw new IntelligenceError('Reference file changed or is unsupported.', 409);
    const bytes = new Uint8Array(await stored.data.arrayBuffer());
    if (
      bytes.length !== reference.data.byte_size ||
      referenceType(bytes) !== reference.data.media_type
    )
      throw new IntelligenceError('Reference file changed or is unsupported.', 409);
  }
  const storedBrief =
    project.data.brief &&
    typeof project.data.brief === 'object' &&
    !Array.isArray(project.data.brief)
      ? project.data.brief
      : {};
  const brief = {
    purpose: '',
    audience: '',
    direction: '',
    palette: '',
    avoid: '',
    ...storedBrief,
  };
  if (brief.referenceId !== referenceId) {
    const saved = await client
      .from('ai_studio_projects')
      .update({ brief: { ...brief, referenceId }, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('person_id', person.id)
      .is('company_id', null)
      .eq('updated_at', project.data.updated_at)
      .select('id')
      .maybeSingle();
    if (saved.error) throw new IntelligenceError('Reference selection could not be saved.', 503);
    if (!saved.data)
      throw new IntelligenceError(
        'Project changed elsewhere. Reload before selecting the reference.',
        409,
      );
  }
  return {
    projectId,
    referenceId,
    href: `/app/studio?project=${projectId}${referenceId ? `&reference=${referenceId}` : ''}`,
  };
}

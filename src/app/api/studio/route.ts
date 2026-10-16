import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import {
  generateStudio,
  projectInput,
  projectUpdate,
  studioInput,
  studioSession,
  studioWorkspace,
} from '@/domains/studio/service';
import { IntelligenceError } from '@/domains/intelligence/service';
import { z } from 'zod';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('project');
    if (id && !z.uuid().safeParse(id).success) throw new IntelligenceError('Invalid project.');
    return privateJson(await studioWorkspace(id ?? undefined));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request);
    const project = projectInput.safeParse(body);
    if (project.success) {
      const { client, person } = await studioSession();
      if (project.data.brief?.brand?.logoReferenceId || project.data.brief?.referenceId)
        throw new IntelligenceError('Create the project before selecting its logo reference.', 422);
      const id = crypto.randomUUID();
      const result = await client
        .from('ai_studio_projects')
        .insert({
          id,
          person_id: person.id,
          title: project.data.title,
          creative_type: project.data.creativeType,
          brief: project.data.brief ?? {},
        })
        .select('id')
        .single();
      if (result.error) throw new IntelligenceError('Project could not be created.', 503);
      return privateJson({ id }, 201);
    }
    const input = studioInput.safeParse(body);
    if (!input.success) throw new IntelligenceError('Check the Studio request.');
    return privateJson(await generateStudio(input.data), 201);
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const input = projectUpdate.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Check the project direction.');
    const { client, person } = await studioSession();
    const { projectId, updatedAt, title, creativeType, brief } = input.data;
    if (brief.referenceId) {
      const reference = await client
        .from('ai_studio_references')
        .select('id')
        .eq('id', brief.referenceId)
        .eq('project_id', projectId)
        .eq('person_id', person.id)
        .maybeSingle();
      if (reference.error || !reference.data)
        throw new IntelligenceError('Choose a reference from this project.', 422);
    }
    if (brief.brand?.logoReferenceId) {
      const logo = await client
        .from('ai_studio_references')
        .select('id')
        .eq('id', brief.brand.logoReferenceId)
        .eq('project_id', projectId)
        .eq('person_id', person.id)
        .maybeSingle();
      if (logo.error || !logo.data)
        throw new IntelligenceError('Choose a logo reference from this project.', 422);
    }
    const result = await client
      .from('ai_studio_projects')
      .update({ title, creative_type: creativeType, brief, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('person_id', person.id)
      .is('company_id', null)
      .eq('updated_at', updatedAt)
      .select('id')
      .maybeSingle();
    if (result.error) throw new IntelligenceError('Project direction could not be saved.', 503);
    if (!result.data)
      throw new IntelligenceError('This project changed elsewhere. Refresh it before saving.', 409);
    return privateJson({ id: result.data.id });
  } catch (error) {
    return apiError(error);
  }
}

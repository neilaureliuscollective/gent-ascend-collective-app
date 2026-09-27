import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { bucket, studioSession } from '@/domains/studio/service';
import { maxReferenceBytes, referenceExtension, referenceType } from '@/domains/studio/image-validation';
import { supabaseConnection } from '@/platform/supabase/connection';
import { z } from 'zod';

export const runtime = 'nodejs';
const init = z.object({action:z.literal('prepare'),projectId:z.uuid(),mediaType:z.enum(['image/png','image/jpeg','image/webp']),byteSize:z.number().int().min(100).max(maxReferenceBytes)}).strict();
const finish = z.object({action:z.literal('complete'),projectId:z.uuid(),id:z.uuid(),mediaType:z.enum(['image/png','image/jpeg','image/webp'])}).strict();

export async function POST(request: Request) {
  try {
    const body = await mutationBody(request);
    const preparation = init.safeParse(body);
    const completion = finish.safeParse(body);
    if (!preparation.success && !completion.success) throw new IntelligenceError('Invalid reference request.');
    const {client,person} = await studioSession();
    const input = preparation.success ? preparation.data : completion.data!;
    const owner = await client.from('ai_studio_projects').select('id').eq('id',input.projectId).eq('person_id',person.id).single();
    if (owner.error || !owner.data) throw new IntelligenceError('Project not found.',404);
    const auth = await client.auth.getUser();
    if (!auth.data.user) throw new IntelligenceError('Session expired.',401);
    const id = preparation.success ? crypto.randomUUID() : completion.data!.id;
    const key = `${auth.data.user.id}/${input.projectId}/${id}.${referenceExtension(input.mediaType)}`;
    if (preparation.success) {
      const signed = await client.storage.from(bucket).createSignedUploadUrl(key,{upsert:false});
      if (signed.error || !signed.data) throw new IntelligenceError('Reference upload could not be prepared.',503);
      const connection = supabaseConnection(process.env);
      if (!connection) throw new IntelligenceError('Storage is not configured.',503);
      return privateJson({id,path:signed.data.path,token:signed.data.token,url:connection.url,publishableKey:connection.key});
    }
    const existing = await client.from('ai_studio_references').select('id').eq('id',id).eq('person_id',person.id).eq('project_id',input.projectId).maybeSingle();
    if (existing.error) throw new IntelligenceError('Reference could not be verified.',503);
    if (existing.data) return privateJson({id});
    const stored = await client.storage.from(bucket).download(key);
    if (stored.error || !stored.data) throw new IntelligenceError('Upload did not finish. Try selecting the image again.',409);
    const bytes = new Uint8Array(await stored.data.arrayBuffer());
    if (referenceType(bytes) !== input.mediaType) {
      await client.storage.from(bucket).remove([key]);
      throw new IntelligenceError('Choose a PNG, JPEG, or WebP image smaller than 10 MB.',422);
    }
    const record = await client.from('ai_studio_references').insert({id,person_id:person.id,project_id:input.projectId,storage_key:key,media_type:input.mediaType,byte_size:bytes.length});
    if (record.error) {
      // A concurrent completion may have saved the same record; do not remove its object.
      const check = await client.from('ai_studio_references').select('id').eq('id',id).eq('person_id',person.id).maybeSingle();
      if (check.data) return privateJson({id});
      throw new IntelligenceError('Reference could not be saved.',503);
    }
    return privateJson({id},201);
  } catch (error) { return apiError(error); }
}

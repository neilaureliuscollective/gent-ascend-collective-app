import { idInput } from '@/domains/intelligence/validation';
import {
  intelligenceSession,
  readWorkspace,
  IntelligenceError,
} from '@/domains/intelligence/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { z } from 'zod';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const value = params.get('conversationId');
    if (value && !idInput.safeParse(value).success)
      throw new IntelligenceError('Invalid conversation.');
    const before = params.get('before');
    const listBefore = params.get('listBefore');
    const [cursorTime,cursorId]=listBefore?.split('|')??[];
    if ((before && !z.iso.datetime({offset:true}).safeParse(before).success) ||
        (listBefore && (!z.iso.datetime({offset:true}).safeParse(cursorTime).success || !z.uuid().safeParse(cursorId).success)))
      throw new IntelligenceError('Invalid page cursor.');
    const search = params.get('search');
    if (search !== null) {
      if (search.trim().length < 2 || search.length > 120) throw new IntelligenceError('Use at least two search characters.');
      const {client} = await intelligenceSession();
      const result = await client.rpc('ai_search_conversations',{p_query:search.trim(),p_limit:30});
      if (result.error) throw new IntelligenceError('Search is unavailable. Please try again.',503);
      return privateJson({results:result.data});
    }
    if (params.get('archive') === '1') {
      const {client,person}=await intelligenceSession();
      const result=await client.from('ai_conversations').select('*').eq('person_id',person.id)
        .is('company_id',null).not('archived_at','is',null).order('archived_at',{ascending:false}).limit(40);
      if(result.error) throw new IntelligenceError('Archive could not be loaded.',503);
      return privateJson({results:result.data});
    }
    return privateJson(await readWorkspace(value ?? undefined, before ?? undefined, listBefore ?? undefined));
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const input = z.object({id:z.uuid(), title:z.string().trim().min(1).max(80).nullable(), archived:z.boolean().nullable()}).strict().safeParse(await mutationBody(request));
    if (!input.success || (input.data.title===null && input.data.archived===null))
      throw new IntelligenceError('Invalid conversation update.');
    const {client,person} = await intelligenceSession();
    const scope=await client.from('ai_conversations').select('id').eq('id',input.data.id).eq('person_id',person.id).is('company_id',null).maybeSingle();
    if(scope.error || !scope.data) throw new IntelligenceError('Conversation not found.',404);
    const result=await client.rpc('ai_update_conversation',{
      p_id:input.data.id,p_title:input.data.title,p_archive:input.data.archived,
    });
    if (result.error || !result.data) throw new IntelligenceError('Conversation could not be updated.',result.error?503:404);
    return privateJson({saved:true});
  } catch(error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    const body = await mutationBody(request);
    const id = idInput.safeParse((body as { id?: unknown })?.id);
    if (!id.success) throw new IntelligenceError('Invalid conversation.');
    const { client, person } = await intelligenceSession();
    const result = await client
      .from('ai_conversations')
      .delete()
      .eq('id', id.data)
      .eq('person_id', person.id)
      .is('company_id', null)
      .select('id');
    if (result.error) throw new IntelligenceError('Conversation could not be deleted.', 503);
    if (!result.data?.length) throw new IntelligenceError('Conversation not found.', 404);
    return privateJson({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}

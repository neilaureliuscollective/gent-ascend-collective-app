import 'server-only';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { currentAccess } from '@/domains/access/current';
import { aiConfigSchema } from './validation';
import { promptVersion, buildMessages } from './prompt';
import { founderBridgeContext } from './founder-bridge';
import { generateConversationTitle, summarizeThread } from './model';
import type { PersonalContext, WorkspaceData, Turn } from './types';
export class IntelligenceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function intelligenceSession() {
  const identity = await currentIdentity();
  const person = await currentPerson();
  if (!identity || !person)
    throw new IntelligenceError('Sign in to use your Aethelios workspace.', 401);
  return { client: identity.client, person };
}
export async function personalContext(question?:string): Promise<PersonalContext> {
  const { client, person } = await intelligenceSession();
  const [goal, memories, daily, profileFacts, reviews] = await Promise.all([
    client
      .from('goals')
      .select('*')
      .eq('person_id', person.id)
      .eq('status', 'active')
      .maybeSingle(),
    client
      .from('ai_memories')
      .select('*')
      .eq('person_id', person.id)
      .order('confirmed_at', { ascending: false })
      .limit(24),
    client.from('daily_entries').select('day,intention,energy,reflection,actions:daily_actions(title,done)').eq('person_id', person.id).order('day', { ascending: false }).limit(3),
    client.from('ascend_profile_facts').select('fact_key,value,confirmed_at,source_kind').eq('person_id',person.id),
    client.from('daily_reviews').select('day,progress,blocker,tomorrow,confirmed_at').eq('person_id',person.id).order('day',{ascending:false}).limit(3),
  ]);
  if (goal.error || memories.error || daily.error || profileFacts.error || reviews.error)
    throw new IntelligenceError('Your personal context could not be loaded.', 503);
  const reviewByDay=new Map((reviews.data??[]).map(review=>[review.day,review]));
  const tokens=new Set((question??'').toLowerCase().match(/[a-z]{4,}/g)??[]);
  const ranked=(memories.data??[]).map(row=>({row,score:[...tokens].reduce((n,word)=>n+(row.content.toLowerCase().includes(word)?1:0),0)}));
  const selected=question ? ranked.sort((a,b)=>b.score-a.score).filter(item=>item.score>0).slice(0,6).map(item=>item.row) : memories.data??[];
  const dailyRelevant=!question || /today|tomorrow|daily|routine|week|progress|energy|sleep|reflect|yesterday|plan/i.test(question);
  return {
    profile: {
      name: person.display_name,
      priority: person.priority,
      timezone: person.timezone,
      units: person.unit_system,
      updatedAt: person.updated_at,
    },
    goal: goal.data
      ? {
          title: goal.data.title,
          nextStep: goal.data.next_step,
          reason: goal.data.reason,
          updatedAt: goal.data.updated_at,
        }
      : null,
    memories: selected.map(({ id, content, kind, confirmed_at }) => ({
      id,
      content,
      kind,
      confirmed_at,
    })),
    daily: dailyRelevant ? (daily.data ?? []).map(({ day, intention, energy, reflection, actions }) => {const review=reviewByDay.get(day);return {day,intention,energy,reflection,actions:actions ?? [],review:review?{progress:review.progress,blocker:review.blocker,tomorrow:review.tomorrow,confirmedAt:review.confirmed_at}:null};}) : [],
    ascendProfile: (profileFacts.data ?? []).filter(fact=>fact.value!==null).map(fact=>({key:fact.fact_key,value:fact.value!,confirmedAt:fact.confirmed_at,source:fact.source_kind})),
  };
}
export async function conversationTurns(id: string, before?: string) {
  const { client, person } = await intelligenceSession();
  const { data: conversation, error } = await client
    .from('ai_conversations')
    .select('id')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (error) throw new IntelligenceError('Conversation could not be loaded.', 503);
  if (!conversation) throw new IntelligenceError('Conversation not found.', 404);
  let query = client
    .from('ai_turns')
    .select('*')
    .eq('conversation_id', id)
    .eq('person_id', person.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(41);
  if (before) query = query.lt('created_at', before);
  const turns = await query;
  if (turns.error) throw new IntelligenceError('Conversation could not be loaded.', 503);
  return (turns.data ?? []).reverse();
}
async function auxiliaryCall<T extends {text:string;input:number|null;output:number|null}>(client:Awaited<ReturnType<typeof intelligenceSession>>['client'],kind:'title'|'summary',run:()=>Promise<T|null>) {
  const id=crypto.randomUUID();
  const reserved=await client.rpc('ai_reserve_auxiliary',{p_id:id,p_kind:kind});
  if(reserved.error || !reserved.data) return null;
  const result=await run();
  if(result) await client.rpc('ai_finish_auxiliary',{p_id:id,p_input:result.input,p_output:result.output});
  return result;
}
async function prepareThreadSummary(client:Awaited<ReturnType<typeof intelligenceSession>>['client'], personId:string, conversationId:string, history:Turn[]) {
  const record=await client.from('ai_conversations').select('context_summary,summary_through').eq('id',conversationId).eq('person_id',personId).single();
  if(record.error || !record.data) throw new Error('Thread summary unavailable');
  let summary=record.data.context_summary || '';
  let through=record.data.summary_through ?? null;
  const complete=history.filter(t=>t.status==='complete' && !history.some(newer=>newer.parent_turn_id===t.id));
  if(complete.length<=20) return summary;
  const cutoff=complete.at(-20)!.created_at;
  let throughTime:string|null=null;
  if(through) {
    const marker=await client.from('ai_turns').select('created_at').eq('id',through).eq('person_id',personId).single();
    if(marker.error || !marker.data) throw new Error('Summary marker unavailable');
    throughTime=marker.data.created_at;
  }
  for(let batch=0;batch<6;batch++) {
    let query=client.from('ai_turns').select('id,user_text,assistant_text,created_at,parent_turn_id,status')
      .eq('person_id',personId).eq('conversation_id',conversationId).eq('status','complete')
      .lt('created_at',cutoff).order('created_at',{ascending:true}).limit(40);
    if(throughTime) query=query.gt('created_at',throughTime);
    const older=await query;
    if(older.error) throw new Error('Older history unavailable');
    const rows=(older.data??[]).filter(t=>!older.data?.some(newer=>newer.parent_turn_id===t.id));
    if(!older.data?.length) return summary;
    const revised=await auxiliaryCall(client,'summary',()=>summarizeThread(summary,rows));
    if(!revised) throw new Error('Thread summary could not be prepared');
    const last=older.data.at(-1)!;
    const saved=await client.rpc('ai_save_thread_summary',{p_id:conversationId,p_summary:revised.text,p_through:last.id,p_expected:through});
    if(saved.error || !saved.data) throw new Error('Thread summary could not be saved');
    summary=revised.text;through=last.id;throughTime=last.created_at;
    if(older.data.length<40) return summary;
  }
  throw new Error('Thread is too long to prepare safely');
}
export async function readWorkspace(conversationId?: string, before?: string, listBefore?: string): Promise<WorkspaceData> {
  const { client, person } = await intelligenceSession();
  const [cursorTime,cursorId]=listBefore?.split('|')??[];
  let conversationQuery=client.from('ai_conversations').select('*').eq('person_id',person.id)
    .is('archived_at',null).order('updated_at',{ascending:false}).order('id',{ascending:false}).limit(41);
  if(cursorTime && cursorId) conversationQuery=conversationQuery.or(`updated_at.lt.${cursorTime},and(updated_at.eq.${cursorTime},id.lt.${cursorId})`);
  const [list, memories, actionProposals, context, access, turns, current] = await Promise.all([
    conversationQuery,
    client
      .from('ai_memories')
      .select('*')
      .eq('person_id', person.id)
      .order('confirmed_at', { ascending: false })
      .limit(24),
    client.from('ai_action_proposals').select('*').eq('person_id',person.id).order('proposed_at',{ascending:false}).limit(100),
    personalContext(),
    currentAccess(),
    conversationId ? conversationTurns(conversationId, before) : Promise.resolve([]),
    conversationId ? client.from('ai_conversations').select('*').eq('person_id',person.id).eq('id',conversationId).maybeSingle() : Promise.resolve({data:null,error:null}),
  ]);
  if (list.error || memories.error || actionProposals.error || current.error)
    throw new IntelligenceError('Your workspace could not be loaded.', 503);
  const config = aiConfigSchema.parse(process.env);
  return {
    conversations: (list.data ?? []).slice(0, 40),
    turns: turns.slice(-40),
    memories: memories.data ?? [],
    actionProposals: actionProposals.data ?? [],
    context,
    canChat: access.has('aurelius.context'),
    configured: Boolean(config.OPENAI_API_KEY),
    model: config.AURELIUS_AI_MODEL,
    hasOlderTurns: turns.length > 40,
    nextConversationCursor: (list.data ?? []).length > 40 && list.data?.[39] ? `${list.data[39].updated_at}|${list.data[39].id}` : null,
    currentConversation: current.data,
  };
}
export async function prepareReply(input: {
  conversationId: string;
  requestId: string;
  text: string;
  includeContext: boolean;
  sourceTurnId?: string;
  revisionKind?: 'retry'|'regenerate'|'edit';
}) {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError(
      'Aethelios access is not enabled for this account. If you were invited, confirm access in the founding member guide.',
      403,
    );
  const config = aiConfigSchema.parse(process.env);
  if (!config.OPENAI_API_KEY)
    throw new IntelligenceError(
      'Aethelios is waiting for its model connection. Your workspace remains available.',
      503,
    );
  const common = {
    p_request: input.requestId,
    p_text: input.text,
    p_model: config.AURELIUS_AI_MODEL,
    p_context: input.includeContext,
    p_prompt_version: promptVersion,
  };
  const begun = input.sourceTurnId && input.revisionKind
    ? await client.rpc('ai_begin_revision',{...common,p_conversation:input.conversationId,p_source:input.sourceTurnId,p_kind:input.revisionKind})
    : await client.rpc('ai_begin_turn',{...common,p_conversation:input.conversationId});
  if (begun.error) {
    if (begun.error.code === 'P0001')
      throw new IntelligenceError(
        'A conversation or usage limit was reached. Try later, or start a new conversation if this one is full.',
        429,
      );
    if (['23505', '55P03'].includes(begun.error.code))
      throw new IntelligenceError(
        'A request is already saved or in progress. Reload before sending again.',
        409,
      );
    throw new IntelligenceError(
      'This conversation could not be started. Reload before trying again.',
      409,
    );
  }
  // Read history only after the reservation, so another completed request cannot
  // be omitted by a stale pre-reservation snapshot. The pending current turn is
  // filtered by buildMessages and supplied once as the final user message.
  let history: Turn[];
  let context: PersonalContext | null;
  let threadSummary:string;
  try {
    [history, context] = await Promise.all([
      conversationTurns(input.conversationId),
      input.includeContext ? personalContext(input.text) : Promise.resolve(null),
    ]);
    threadSummary=await prepareThreadSummary(client,person.id,input.conversationId,history);
  } catch {
    await client.rpc('ai_finish_turn', {
      p_request: input.requestId,
      p_text: '',
      p_status: 'failed',
    });
    throw new IntelligenceError(
      'Conversation context could not be prepared. No model request was sent. Reload before trying again.',
      503,
    );
  }
  const founderContext = input.includeContext ? await founderBridgeContext(input.text) : null;
  return {
    model: config.AURELIUS_AI_MODEL,
    messages: buildMessages(history.filter(turn=>!history.some(newer=>newer.parent_turn_id===turn.id)), input.text, context, new Date(), founderContext, threadSummary),
    founder: founderContext !== null,
    finish: async (
      text: string,
      status: 'complete' | 'failed' | 'cancelled',
      inputTokens?: number,
      outputTokens?: number,
    ): Promise<Turn> => {
      const result = await client.rpc('ai_finish_turn', {
        p_request: input.requestId,
        p_text: text,
        p_status: status,
        p_input: inputTokens ?? null,
        p_output: outputTokens ?? null,
      });
      if (result.error || !result.data)
        throw new IntelligenceError('Reply could not be saved.', 503);
      const row = await client
        .from('ai_turns')
        .select('*')
        .eq('id', input.requestId)
        .eq('person_id', person.id)
        .single();
      if (row.error || !row.data) throw new IntelligenceError('Reply could not be loaded.', 503);
      if(status==='complete' && history.filter(turn=>turn.status==='complete').length===0) {
        const title=await auxiliaryCall(client,'title',()=>generateConversationTitle(input.text,text));
        if(title) await client.rpc('ai_set_generated_title',{p_id:input.conversationId,p_title:title.text});
      }
      return row.data;
    },
  };
}

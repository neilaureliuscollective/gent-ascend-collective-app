import 'server-only';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { currentAccess } from '@/domains/access/current';
import { aiConfigSchema } from './validation';
import { promptVersion, buildMessages } from './prompt';
import { councilPromptVersion, type CouncilSelection } from './council';
import { legacyContextSources, selectedContext, type ContextSources } from './context-sources';
import { generateConversationTitle, summarizeThread } from './model';
import type { PersonalContext, WorkspaceData, Turn } from './types';
import { localDay } from '@/domains/daily/model';
import { readContinuity } from '@/domains/continuity/service';
import { resolveNextMove } from '@/domains/command/next-move';
import { capabilityContext } from './capabilities';
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
export async function personalContext(question?:string, sources: ContextSources = legacyContextSources): Promise<PersonalContext> {
  const { client, person } = await intelligenceSession();
  const groomingRelevant=sources.lifestyle && !!question && /presence|appear|wardrobe|outfit|dress|confidence|prepar|meeting|occasion|travel|date|groom|hair|beard|skin|scalp|shav|cut|style|look|ritual|wedding|photo|product/i.test(question);
  const continuityPromise = sources.daily && sources.lifestyle && question && /week|progress|train|workout|routine|ritual|groom/i.test(question) ? readContinuity({ client, person }).catch(() => null) : Promise.resolve(undefined);
  const today = localDay(new Date(), person.timezone);
  const [goal, memories, daily, profileFacts, reviews, grooming, captures] = await Promise.all([
    sources.goals ? client
      .from('goals')
      .select('*')
      .eq('person_id', person.id)
      .eq('status', 'active')
      .maybeSingle() : Promise.resolve({data:null,error:null}),
    sources.memory ? client
      .from('ai_memories')
      .select('*')
      .eq('person_id', person.id)
      .order('confirmed_at', { ascending: false })
      .limit(24) : Promise.resolve({data:[],error:null}),
    sources.daily ? client.from('daily_entries').select('day,version,intention,energy,reflection,actions:daily_actions(id,title,done,position)').eq('person_id', person.id).lte('day',today).order('day', { ascending: false }).limit(3) : Promise.resolve({data:[],error:null}),
    sources.profile ? client.from('ascend_profile_facts').select('fact_key,value,confirmed_at,source_kind').eq('person_id',person.id) : Promise.resolve({data:[],error:null}),
    sources.daily ? client.from('daily_reviews').select('day,progress,blocker,tomorrow,confirmed_at').eq('person_id',person.id).lte('day',today).order('day',{ascending:false}).limit(3) : Promise.resolve({data:[],error:null}),
    groomingRelevant?Promise.all([
      client.from('grooming_profiles').select('hair_focus,beard_focus,skin_focus,preferred_look,effort,sensitivities,dislikes').eq('person_id',person.id).maybeSingle(),
      client.from('grooming_goals').select('title,target_date').eq('person_id',person.id).eq('status','active').limit(4),
      client.from('grooming_rituals').select('id,version,kind,title,steps').eq('person_id',person.id).eq('active',true).limit(3),
      client.from('grooming_products').select('name,relation,note,ritual_id').eq('person_id',person.id).order('created_at',{ascending:false}).limit(10),
      client.from('grooming_looks').select('title,kind,detail,service_date').eq('person_id',person.id).order('created_at',{ascending:false}).limit(6),
      client.from('grooming_look_previews').select('title,style_id,note,saved_at').eq('person_id',person.id).eq('status','complete').not('saved_at','is',null).order('saved_at',{ascending:false}).limit(4),
      client.from('grooming_scans').select('created_at,summary').eq('person_id',person.id).eq('status','complete').order('created_at',{ascending:false}).limit(2),
      client.from('grooming_events').select('title,event_date,note').eq('person_id',person.id).gte('event_date',today).order('event_date').limit(6),
      client.from('grooming_checkins').select('ritual_id,occurred_at,note').eq('person_id',person.id).eq('done',true).order('occurred_at',{ascending:false}).limit(7),
    ]):null,
    sources.daily ? client.from('life_captures').select('id',{count:'exact',head:true}).eq('person_id',person.id).eq('status','inbox') : Promise.resolve({data:[],error:null,count:0}),
  ]);
  if (goal.error || memories.error || daily.error || profileFacts.error || reviews.error || captures.error || grooming?.some(result=>result.error))
    throw new IntelligenceError('Your personal context could not be loaded.', 503);
  const reviewByDay=new Map((reviews.data??[]).map(review=>[review.day,review]));
  const tokens=new Set((question??'').toLowerCase().match(/[a-z]{4,}/g)??[]);
  const ranked=(memories.data??[]).map(row=>({row,score:[...tokens].reduce((n,word)=>n+(row.content.toLowerCase().includes(word)?1:0),0)}));
  const selected=question ? ranked.sort((a,b)=>b.score-a.score).filter(item=>item.score>0).slice(0,6).map(item=>item.row) : memories.data??[];
  const dailyRelevant=!question || /today|tomorrow|daily|routine|week|progress|energy|sleep|reflect|yesterday|plan/i.test(question);
  const todayEntry=(daily.data??[]).find(entry=>entry.day===today);
  const previousReview=(reviews.data??[]).find(review=>review.day<today);
  const orderedActions=(todayEntry?.actions??[]).slice().sort((a,b)=>a.position-b.position).map(({id,title,done})=>({id,title,done}));
  const { title, kind, source, sourceDay } = resolveNextMove({ day: today, actions: orderedActions, reviewed: reviewByDay.has(today), previousReview: previousReview ?? null, goalStep: goal.data?.next_step ?? null });
  const continuity = await continuityPromise;
  return {
    continuity: continuity ? { start: continuity.start, today: continuity.today, timezone: continuity.timezone, recordedDays: continuity.recordedDays, actionsCompleted: continuity.actionsCompleted, actionsPlanned: continuity.actionsPlanned, sessionsCompleted: continuity.sessionsCompleted, practiceDays: continuity.practiceDays, reviewedDays: continuity.reviewedDays, nextAction: continuity.nextAction, activeSession: continuity.activeSession ? { title: continuity.activeSession.title } : null, unavailable: continuity.unavailable } : continuity,
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
    dailyBrief: {asOf:new Date().toISOString(),day:today,version:todayEntry?.version??0,intention:todayEntry?.intention??'',actions:orderedActions,openCaptures:captures.count??0,previousReview:previousReview?{day:previousReview.day,tomorrow:previousReview.tomorrow,blocker:previousReview.blocker}:null,nextMove:{title,kind,source,sourceDay}},
    ascendProfile: (profileFacts.data ?? []).filter(fact=>fact.value!==null).map(fact=>({key:fact.fact_key,value:fact.value!,confirmedAt:fact.confirmed_at,source:fact.source_kind})),
    grooming:grooming?(()=>{const [p,g,r,products,looks,concepts,scans,occasions,practice]=grooming;return {occasions:(occasions.data??[]).map(x=>({title:x.title,day:x.event_date,note:x.note})),profile:p.data?{hair:p.data.hair_focus,beard:p.data.beard_focus,skin:p.data.skin_focus,look:p.data.preferred_look,effort:p.data.effort,sensitivities:p.data.sensitivities,dislikes:p.data.dislikes}:null,goals:(g.data??[]).map(x=>({title:x.title,date:x.target_date})),rituals:(r.data??[]).map(x=>({id:x.id,version:x.version,kind:x.kind,title:x.title,steps:x.steps})),products:(products.data??[]).map(x=>({name:x.name,relation:x.relation,note:x.note,ritualId:x.ritual_id})),looks:(looks.data??[]).map(x=>({title:x.title,kind:x.kind,detail:x.detail,date:x.service_date})),concepts:(concepts.data??[]).map(x=>({title:x.title,style:x.style_id,note:x.note,at:x.saved_at!})),practice:(practice.data??[]).map(x=>({ritualId:x.ritual_id,at:x.occurred_at,note:x.note})),scans:(scans.data??[]).map(x=>({at:x.created_at,summary:x.summary}))};})():undefined,
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
    ownerId: person.id,
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
  contextSources?: ContextSources;
  sourceTurnId?: string;
  revisionKind?: 'retry'|'regenerate'|'edit';
  council?: CouncilSelection;
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
  const sources = input.contextSources ?? legacyContextSources;
  const hasContext = input.includeContext && Object.values(sources).some(Boolean);
  const common = {
    p_request: input.requestId,
    p_text: input.text,
    p_model: config.AURELIUS_AI_MODEL,
    p_context: hasContext,
    p_prompt_version: input.council ? councilPromptVersion(input.council) : promptVersion,
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
      hasContext ? personalContext(input.text, sources).then(context => selectedContext(context, sources)) : Promise.resolve(null),
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
  // Member Council never requests the founder bridge, even on the founder account.
  const founderContext = null; // Public runtime never retrieves private-founder context.
  return {
    model: config.AURELIUS_AI_MODEL,
    messages: buildMessages(history.filter(turn=>!history.some(newer=>newer.parent_turn_id===turn.id)), input.text, context, new Date(), founderContext, threadSummary, capabilityContext(input.text)),
    founder: founderContext !== null,
    council: input.council,
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

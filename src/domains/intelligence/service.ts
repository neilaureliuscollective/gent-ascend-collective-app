import 'server-only';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { currentAccess } from '@/domains/access/current';
import { aiConfigSchema } from './validation';
import { promptVersion, buildMessages } from './prompt';
import { founderBridgeContext } from './founder-bridge';
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
export async function personalContext(): Promise<PersonalContext> {
  const { client, person } = await intelligenceSession();
  const [goal, memories, daily, profileFacts] = await Promise.all([
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
  ]);
  if (goal.error || memories.error || daily.error || profileFacts.error)
    throw new IntelligenceError('Your personal context could not be loaded.', 503);
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
    memories: (memories.data ?? []).map(({ id, content, kind, confirmed_at }) => ({
      id,
      content,
      kind,
      confirmed_at,
    })),
    daily: (daily.data ?? []).map(({ day, intention, energy, reflection, actions }) => ({day,intention,energy,reflection,actions:actions ?? []})),
    ascendProfile: (profileFacts.data ?? []).filter(fact=>fact.value!==null).map(fact=>({key:fact.fact_key,value:fact.value!,confirmedAt:fact.confirmed_at,source:fact.source_kind})),
  };
}
export async function conversationTurns(id: string) {
  const { client, person } = await intelligenceSession();
  const { data: conversation, error } = await client
    .from('ai_conversations')
    .select('id')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (error) throw new IntelligenceError('Conversation could not be loaded.', 503);
  if (!conversation) throw new IntelligenceError('Conversation not found.', 404);
  const turns = await client
    .from('ai_turns')
    .select('*')
    .eq('conversation_id', id)
    .eq('person_id', person.id)
    .order('created_at', { ascending: true })
    .limit(200);
  if (turns.error) throw new IntelligenceError('Conversation could not be loaded.', 503);
  return turns.data ?? [];
}
export async function readWorkspace(conversationId?: string): Promise<WorkspaceData> {
  const { client, person } = await intelligenceSession();
  const [list, memories, actionProposals, context, access, turns] = await Promise.all([
    client
      .from('ai_conversations')
      .select('*')
      .eq('person_id', person.id)
      .order('updated_at', { ascending: false })
      .limit(100),
    client
      .from('ai_memories')
      .select('*')
      .eq('person_id', person.id)
      .order('confirmed_at', { ascending: false })
      .limit(24),
    client.from('ai_action_proposals').select('*').eq('person_id',person.id).order('proposed_at',{ascending:false}).limit(100),
    personalContext(),
    currentAccess(),
    conversationId ? conversationTurns(conversationId) : Promise.resolve([]),
  ]);
  if (list.error || memories.error || actionProposals.error)
    throw new IntelligenceError('Your workspace could not be loaded.', 503);
  const config = aiConfigSchema.parse(process.env);
  return {
    conversations: list.data ?? [],
    turns,
    memories: memories.data ?? [],
    actionProposals: actionProposals.data ?? [],
    context,
    canChat: access.has('aurelius.context'),
    configured: Boolean(config.OPENAI_API_KEY),
    model: config.AURELIUS_AI_MODEL,
  };
}
export async function prepareReply(input: {
  conversationId: string;
  requestId: string;
  text: string;
  includeContext: boolean;
}) {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError(
      'Aethelios access is not enabled for this account. Local founders can select the Founder scenario.',
      403,
    );
  const config = aiConfigSchema.parse(process.env);
  if (!config.OPENAI_API_KEY)
    throw new IntelligenceError(
      'Aethelios is waiting for its model connection. Your workspace remains available.',
      503,
    );
  const begun = await client.rpc('ai_begin_turn', {
    p_conversation: input.conversationId,
    p_request: input.requestId,
    p_text: input.text,
    p_model: config.AURELIUS_AI_MODEL,
    p_context: input.includeContext,
    p_prompt_version: promptVersion,
  });
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
  try {
    [history, context] = await Promise.all([
      conversationTurns(input.conversationId),
      input.includeContext ? personalContext() : Promise.resolve(null),
    ]);
  } catch {
    await client.rpc('ai_finish_turn', {
      p_request: input.requestId,
      p_text: '',
      p_status: 'failed',
    });
    throw new IntelligenceError(
      'Context could not be loaded. No model request was sent. Reload before trying again.',
      503,
    );
  }
  const founderContext = input.includeContext ? await founderBridgeContext(input.text) : null;
  return {
    model: config.AURELIUS_AI_MODEL,
    messages: buildMessages(history, input.text, context, new Date(), founderContext),
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
      return row.data;
    },
  };
}

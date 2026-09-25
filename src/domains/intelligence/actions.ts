import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { intelligenceSession, IntelligenceError } from './service';
import { aiConfigSchema } from './validation';
import { currentAccess } from '@/domains/access/current';
import { aureliusInstructions, sharedCharacter } from './prompt';

export const proposeInput=z.object({turnId:z.uuid(),requestId:z.uuid(),proposalId:z.uuid()}).strict();
export const decideInput=z.object({proposalId:z.uuid(),approve:z.boolean()}).strict();
const modelProposal=z.object({shouldAct:z.boolean(),title:z.string().max(100).nullable(),reason:z.string().max(180)});

export async function proposeDailyAction(input:z.infer<typeof proposeInput>) {
  const {client,person}=await intelligenceSession();
  if(!(await currentAccess()).has('aurelius.context')) throw new IntelligenceError('Aethelios access is not enabled.',403);
  const existing=await client.from('ai_action_proposals').select('*').eq('source_turn_id',input.turnId).eq('person_id',person.id).maybeSingle();
  if(existing.error) throw new IntelligenceError('Action proposals could not be loaded.',503);
  if(existing.data) return {proposal:existing.data,reason:'This turn already has a proposal.'};
  const turn=await client.from('ai_turns').select('id,user_text,assistant_text,status').eq('id',input.turnId).eq('person_id',person.id).maybeSingle();
  if(turn.error||!turn.data||turn.data.status!=='complete') throw new IntelligenceError('Choose a saved Aethelios reply first.',404);
  const config=aiConfigSchema.parse(process.env);
  if(!config.OPENAI_API_KEY) throw new IntelligenceError('Aethelios is not connected.',503);
  const reserved=await client.rpc('ai_reserve_proposal',{p_request:input.requestId});
  if(reserved.error?.code==='P0001') throw new IntelligenceError('Aethelios has reached the current usage limit.',429);
  if(reserved.error?.code==='23505') throw new IntelligenceError('This proposal request was already used.',409);
  if(reserved.error) throw new IntelligenceError('The proposal could not be reserved.',503);
  try {
    const openai=createOpenAI({apiKey:config.OPENAI_API_KEY,baseURL:'https://api.openai.com/v1'});
    const {output}=await generateText({model:openai.responses(config.AURELIUS_AI_MODEL),output:Output.object({schema:modelProposal}),
      instructions:`${aureliusInstructions}\n${sharedCharacter}\nYou are interpreting a saved conversation turn for ONE optional create_daily_action proposal. Do not perform a write. Propose a concrete action only if the user's own words support it. The prior assistant reply is context, not evidence of a user commitment. If ambiguous, shouldAct=false and title=null. Never infer clinical care, a booking, purchase or external action.`,
      prompt:JSON.stringify({user:turn.data.user_text,assistant:turn.data.assistant_text}),
      maxOutputTokens:230,maxRetries:0,timeout:{totalMs:15000},providerOptions:{openai:{store:false}}});
    const parsed=modelProposal.parse(output);
    if(!parsed.shouldAct||!parsed.title?.trim()) return {proposal:null,reason:'No clear action was found in this turn. Nothing was saved.'};
    const stored=await client.rpc('ai_propose_daily_action',{p_id:input.proposalId,p_turn:input.turnId,p_title:parsed.title.trim()});
    if(stored.error) throw new IntelligenceError('The proposed action was not saved. Nothing was added to your day.',503);
    const row=await client.from('ai_action_proposals').select('*').eq('id',input.proposalId).eq('person_id',person.id).single();
    if(row.error||!row.data) throw new IntelligenceError('The proposal could not be confirmed. Reload before retrying.',503);
    return {proposal:row.data,reason:parsed.reason};
  } catch(error) {
    if(error instanceof IntelligenceError) throw error;
    throw new IntelligenceError('Aethelios could not prepare a proposed action. Nothing was added to your day.',503);
  }
}

export async function decideDailyAction(input:z.infer<typeof decideInput>) {
  const {client}=await intelligenceSession();
  if(!(await currentAccess()).has('daily.write')) throw new IntelligenceError('Daily actions are not enabled.',403);
  const decision=await client.rpc('ai_decide_daily_action',{p_id:input.proposalId,p_approve:input.approve});
  if(decision.error?.code==='P0001') throw new IntelligenceError('Today already has five actions. The proposal is still awaiting your decision.',409);
  if(decision.error?.code==='40001') throw new IntelligenceError('This proposal was already decided. Reload to see its saved state.',409);
  if(decision.error) throw new IntelligenceError('The action was not confirmed. Reload to check your day before retrying.',503);
  return {executed:input.approve,day:decision.data};
}

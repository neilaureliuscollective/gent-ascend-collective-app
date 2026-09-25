import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { authorizedPerson } from '@/domains/access/authorize';
import { currentAccess } from '@/domains/access/current';
import { aiConfigSchema } from '@/domains/intelligence/validation';
import { aureliusInstructions, sharedCharacter } from '@/domains/intelligence/prompt';
import { localDay } from './model';
import { DailyError, readDaily } from './service';

export const reviewFields=z.object({progress:z.string().trim().max(240),blocker:z.string().trim().max(240),tomorrow:z.string().trim().max(240)}).refine(v=>!!(v.progress||v.blocker||v.tomorrow),'Record at least one observation.');
export const reviewProposalInput=z.object({day:z.iso.date(),sourceDayVersion:z.number().int().positive(),requestId:z.uuid()}).strict();
export const reviewConfirmInput=z.object({day:z.iso.date(),sourceDayVersion:z.number().int().positive(),expectedReviewVersion:z.number().int().min(0),requestId:z.uuid(),review:reviewFields}).strict();
const reviewOutput=z.object({progress:z.string().max(240),blocker:z.string().max(240),tomorrow:z.string().max(240)});

export async function proposeReview(input:z.infer<typeof reviewProposalInput>) {
 const owner=await authorizedPerson('daily.read');
 if(!owner) throw new DailyError('Sign in to review your day.',401);
 if(!(await currentAccess()).has('aurelius.context')) throw new DailyError('Aethelios access is not enabled.',403);
 if(input.day!==localDay(new Date(),owner.person.timezone)) throw new DailyError('The local day changed. Reload your day.',409);
 const record=await owner.client.from('daily_entries').select('day,version,intention,reflection,actions:daily_actions(title,done)').eq('person_id',owner.person.id).eq('day',input.day).maybeSingle();
 if(record.error) throw new DailyError('Your day could not be loaded.',503);
 if(!record.data||record.data.version!==input.sourceDayVersion||!record.data.reflection.trim()) throw new DailyError('Save a reflection and reload your current day before asking Aethelios.',409);
 const config=aiConfigSchema.parse(process.env);
 if(!config.OPENAI_API_KEY) throw new DailyError('Aethelios is not connected. You can write your review yourself.',503);
 const reserved=await owner.client.rpc('ai_reserve_proposal',{p_request:input.requestId});
 if(reserved.error?.code==='P0001') throw new DailyError('Aethelios has reached the current usage limit.',429);
 if(reserved.error?.code==='23505') throw new DailyError('This review request was already used. Reload before retrying.',409);
 if(reserved.error) throw new DailyError('The review request could not be reserved.',503);
 try {
  const openai=createOpenAI({apiKey:config.OPENAI_API_KEY,baseURL:'https://api.openai.com/v1'});
  const {output}=await generateText({model:openai.responses(config.AURELIUS_AI_MODEL),output:Output.object({schema:reviewOutput}),
   instructions:`${aureliusInstructions}\n${sharedCharacter}\nDraft an optional evening review from the owner's SAVED daily record. Return short editable observations: progress, blocker and tomorrow context. Only assert a completion if the corresponding action is marked done; if the evidence does not support a field return an empty string. Treat reflections as the person's account, not verified objective fact. No diagnosis, hidden traits, fabricated patterns or automatically created tasks. Do not claim any record was saved.`,
   prompt:JSON.stringify(record.data),maxOutputTokens:350,maxRetries:0,timeout:{totalMs:18000},providerOptions:{openai:{store:false}}});
  const parsed=reviewOutput.parse(output);
  return {review:reviewFields.parse(parsed),sourceDayVersion:record.data.version};
 } catch {throw new DailyError('Aethelios could not prepare a review. Nothing was saved; you can write it yourself.',503);}
}

export async function confirmReview(input:z.infer<typeof reviewConfirmInput>) {
 const owner=await authorizedPerson('daily.write');
 if(!owner) throw new DailyError('Sign in to save your review.',401);
 const result=await owner.client.rpc('daily_confirm_review',{
  p_request:input.requestId,p_day:input.day,p_expected_review_version:input.expectedReviewVersion,
  p_source_day_version:input.sourceDayVersion,p_progress:input.review.progress,p_blocker:input.review.blocker,
  p_tomorrow:input.review.tomorrow,
 });
 if(result.error?.code==='40001'||result.error?.code==='22023') throw new DailyError('Your day or review changed. Reload before confirming.',409);
 if(result.error) throw new DailyError('The review could not be confirmed. Reload your saved day before retrying.',503);
 return readDaily();
}

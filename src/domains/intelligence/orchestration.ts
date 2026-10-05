import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { aiConfigSchema } from './validation';
import { IntelligenceError, intelligenceSession } from './service';
import { currentAccess } from '@/domains/access/current';
import { readPerformance } from '@/domains/performance/service';
import { defaultProfile } from '@/domains/performance/model';
import { planSchema } from '@/domains/performance/schema';

const performanceDraftSchema = z.object({
  title: z.string().trim().min(1).max(80),
  exercises: z.array(z.object({
    name: z.string().trim().min(1).max(70),
    sets: z.number().int().min(1).max(8),
    reps: z.number().int().min(1).max(30),
    load: z.number().min(0).max(1500),
    restSeconds: z.number().int().min(15).max(600),
  }).strict()).min(1).max(12),
}).strict();

const studioDraftSchema = z.object({
  title: z.string().trim().min(1).max(80),
  creativeType: z.enum(['open','brand','campaign','product','personal']),
  brief: z.object({
    purpose: z.string().trim().max(500),
    audience: z.string().trim().max(300),
    direction: z.string().trim().max(700),
    palette: z.string().trim().max(200),
    avoid: z.string().trim().max(400),
  }).strict(),
  prompt: z.string().trim().min(3).max(3000),
}).strict();

export const orchestrationInput = z.object({
  target: z.enum(['performance','studio']),
  text: z.string().trim().min(3).max(6000),
}).strict();

function model() {
  const config = aiConfigSchema.parse(process.env);
  if (!config.OPENAI_API_KEY) throw new IntelligenceError('Aethelios is waiting for its model connection.',503);
  const openai=createOpenAI({apiKey:config.OPENAI_API_KEY,baseURL:'https://api.openai.com/v1'});
  return openai.responses(config.AURELIUS_AI_MODEL);
}

export async function prepareCapabilityDraft(input:z.infer<typeof orchestrationInput>) {
  const { person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context')) throw new IntelligenceError('Aethelios access is not enabled for this account.',403);

  if (input.target === 'performance') {
    const data = await readPerformance();
    if (data.mode !== 'personal' || !data.owner || data.owner !== person.id) throw new IntelligenceError('Performance could not verify this account.',403);
    const profile=data.profile?.data ?? defaultProfile;
    const recent=data.sessions.filter(s=>s.data.status==='complete').slice(0,4).map(s=>({
      title:s.data.title,
      at:s.data.startedAt,
      sets:s.data.sets.filter(set=>set.done).map(set=>({exercise:set.exercise,reps:set.reps,load:set.load})).slice(0,24),
    }));
    const result=await generateText({
      model:model(),
      output:Output.object({schema:performanceDraftSchema,name:'performance_draft',description:'A reviewable workout draft for Gent Ascend Performance.'}),
      instructions:'Create a conservative, practical workout draft from the member request and supplied Performance context. Respect equipment, experience, time and stated limitations. Prefer familiar movements when useful. Missing data is unknown, not permission to invent injuries or capabilities. Do not diagnose, prescribe rehabilitation, or claim the workout is saved. Load 0 means bodyweight or member-selected load. Return only the structured draft.',
      prompt:JSON.stringify({request:input.text,profile,recent}),
      maxOutputTokens:1200,maxRetries:1,timeout:{totalMs:20000},providerOptions:{openai:{store:false}},
    });
    const draft=result.output;
    const plan=planSchema.parse({
      title:draft.title,
      unit:profile.unit,
      exercises:draft.exercises.map(exercise=>({id:crypto.randomUUID(),...exercise})),
    });
    return {target:'performance' as const,ownerId:person.id,plan};
  }

  const result=await generateText({
    model:model(),
    output:Output.object({schema:studioDraftSchema,name:'studio_brief',description:'A reviewable creative brief for Aethelios Studio.'}),
    instructions:'Turn the member request into a concise Studio project seed. Preserve their intent and do not invent brand facts, audiences, claims, logos, people or visual constraints they did not provide. Leave fields blank when unknown. The prompt should be useful for the first creative generation but remain editable. Return only the structured draft.',
    prompt:input.text,
    maxOutputTokens:1000,maxRetries:1,timeout:{totalMs:18000},providerOptions:{openai:{store:false}},
  });
  return {target:'studio' as const,ownerId:person.id,studio:result.output};
}

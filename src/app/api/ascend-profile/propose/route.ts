import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { baselineAnswer, baselineStages, proposedFacts } from '@/domains/ascend-profile/schema';
import { authorizedPerson } from '@/domains/access/authorize';
import { currentAccess } from '@/domains/access/current';
import { aureliusInstructions } from '@/domains/intelligence/prompt';
import { aiConfigSchema } from '@/domains/intelligence/validation';
import { mutationBody } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export const runtime = 'nodejs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request: Request) {
  try {
    const input = baselineAnswer.safeParse(await mutationBody(request));
    if (!input.success) return json({error:'Share an answer of up to 1,500 characters.'},400);
    const owner = await authorizedPerson('profile.read');
    if (!owner) return json({error:'Sign in to begin your profile.'},401);
    if (!(await currentAccess()).has('aurelius.context')) return json({error:'Aethelios is not enabled for this account.'},403);
    const config=aiConfigSchema.parse(process.env);
    if (!config.OPENAI_API_KEY) return json({error:'Aethelios is not connected yet. Your answer remains on this screen.'},503);
    const reserved=await owner.client.rpc('ai_reserve_proposal',{p_request:input.data.requestId});
    if (reserved.error?.code==='P0001') return json({error:'Aethelios has reached the current usage limit. Try again later.'},429);
    if (reserved.error?.code==='23505') return json({error:'This request was already processed. Submit a new one.'},409);
    if (reserved.error) return json({error:'Aethelios could not reserve this request.'},503);
    const stage=baselineStages[input.data.stage];
    if (!stage) return json({error:'Unknown baseline step.'},400);
    const openai=createOpenAI({apiKey:config.OPENAI_API_KEY,baseURL:'https://api.openai.com/v1'});
    const {output}=await generateText({
      model:openai.responses(config.AURELIUS_AI_MODEL),
      output:Output.object({schema:proposedFacts}),
      instructions:`${aureliusInstructions}\nFor this Ascend Profile step, extract only details clearly supported by the user's answer. Allowed keys: ${stage.keys.join(', ')}. Return an empty facts array if there is no durable detail. Write each value as a concise first-person-compatible user fact, not medical interpretation. Mark uncertainty needs_review. You are proposing facts for confirmation; nothing is saved by this model call.`,
      prompt:JSON.stringify({question:stage.prompt,answer:input.data.answer}),
      maxOutputTokens:420,maxRetries:0,timeout:{totalMs:18000},providerOptions:{openai:{store:false}},
    });
    const filtered=proposedFacts.parse(output).facts.filter(fact=>(stage.keys as readonly string[]).includes(fact.key));
    return json({facts:filtered,nextPrompt:baselineStages[input.data.stage+1]?.prompt ?? null});
  } catch(error) {
    if(error instanceof IntelligenceError) return json({error:error.message},error.status);
    return json({error:'Aethelios could not interpret that answer. Nothing was added to your profile.'},503);
  }
}

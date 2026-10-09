import { budgetedFetch } from '@/platform/openai/budget';
import 'server-only';
export class ImageGenerationError extends Error {constructor(message:string,public status=503){super(message);}}
export async function renderImage(prompt:string,model:'gpt-image-2.5-flare'|'gpt-image-2.5-sunburst',size:string,reference?:{bytes:Uint8Array;type:string}){
 const key=process.env.OPENAI_API_KEY;
 if(!key) throw new ImageGenerationError('Image generation is not connected yet.',503);
 const content:({type:'input_text';text:string}|{type:'input_image';image_url:string})[]=[{type:'input_text',text:`Create one image. ${prompt}`}];
 if(reference) content.push({type:'input_image',image_url:`data:${reference.type};base64,${Buffer.from(reference.bytes).toString('base64')}`});
 const response=await budgetedFetch('https://api.openai.com/v1/responses',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({model:process.env.AURELIUS_AI_MODEL||'gpt-6-astra',store:false,
   input:[{role:'user',content}],tool_choice:{type:'image_generation'},
   tools:[{type:'image_generation',model,size,quality:'medium',output_format:'png'}]}),
  signal:AbortSignal.timeout(240000),cache:'no-store',
 });
 if(!response.ok){
  if(response.status===429) throw new ImageGenerationError('Studio is busy. Try again in a moment.',429);
  if(response.status===400||response.status===403) throw new ImageGenerationError('This image request could not be completed. Try a different prompt or reference.',422);
  throw new ImageGenerationError('Image generation is temporarily unavailable.',503);
 }
 const result=await response.json() as {output?:{type:string;result?:string}[]};
 const encoded=result.output?.find(item=>item.type==='image_generation_call')?.result;
 if(!encoded) throw new ImageGenerationError('No image was returned. Try again.',502);
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.length<100||bytes.length>10485760||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  throw new ImageGenerationError('The returned image could not be stored.',502);
 return bytes;
}

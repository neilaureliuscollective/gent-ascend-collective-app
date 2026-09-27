import 'server-only';
import { currentAccess } from '@/domains/access/current';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { z } from 'zod';

export const studioInput=z.object({id:z.uuid(),projectId:z.uuid(),parentId:z.uuid().nullable(),referenceId:z.uuid().nullable(),prompt:z.string().trim().min(3).max(3000),mode:z.enum(['fast','precise']),size:z.enum(['1024x1024','1536x1024','1024x1536'])}).strict();
export const projectInput=z.object({title:z.string().trim().min(1).max(80)}).strict();
const bucket='aethelios-studio';
export async function studioSession(){
 const session=await intelligenceSession();
 if(!(await currentAccess()).has('aurelius.context')) throw new IntelligenceError('Aethelios Studio is not enabled for this account.',403);
 return session;
}
export async function studioWorkspace(projectId?:string){
 const {client,person}=await studioSession();
 const projects=await client.from('ai_studio_projects').select('*').eq('person_id',person.id).order('updated_at',{ascending:false}).limit(100);
 if(projects.error) throw new IntelligenceError('Studio projects could not be loaded.',503);
 const current=projectId ?? projects.data?.[0]?.id;
 if(current && !projects.data?.some(project=>project.id===current)) throw new IntelligenceError('Project not found.',404);
 const [versions,references]=current?await Promise.all([
  client.from('ai_studio_versions').select('*').eq('project_id',current).eq('person_id',person.id).order('created_at',{ascending:false}).limit(100),
  client.from('ai_studio_references').select('*').eq('project_id',current).eq('person_id',person.id).order('created_at',{ascending:false}).limit(30),
 ]):[{data:[],error:null},{data:[],error:null}];
 if(versions.error||references.error) throw new IntelligenceError('Studio history could not be loaded.',503);
 return {projects:projects.data??[],projectId:current??null,versions:versions.data??[],references:references.data??[],configured:Boolean(process.env.OPENAI_API_KEY)};
}
export async function renderImage(prompt:string,model:'gpt-image-2.5-flare'|'gpt-image-2.5-sunburst',size:string,reference?:{bytes:Uint8Array;type:string}){
 const key=process.env.OPENAI_API_KEY;
 if(!key) throw new IntelligenceError('Image generation is not connected yet.',503);
 const content:({type:'input_text';text:string}|{type:'input_image';image_url:string})[]=[{type:'input_text',text:`Create one image. ${prompt}`}];
 if(reference) content.push({type:'input_image',image_url:`data:${reference.type};base64,${Buffer.from(reference.bytes).toString('base64')}`});
 const response=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({model:process.env.AURELIUS_AI_MODEL||'gpt-6-astra',store:false,
   input:[{role:'user',content}],tool_choice:{type:'image_generation'},
   tools:[{type:'image_generation',model,size,quality:'medium',output_format:'png'}]}),
  signal:AbortSignal.timeout(240000),cache:'no-store',
 });
 if(!response.ok){
  if(response.status===429) throw new IntelligenceError('Studio is busy. Try again in a moment.',429);
  if(response.status===400||response.status===403) throw new IntelligenceError('This image request could not be completed. Try a different prompt or reference.',422);
  throw new IntelligenceError('Image generation is temporarily unavailable.',503);
 }
 const result=await response.json() as {output?:{type:string;result?:string}[]};
 const encoded=result.output?.find(item=>item.type==='image_generation_call')?.result;
 if(!encoded) throw new IntelligenceError('No image was returned. Try again.',502);
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.length<100||bytes.length>10485760||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  throw new IntelligenceError('The returned image could not be stored.',502);
 return bytes;
}
export async function generateStudio(input:z.infer<typeof studioInput>){
 const {client,person}=await studioSession();
 const model=input.mode==='fast'?'gpt-image-2.5-flare':'gpt-image-2.5-sunburst';
 const begun=await client.rpc('ai_studio_begin',{p_id:input.id,p_project:input.projectId,p_parent:input.parentId,p_reference:input.referenceId,p_prompt:input.prompt,p_model:model,p_size:input.size});
 if(begun.error) throw new IntelligenceError('Project, reference, or generation limit could not be verified.',begun.error.code==='P0001'?429:409);
 if(!begun.data) throw new IntelligenceError('This request was already submitted. Refresh the project.',409);
 let key:string|null=null;
 try{
  let reference: {bytes:Uint8Array;type:string}|undefined;
  const source=input.referenceId ? await client.from('ai_studio_references').select('storage_key,media_type').eq('person_id',person.id).eq('project_id',input.projectId).eq('id',input.referenceId).single() :
   input.parentId ? await client.from('ai_studio_versions').select('storage_key').eq('person_id',person.id).eq('project_id',input.projectId).eq('id',input.parentId).eq('status','complete').single() : null;
  if(source){
   if(source.error||!source.data?.storage_key) throw new IntelligenceError('Reference image is unavailable.',404);
   const data=await client.storage.from(bucket).download(source.data.storage_key);
   if(data.error||!data.data) throw new IntelligenceError('Reference image could not be loaded.',503);
   reference={bytes:new Uint8Array(await data.data.arrayBuffer()),type:'media_type' in source.data && typeof source.data.media_type==='string'?source.data.media_type:'image/png'};
  }
  const image=await renderImage(input.prompt,model,input.size,reference);
  key=`${(await client.auth.getUser()).data.user?.id}/${input.projectId}/${input.id}.png`;
  if(key.startsWith('undefined/')) throw new IntelligenceError('Session expired.',401);
  const upload=await client.storage.from(bucket).upload(key,image,{contentType:'image/png',upsert:false,cacheControl:'private, no-store'});
  if(upload.error) throw new IntelligenceError('Image could not be saved. Try again.',503);
  const finish=await client.rpc('ai_studio_finish',{p_id:input.id,p_status:'complete',p_key:key});
  if(finish.error||!finish.data) throw new IntelligenceError('Image could not be added to the project.',503);
  return {id:input.id};
 }catch(error){
  if(key) await client.storage.from(bucket).remove([key]);
  await client.rpc('ai_studio_finish',{p_id:input.id,p_status:'failed',p_failure:'generation_failed'});
  throw error;
 }
}
export async function imageBlob(id:string,kind:'version'|'reference'){
 const {client,person}=await studioSession();
 const result=kind==='version'?
  await client.from('ai_studio_versions').select('storage_key').eq('id',id).eq('person_id',person.id).eq('status','complete').single():
  await client.from('ai_studio_references').select('storage_key').eq('id',id).eq('person_id',person.id).single();
 if(result.error||!result.data?.storage_key) throw new IntelligenceError('Image not found.',404);
 const image=await client.storage.from(bucket).download(result.data.storage_key);
 if(image.error||!image.data) throw new IntelligenceError('Image unavailable.',503);
 return image.data;
}
export {bucket};

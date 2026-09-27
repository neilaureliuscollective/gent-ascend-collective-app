import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { generateStudio, projectInput, studioInput, studioSession, studioWorkspace } from '@/domains/studio/service';
import { IntelligenceError } from '@/domains/intelligence/service';
import { z } from 'zod';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 try {const id=new URL(request.url).searchParams.get('project');if(id&&!z.uuid().safeParse(id).success) throw new IntelligenceError('Invalid project.');return privateJson(await studioWorkspace(id??undefined));}
 catch(error){return apiError(error);}
}
export async function POST(request:Request){
 try {const body=await mutationBody(request);const project=projectInput.safeParse(body);
  if(project.success){const {client,person}=await studioSession();const id=crypto.randomUUID();const result=await client.from('ai_studio_projects').insert({id,person_id:person.id,title:project.data.title}).select('id').single();if(result.error) throw new IntelligenceError('Project could not be created.',503);return privateJson({id},201);}
  const input=studioInput.safeParse(body);if(!input.success) throw new IntelligenceError('Check the Studio request.');
  return privateJson(await generateStudio(input.data),201);
 }catch(error){return apiError(error);}
}

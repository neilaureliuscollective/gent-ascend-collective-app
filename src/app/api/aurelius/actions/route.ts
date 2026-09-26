import { revalidatePath } from 'next/cache';
import { mutationBody,apiError,privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { proposeInput,decideInput,proposeDailyAction,decideDailyAction } from '@/domains/intelligence/actions';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    const input=proposeInput.safeParse(await mutationBody(request));
    if(!input.success) throw new IntelligenceError('Choose a saved Aethelios turn.');
    return privateJson(await proposeDailyAction(input.data));
  } catch(error) {return apiError(error);}
}
export async function PUT(request:Request) {
  try {
    const input=decideInput.safeParse(await mutationBody(request));
    if(!input.success) throw new IntelligenceError('Invalid action decision.');
    const result=await decideDailyAction(input.data);
    revalidatePath('/app');revalidatePath('/app/progress');
    return privateJson(result);
  } catch(error) {return apiError(error);}
}

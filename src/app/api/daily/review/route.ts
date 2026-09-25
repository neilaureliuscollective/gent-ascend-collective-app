import { revalidatePath } from 'next/cache';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { DailyError } from '@/domains/daily/service';
import { IntelligenceError } from '@/domains/intelligence/service';
import { reviewProposalInput,reviewConfirmInput,proposeReview,confirmReview } from '@/domains/daily/review';
export const runtime='nodejs';
function fail(error:unknown) {return privateJson({error:error instanceof DailyError||error instanceof IntelligenceError?error.message:'Your review could not be processed.'},error instanceof DailyError||error instanceof IntelligenceError?error.status:503);}
export async function POST(request:Request) {
 try {const parsed=reviewProposalInput.safeParse(await mutationBody(request));if(!parsed.success) throw new DailyError('Invalid review request.');return privateJson(await proposeReview(parsed.data));}
 catch(error){return fail(error);}
}
export async function PUT(request:Request) {
 try {const parsed=reviewConfirmInput.safeParse(await mutationBody(request));if(!parsed.success) throw new DailyError('Review at least one field before saving.');const data=await confirmReview(parsed.data);revalidatePath('/');revalidatePath('/progress');return privateJson(data);}
 catch(error){return fail(error);}
}

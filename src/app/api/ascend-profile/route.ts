import { revalidatePath } from 'next/cache';
import { confirmedFact } from '@/domains/ascend-profile/schema';
import { confirmAscendFact, readAscendProfile, ProfileStateError } from '@/domains/ascend-profile/service';
import { mutationBody } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
const json = (body: unknown,status=200) => Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail = (error: unknown) => json({error:error instanceof ProfileStateError || error instanceof IntelligenceError ? error.message : 'Your profile could not be loaded.'},error instanceof ProfileStateError || error instanceof IntelligenceError ? error.status : 503);
export async function GET() { try { return json(await readAscendProfile()); } catch(error) { return fail(error); } }
export async function PUT(request: Request) {
  try {
    const parsed = confirmedFact.safeParse(await mutationBody(request));
    if (!parsed.success) throw new ProfileStateError('Review this detail before saving.');
    const saved = await confirmAscendFact(parsed.data);
    revalidatePath('/app'); revalidatePath('/app/you'); revalidatePath('/app/ascend-profile');
    return json(saved);
  } catch(error) { return fail(error); }
}

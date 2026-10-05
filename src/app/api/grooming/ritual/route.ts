import { revalidatePath } from 'next/cache';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { groomingError } from '@/domains/grooming/http';
import { saveReviewedRitual } from '@/domains/grooming/ritual';
export async function POST(request: Request) {
  try {
    const result = await saveReviewedRitual(await mutationBody(request, 4096));
    revalidatePath('/app/grooming');
    return privateJson(result);
  } catch (error) {
    return groomingError(error);
  }
}

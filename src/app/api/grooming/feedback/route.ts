import { revalidatePath } from 'next/cache';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { groomingError } from '@/domains/grooming/http';
import { savePracticeFeedback } from '@/domains/grooming/ritual';
export async function POST(request: Request) {
  try {
    const result = await savePracticeFeedback(await mutationBody(request, 1024));
    revalidatePath('/app/grooming');
    return privateJson(result);
  } catch (error) {
    return groomingError(error);
  }
}

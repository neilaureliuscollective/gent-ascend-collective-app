import { revalidatePath } from 'next/cache';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { groomingError } from '@/domains/grooming/http';
import { GroomingError } from '@/domains/grooming/service';
import { practiceInput } from '@/domains/grooming/world-model';
import { readGroomingWorld, recordWorldPractice } from '@/domains/grooming/world';
export async function GET() {
  try {
    return privateJson(await readGroomingWorld());
  } catch (error) {
    return groomingError(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = practiceInput.safeParse(await mutationBody(request, 1024));
    if (!input.success) throw new GroomingError('Invalid practice request.');
    const receipt = await recordWorldPractice(input.data);
    revalidatePath('/app/grooming');
    return privateJson(receipt);
  } catch (error) {
    return groomingError(error);
  }
}

import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { apiError, privateJson } from '@/domains/intelligence/http';
import { readVoicePersistence } from '@/domains/live/persistence';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const conversationId = z.uuid().safeParse(params.get('conversationId'));
    const sessionId = z.uuid().safeParse(params.get('sessionId'));
    if (!conversationId.success || !sessionId.success)
      throw new IntelligenceError('Invalid voice receipt request.');
    return privateJson(await readVoicePersistence(conversationId.data, sessionId.data));
  } catch (error) {
    return apiError(error);
  }
}

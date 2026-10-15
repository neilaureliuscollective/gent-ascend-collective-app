import { z } from 'zod';
import { readHealthBridge, verifyHealthOwner } from '@/domains/health/service';
import { apiError, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    await verifyHealthOwner(request);
    const token = z.uuid().safeParse(request.headers.get('x-aethelios-health-bridge'));
    if (!token.success) throw new IntelligenceError('Health bridge unavailable.', 403);
    return privateJson(await readHealthBridge(token.data));
  } catch (error) {
    return apiError(error);
  }
}

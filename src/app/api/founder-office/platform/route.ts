import { founderSession } from '@/domains/founder-office/service';
import { inspectPlatform } from '@/domains/founder-office/platform';
import { privateJson, apiError } from '@/domains/intelligence/http';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET() {
  try {
    await founderSession();
    return privateJson(await inspectPlatform());
  } catch (error) {
    return apiError(error);
  }
}

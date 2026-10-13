import { z } from 'zod';
import {
  readConstructConnectionSource,
  readConstructPinnedSource,
} from '@/domains/architect-construct/connections-source';
import { apiError, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export const maxDuration = 15;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    const sha = url.searchParams.get('sha');
    if (path || sha) {
      if (!path || !sha) throw new IntelligenceError('Pinned source reads require path and exact commit.');
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new IntelligenceError('Pinned source reads require an exact commit.');
      if (!z.string().min(1).max(240).safeParse(path).success)
        throw new IntelligenceError('That source path is not allowed.');
      return privateJson({
        access: 'read-only',
        publishing: false,
        deployment: false,
        file: await readConstructPinnedSource(path, sha),
      });
    }
    return privateJson(await readConstructConnectionSource());
  } catch (error) {
    return apiError(error);
  }
}

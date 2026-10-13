import 'server-only';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import {
  architectConnectionReadiness,
  architectPinnedSource,
} from '@/domains/connections/architect';
import { ConnectionError } from '@/domains/connections/errors';
import { founderConnectionStore } from '@/domains/connections/store';

/**
 * Narrow Construct adapter over Connections' owner-scoped reads.
 * Does not queue jobs, commit, publish, or deploy.
 */
export type ConstructSourceReadiness = {
  access: 'read-only';
  publishing: false;
  deployment: false;
  github: {
    ready: boolean;
    repository: { owner: string; name: string; id: number; fullName: string } | null;
    reason: string;
  };
  vercel: {
    ready: boolean;
    project: { id: string; name: string } | null;
    reason: string;
  };
};

function asIntelligence(error: unknown): never {
  if (error instanceof IntelligenceError) throw error;
  if (error instanceof ConnectionError)
    throw new IntelligenceError(error.message, error.status);
  throw new IntelligenceError(
    error instanceof Error ? error.message : 'Connection source unavailable.',
    503,
  );
}

export async function readConstructConnectionSource(): Promise<ConstructSourceReadiness> {
  try {
    const { person, client } = await intelligenceSession();
    const store = founderConnectionStore(person.id, client);
    const ready = await architectConnectionReadiness(person.id, store);
    return {
      access: 'read-only',
      publishing: false,
      deployment: false,
      github: ready.github,
      vercel: ready.vercel,
    };
  } catch (error) {
    if (error instanceof IntelligenceError && error.status === 401) throw error;
    if (error instanceof ConnectionError && error.status === 403)
      throw new IntelligenceError(error.message, 403);
    return {
      access: 'read-only',
      publishing: false,
      deployment: false,
      github: {
        ready: false,
        repository: null,
        reason:
          error instanceof Error
            ? error.message
            : 'Connections is not configured. Construct can still use a labelled imported or fixture snapshot.',
      },
      vercel: {
        ready: false,
        project: null,
        reason: 'Vercel publishing and deployment are not available from Construct.',
      },
    };
  }
}

export async function readConstructPinnedSource(path: string, sha: string) {
  try {
    const { person, client } = await intelligenceSession();
    const store = founderConnectionStore(person.id, client);
    return await architectPinnedSource(person.id, store, path, sha);
  } catch (error) {
    asIntelligence(error);
  }
}

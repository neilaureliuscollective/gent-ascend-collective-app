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

export async function verifyConstructGitPin(input: {
  repository: string | null;
  commit: string;
  files: { path: string; content: string }[];
}) {
  try {
    const { person, client } = await intelligenceSession();
    const store = founderConnectionStore(person.id, client);
    const ready = await architectConnectionReadiness(person.id, store);
    if (!ready.github.ready || !ready.github.repository)
      throw new IntelligenceError(
        ready.github.reason || 'A selected owner-authorized repository is required to claim a Git pin.',
        409,
      );
    if (!input.repository || input.repository !== ready.github.repository.fullName)
      throw new IntelligenceError(
        'Git pin repository does not match the selected owner-authorized repository.',
        409,
      );
    if (!/^[a-f0-9]{40}$/.test(input.commit))
      throw new IntelligenceError('Pinned source reads require an exact commit.', 400);
    if (!input.files.length)
      throw new IntelligenceError('Source snapshot has no files. Missing source is a blocker.', 409);
    const files: { path: string; content: string }[] = [];
    for (const file of input.files) {
      const pinned = await architectPinnedSource(person.id, store, file.path, input.commit);
      if (pinned.content !== file.content)
        throw new IntelligenceError(
          'Claimed Git file content does not match the selected repository pin.',
          409,
        );
      files.push({ path: pinned.path, content: pinned.content });
    }
    return {
      repository: ready.github.repository.fullName,
      commit: input.commit,
      files,
      verified: true as const,
    };
  } catch (error) {
    asIntelligence(error);
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

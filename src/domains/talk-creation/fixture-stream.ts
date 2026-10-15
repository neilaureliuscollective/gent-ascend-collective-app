import { setTimeout as delay } from 'node:timers/promises';
import type { ModelChunk } from '@/domains/intelligence/stream';
import type { TalkAgentSession } from './tools';
import { legacyReserveBoard, refineSelectedDirection, selectDesignDirection } from './design-board';

export function talkCreationFixtureEnabled() {
  if (
    process.env.AETHELIOS_TALK_CREATION_FIXTURE !== 'legacy-reserve' ||
    process.env.NODE_ENV !== 'development' ||
    process.env.APP_ENV !== 'local' ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV
  )
    return false;
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Labelled deterministic model stand-in. Persists through normal Talk orchestration. */
export async function* streamTalkCreationFixture(
  creation: TalkAgentSession,
  signal?: AbortSignal,
): AsyncGenerator<ModelChunk> {
  const text = creation.userText;
  // Explicit synthetic scenarios exercise real stream/persistence orchestration.
  if (text.includes('[slow-stream]')) {
    yield { type: 'text', text: 'Labelled deterministic Talk fixture: streaming' };
    for (let index = 0; index < 30; index++) {
      await delay(100, undefined, { signal });
      yield { type: 'text', text: ` chunk ${index + 1}` };
    }
    yield { type: 'finish', reason: 'stop' };
    return;
  }
  if (text.includes('[fail-stream]')) throw new Error('Synthetic transport failure');
  if (/warmer|refine/i.test(text)) {
    creation.offered.push({
      board: refineSelectedDirection(selectDesignDirection(legacyReserveBoard(), 'direction-c'), {
        warmer: true,
      }),
    });
    yield {
      type: 'text',
      text: 'Labelled deterministic Talk fixture. The selected direction is warmer. Other directions stay as saved.',
    };
  } else {
    creation.offered.push({ board: legacyReserveBoard() });
    yield {
      type: 'text',
      text: 'Labelled deterministic Talk fixture. Three Legacy Reserve directions are on the board.',
    };
  }
  yield {
    type: 'creation',
    item: {
      id: creation.requestId,
      kind: 'board',
      title: 'Legacy Reserve directions',
      status: 'offered',
    },
  };
  yield { type: 'finish', reason: 'stop' };
}

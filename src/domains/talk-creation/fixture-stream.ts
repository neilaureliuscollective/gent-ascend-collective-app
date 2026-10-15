import type { ModelChunk } from '@/domains/intelligence/stream';
import type { TalkAgentSession } from './tools';
import {
  legacyReserveBoard,
  refineSelectedDirection,
  selectDesignDirection,
} from './design-board';

export function talkCreationFixtureEnabled() {
  return process.env.AETHELIOS_TALK_CREATION_FIXTURE === 'legacy-reserve';
}

/** Labelled deterministic model stand-in. Persists through normal Talk orchestration. */
export async function* streamTalkCreationFixture(
  creation: TalkAgentSession,
): AsyncGenerator<ModelChunk> {
  const text = creation.userText;
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
    item: { id: creation.requestId, kind: 'board', title: 'Legacy Reserve directions', status: 'offered' },
  };
  yield { type: 'finish', reason: 'stop' };
}

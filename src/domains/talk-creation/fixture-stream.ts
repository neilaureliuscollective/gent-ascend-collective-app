import type { ModelChunk } from '@/domains/intelligence/stream';
import type { TalkAgentSession } from './tools';
import {
  legacyReserveBoard,
  lifestyleLaunchBoard,
  refineSelectedDirection,
  selectDesignDirection,
} from './design-board';

export function talkCreationFixtureEnabled() {
  const value = process.env.AETHELIOS_TALK_CREATION_FIXTURE;
  return value === 'legacy-reserve' || value === 'lifestyle-launch';
}

function fixtureBoard() {
  return process.env.AETHELIOS_TALK_CREATION_FIXTURE === 'lifestyle-launch'
    ? lifestyleLaunchBoard()
    : legacyReserveBoard();
}

/** Labelled deterministic model stand-in. Persists through normal Talk orchestration. */
export async function* streamTalkCreationFixture(
  creation: TalkAgentSession,
): AsyncGenerator<ModelChunk> {
  const text = creation.userText;
  const board = fixtureBoard();
  const product =
    process.env.AETHELIOS_TALK_CREATION_FIXTURE === 'lifestyle-launch'
      ? 'Aethelios Lifestyle'
      : 'Legacy Reserve';
  if (/warmer|refine/i.test(text)) {
    creation.offered.push({
      board: refineSelectedDirection(selectDesignDirection(board, 'direction-c'), {
        warmer: true,
      }),
    });
    yield {
      type: 'text',
      text: `Labelled deterministic Talk fixture. The selected direction is warmer. Other directions stay as saved.`,
    };
  } else if (/brief|launch idea|document/i.test(text)) {
    creation.offered.push({
      brief: {
        title: `${product} launch`,
        purpose: 'Introduce the line with a precise visual direction and honest claims.',
        audience: 'Founders reviewing Aethelios Lifestyle.',
        visualDirection: 'Obsidian, emerald glass and restrained gold.',
        requirements: ['Phone-first reading', 'Preserve unused directions'],
        unresolved: ['Final merchandising copy'],
      },
    });
    yield {
      type: 'text',
      text: 'Labelled deterministic Talk fixture. An editable launch brief is on the board.',
    };
  } else {
    creation.offered.push({ board });
    yield {
      type: 'text',
      text: `Labelled deterministic Talk fixture. Three ${product} directions are on the board.`,
    };
  }
  yield {
    type: 'creation',
    item: {
      id: creation.requestId,
      kind: creation.offered[0]?.brief ? 'brief' : 'board',
      title: creation.offered[0]?.brief?.title ?? `${product} directions`,
      status: 'offered',
    },
  };
  yield { type: 'finish', reason: 'stop' };
}

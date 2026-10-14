import { expect, it } from 'vitest';
import { legacyReserveBoard } from '@/domains/talk-creation/design-board';
import {
  designDirectionAdapter,
  produceDesignDirection,
  transferDesignDirectionLocal,
} from '@/domains/talk-creation/design-direction';

const conversation = '30000000-0000-4000-8000-000000000001';
const boardId = '50000000-0000-4000-8000-000000000011';
const request = '80000000-0000-4000-8000-000000000011';

it('produces a local-test design-direction manifest and does not claim Architect import', () => {
  const manifest = produceDesignDirection({
    conversationId: conversation,
    boardId,
    version: 2,
    board: legacyReserveBoard(),
  });
  expect(manifest.adapter).toBe(designDirectionAdapter);
  expect(manifest.source.directionId).toBe('direction-b');
  expect(manifest.digest).toMatch(/^[a-f0-9]{64}$/);
  const store = new Map();
  const first = transferDesignDirectionLocal(store, request, manifest);
  expect(first.imported).toBe(false);
  expect(first.connectedReceiver).toBe(false);
  expect(first.projectId).toBeNull();
  const retry = transferDesignDirectionLocal(store, request, manifest);
  expect(retry).toEqual(first);
  expect(store.size).toBe(1);
});

import { expect, it } from 'vitest';
import { DESIGN_DIRECTION_SCHEMA } from '@/domains/architect-design-direction/contract';
import { selectDesignDirection, legacyReserveBoard } from '@/domains/talk-creation/design-board';
import {
  directionIdentity,
  produceArchitectDirection,
  unsupportedTalkFields,
} from '@/domains/talk-creation/architect-direction';

const conversation = '30000000-0000-4000-8000-000000000001';
const boardId = '50000000-0000-4000-8000-000000000011';

it('maps the selected Talk board onto the Architect talk-architect-direction/v1 contract', () => {
  const board = selectDesignDirection(legacyReserveBoard(), 'direction-c');
  const receipt = produceArchitectDirection({
    conversationId: conversation,
    boardId,
    version: 2,
    board,
  });
  expect(receipt.schema).toBe(DESIGN_DIRECTION_SCHEMA);
  expect(receipt.identity.directionId).toBe(directionIdentity(boardId, 'direction-c'));
  expect(receipt.content.colors.some((color) => color.role === 'canvas')).toBe(true);
  expect(receipt.content.demo.kind).toBe('none');
  expect(receipt.content.demo.note).toMatch(/hero-product/);
  expect(unsupportedTalkFields).toContain('hero-product demonstration');
  expect(receipt.digest).toMatch(/^[0-9a-f]{64}$/);
});

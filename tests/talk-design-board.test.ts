import { expect, it } from 'vitest';
import {
  adjustDesignSwatch,
  bindOfferedBoard,
  legacyReserveBoard,
  refineSelectedDirection,
  selectDesignDirection,
  selectedDirection,
} from '@/domains/talk-creation/design-board';
import { offeredTextSchema } from '@/domains/talk-creation/schema';

it('offers three distinct Legacy Reserve directions with labelled demo packaging', () => {
  const board = legacyReserveBoard();
  expect(board.directions).toHaveLength(3);
  expect(board.directions.map((item) => item.id)).toEqual([
    'direction-a',
    'direction-b',
    'direction-c',
  ]);
  expect(new Set(board.directions.map((item) => item.tokens.material)).size).toBe(3);
  expect(selectedDirection(board).id).toBe('direction-b');
  expect(selectedDirection(board).demo.productLabel).toMatch(/Demonstration packaging/);
  expect(selectedDirection(board).copy.disclaimer).toMatch(/Not an approved claim/);
  expect(offeredTextSchema.parse({ board }).board?.title).toBe('Legacy Reserve directions');
});

it('updates the selected direction immediately and preserves the others and prior identity', () => {
  const board = legacyReserveBoard();
  const selected = selectDesignDirection(board, 'direction-b');
  const warmer = refineSelectedDirection(selected, { warmer: true });
  const swatch = adjustDesignSwatch(warmer, {
    directionId: 'direction-b',
    role: 'highlight',
    hex: '#D4A84A',
  });
  expect(swatch.selectedDirectionId).toBe('direction-b');
  expect(selectedDirection(swatch).tokens.colors.find((item) => item.role === 'highlight')?.hex).toBe(
    '#D4A84A',
  );
  expect(swatch.directions.find((item) => item.id === 'direction-a')).toEqual(
    board.directions.find((item) => item.id === 'direction-a'),
  );
  expect(swatch.directions.find((item) => item.id === 'direction-c')).toEqual(
    board.directions.find((item) => item.id === 'direction-c'),
  );
});

it('binds a typed replacement board to the selected direction only', () => {
  const current = selectDesignDirection(legacyReserveBoard(), 'direction-c');
  const offered = structuredClone(current);
  offered.directions = offered.directions.map((item) => ({
    ...item,
    name: item.id === 'direction-c' ? 'Emerald Glass warmer' : 'Should not survive',
  }));
  const bound = bindOfferedBoard(current, offered);
  expect(bound.directions.find((item) => item.id === 'direction-a')?.name).toBe('Graphite Chamber');
  expect(bound.directions.find((item) => item.id === 'direction-b')?.name).toBe('Warm Reserve');
  expect(bound.directions.find((item) => item.id === 'direction-c')?.name).toBe('Emerald Glass warmer');
});

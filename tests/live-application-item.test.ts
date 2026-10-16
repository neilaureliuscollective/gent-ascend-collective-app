import { expect, it } from 'vitest';
import { formatApplicationLiveItem, isApplicationLiveItem } from '@/domains/live/application-item';
it('recognizes only the exact compact application namespace and legacy context IDs', () => {
  expect(isApplicationLiveItem(formatApplicationLiveItem(new Uint8Array(16)))).toBe(true);
  expect(isApplicationLiveItem('ctx_legacy')).toBe(true);
  for (const id of [
    'c',
    'call_ordinary',
    'conversation_ordinary',
    'c' + '0'.repeat(24),
    'c' + '0'.repeat(26),
    'c' + 'A'.repeat(25),
    'c' + 'z'.repeat(25),
    'item_provider',
    null,
    {},
    'Application context',
  ])
    expect(isApplicationLiveItem(id)).toBe(false);
});
it('preserves the existing compact ID encoding used by server seed acknowledgement matching', () => {
  expect(formatApplicationLiveItem(new Uint8Array(16))).toBe('c' + '0'.repeat(25));
  expect(formatApplicationLiveItem(new Uint8Array(16).fill(255))).toBe(
    'c' + ((1n << 128n) - 1n).toString(36),
  );
  expect(() => formatApplicationLiveItem(new Uint8Array(15))).toThrow();
});

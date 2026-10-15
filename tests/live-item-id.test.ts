import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('node:crypto', async (original) => {
  const crypto = await original<typeof import('node:crypto')>();
  return { ...crypto, randomBytes: vi.fn(crypto.randomBytes) };
});
import { randomBytes } from 'node:crypto';
import { createLiveItemId } from '@/domains/live/item-id';
afterEach(() => vi.mocked(randomBytes).mockClear());
it('generates compact letter-led alphanumeric IDs with independent 128-bit randomness', () => {
  const ids = Array.from({ length: 10000 }, createLiveItemId);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(id).toMatch(/^c[0-9a-z]{25}$/);
    expect(id).toHaveLength(26);
  }
  expect(randomBytes).toHaveBeenCalledTimes(ids.length);
  expect(randomBytes).toHaveBeenCalledWith(16);
});
it('preserves all 128 entropy bits, leading zeroes and a fixed length without truncation', () => {
  const bytes = [
    Buffer.alloc(16),
    Buffer.from('01000000000000000000000000000000', 'hex'),
    Buffer.alloc(16, 255),
  ];
  for (const buffer of bytes) {
    vi.mocked(randomBytes).mockReturnValueOnce(buffer as never);
    const id = createLiveItemId();
    expect(id).toHaveLength(26);
    let decoded = 0n;
    for (const char of id.slice(1)) decoded = decoded * 36n + BigInt(parseInt(char, 36));
    expect(decoded).toBe(BigInt(`0x${buffer.toString('hex')}`));
  }
});

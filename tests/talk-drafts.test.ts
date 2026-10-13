import { describe, expect, it } from 'vitest';
import { clearTalkDrafts, readTalkDraft, writeTalkDraft } from '@/platform/conversation/drafts';
function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}
describe('tab-local unsent Talk recovery', () => {
  it('keeps conversations separate and clears cross-account text before restoration', () => {
    const store = memory();
    writeTalkDraft('a', null, 'new draft', store, 1000);
    writeTalkDraft('a', 'thread', 'thread draft', store, 1000);
    expect(readTalkDraft('a', null, store, 1001)).toBe('new draft');
    expect(readTalkDraft('a', 'thread', store, 1001)).toBe('thread draft');
    expect(readTalkDraft('b', 'thread', store, 1001)).toBe('');
    expect(readTalkDraft('a', 'thread', store, 1002)).toBe('');
  });
  it('expires drafts, caps content and removes discarded/submitted drafts', () => {
    const store = memory();
    writeTalkDraft('a', 'thread', 'x'.repeat(7000), store, 0);
    expect(readTalkDraft('a', 'thread', store, 1)).toHaveLength(6000);
    expect(readTalkDraft('a', 'thread', store, 86400000)).toBe('');
    writeTalkDraft('a', null, 'thought', store, 100);
    writeTalkDraft('a', null, '', store, 101);
    expect(readTalkDraft('a', null, store, 102)).toBe('');
    writeTalkDraft('a', null, 'thought', store, 103);
    clearTalkDrafts(store);
    expect(readTalkDraft('a', null, store, 104)).toBe('');
  });
  it('keeps input usable when storage is unavailable or malformed', () => {
    const store = {
      getItem: () => '{',
      setItem: () => {
        throw Error('quota');
      },
      removeItem: () => {
        throw Error('blocked');
      },
    };
    expect(readTalkDraft('a', null, store)).toBe('');
    expect(() => writeTalkDraft('a', null, 'draft', store)).not.toThrow();
    expect(() => clearTalkDrafts(store)).not.toThrow();
  });
});

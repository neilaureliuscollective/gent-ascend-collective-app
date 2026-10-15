import { afterEach, expect, it, vi } from 'vitest';
import {
  hasLiveAcknowledgement,
  saveLiveAcknowledgement,
  liveAcknowledgementKey,
  liveAcknowledgementVersion,
} from '@/domains/live/acknowledgement';
afterEach(() => vi.unstubAllGlobals());
it('remembers only the current version for the authenticated user', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key),
    setItem: (key: string, value: string) => data.set(key, value),
  });
  data.set(liveAcknowledgementKey('new-user'), 'audio-transcript.old');
  expect(hasLiveAcknowledgement('new-user')).toBe(false);
  expect(hasLiveAcknowledgement(null)).toBe(false);
  saveLiveAcknowledgement('new-user');
  expect(data.get(liveAcknowledgementKey('new-user'))).toBe(liveAcknowledgementVersion);
  expect(hasLiveAcknowledgement('new-user')).toBe(true);
  expect(hasLiveAcknowledgement('different-user')).toBe(false);
  saveLiveAcknowledgement(null);
  expect(data.size).toBe(1);
});
it('retains a user-scoped page acknowledgement when device storage is unavailable', () => {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  });
  saveLiveAcknowledgement('storage-disabled');
  expect(hasLiveAcknowledgement('storage-disabled')).toBe(true);
  expect(hasLiveAcknowledgement('another-user')).toBe(false);
});

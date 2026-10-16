import { expect, it } from 'vitest';
import { liveComposerLimit, talkComposerSendRoute } from '@/domains/live/limits';

it('routes typed send through voice only while a live call can accept it', () => {
  expect(talkComposerSendRoute('listening')).toBe('voice');
  expect(talkComposerSendRoute('speaking')).toBe('voice');
  expect(talkComposerSendRoute('connecting')).toBe('hold');
  expect(talkComposerSendRoute('ended')).toBe('text');
  expect(talkComposerSendRoute('error')).toBe('text');
  expect(talkComposerSendRoute('idle')).toBe('text');
});

it('keeps the ordinary text limit after voice ends or fails', () => {
  expect(liveComposerLimit('listening')).toBe(4000);
  expect(liveComposerLimit('ended')).toBe(6000);
  expect(liveComposerLimit('error')).toBe(6000);
  expect(liveComposerLimit('idle')).toBe(6000);
});

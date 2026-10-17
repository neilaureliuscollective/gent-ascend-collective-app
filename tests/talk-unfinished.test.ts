import { describe, expect, it } from 'vitest';
import {
  beginTalkEditSnapshot,
  hasUnfinishedTalkWork,
  revisionAllowedForConversation,
  snapshotBelongsToConversation,
  unfinishedTalkWorkPrompt,
} from '@/platform/conversation/unfinished';

const owner = '60000000-0000-4000-8000-000000000001';
const conversationA = '30000000-0000-4000-8000-000000000001';
const conversationB = '30000000-0000-4000-8000-000000000002';

describe('Talk unfinished composer work', () => {
  it('treats attachment-only drafts, in-flight uploads and edits as unfinished', () => {
    expect(
      hasUnfinishedTalkWork({ draft: '', attachment: null, attachmentBusy: false, revision: null }),
    ).toBe(false);
    expect(
      hasUnfinishedTalkWork({
        draft: '  ',
        attachment: null,
        attachmentBusy: false,
        revision: null,
      }),
    ).toBe(false);
    expect(
      hasUnfinishedTalkWork({
        draft: '',
        attachment: { id: 'image-1' },
        attachmentBusy: false,
        revision: null,
      }),
    ).toBe(true);
    expect(
      hasUnfinishedTalkWork({ draft: '', attachment: null, attachmentBusy: true, revision: null }),
    ).toBe(true);
    expect(
      hasUnfinishedTalkWork({
        draft: '',
        attachment: null,
        attachmentBusy: false,
        revision: { sourceTurnId: 'turn-1' },
      }),
    ).toBe(true);
    expect(
      hasUnfinishedTalkWork({
        draft: 'Keep this',
        attachment: null,
        attachmentBusy: false,
        revision: null,
      }),
    ).toBe(true);
  });

  it('keeps Switch and New prompts distinct without inventing a save', () => {
    expect(unfinishedTalkWorkPrompt('switch')).toContain('switch conversations');
    expect(unfinishedTalkWorkPrompt('new')).toContain('start a new conversation');
  });

  it('restores a conversation-scoped pre-edit snapshot and refuses it on another chat', () => {
    const snapshot = beginTalkEditSnapshot({
      ownerId: owner,
      conversationId: conversationA,
      draft: 'unsent thought',
      caret: { start: 2, end: 6 },
      attachment: { id: 'image-1' },
      workTarget: { creationId: 'work-1', field: 'purpose' },
    });
    expect(snapshotBelongsToConversation(snapshot, owner, conversationA)).toBe(true);
    expect(snapshotBelongsToConversation(snapshot, owner, conversationB)).toBe(false);
    expect(snapshotBelongsToConversation(snapshot, 'other-owner', conversationA)).toBe(false);
    expect(snapshot.draft).toBe('unsent thought');
    expect(snapshot.caret).toEqual({ start: 2, end: 6 });
    expect(
      revisionAllowedForConversation({ sourceTurnId: 'turn-1' }, snapshot, owner, conversationB),
    ).toBeNull();
    expect(
      revisionAllowedForConversation({ sourceTurnId: 'turn-1' }, snapshot, owner, conversationA),
    ).toEqual({ sourceTurnId: 'turn-1' });
  });
});

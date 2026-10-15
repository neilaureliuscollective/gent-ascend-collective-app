import { expect, it } from 'vitest';
import {
  matchesVoiceReconcile,
  voiceItemsAcknowledged,
  voiceWorkspaceApplyAllowed,
} from '@/domains/live/receipt';

it('acknowledges persistence only from provider-item bindings, not turn-count growth', () => {
  expect(
    voiceItemsAcknowledged(
      ['item-a', 'item-a-again'],
      [
        { providerItemId: 'item-a', providerResponseId: 'r1', turnId: 'turn-1' },
        { providerItemId: 'item-a-again', providerResponseId: 'r2', turnId: 'turn-2' },
      ],
    ),
  ).toBe(true);
  expect(
    voiceItemsAcknowledged(
      ['item-a', 'item-a-again'],
      [{ providerItemId: 'item-a', providerResponseId: 'r1', turnId: 'turn-1' }],
    ),
  ).toBe(false);
  expect(voiceItemsAcknowledged([], [{ providerItemId: 'unrelated', providerResponseId: 'r', turnId: 't' }])).toBe(
    true,
  );
});

it('rejects a late receipt once owner, conversation, session or epoch changes', () => {
  const first = {
    ownerId: 'owner-a',
    conversationId: 'conv-a',
    sessionId: 'session-a',
    epoch: 1,
  };
  expect(matchesVoiceReconcile(first, first)).toBe(true);
  expect(matchesVoiceReconcile({ ...first, sessionId: 'session-b', epoch: 2 }, first)).toBe(false);
  expect(matchesVoiceReconcile({ ...first, conversationId: 'conv-b' }, first)).toBe(false);
  expect(matchesVoiceReconcile({ ...first, ownerId: 'owner-b' }, first)).toBe(false);
  expect(matchesVoiceReconcile(null, first)).toBe(false);
});

it('refuses a delayed workspace body after conversation or session change', () => {
  const first = {
    ownerId: 'owner-a',
    conversationId: 'conv-a',
    sessionId: 'session-a',
    epoch: 1,
  };
  expect(voiceWorkspaceApplyAllowed(first, first, 'conv-a', 'owner-a')).toBe(true);
  expect(voiceWorkspaceApplyAllowed({ ...first, conversationId: 'conv-b', epoch: 2 }, first, 'conv-b', 'owner-a')).toBe(
    false,
  );
  expect(voiceWorkspaceApplyAllowed(first, first, 'conv-b', 'owner-a')).toBe(false);
  expect(voiceWorkspaceApplyAllowed(first, first, 'conv-a', 'owner-b')).toBe(false);
  expect(voiceWorkspaceApplyAllowed(null, first, 'conv-a', 'owner-a')).toBe(false);
});

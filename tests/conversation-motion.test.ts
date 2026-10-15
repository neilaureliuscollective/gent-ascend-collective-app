import { describe, expect, it } from 'vitest';
import { observedOperation } from '../src/platform/visual/operation-adapters';
import {
  conversationActivityLabel,
  conversationArtifactReady,
  conversationMotionMode,
  conversationStatusVisible,
  nextObservedOperation,
} from '../src/platform/visual/conversation-motion';
import { intelligenceStatus } from '../src/platform/visual/intelligence-motion';

describe('conversation motion presentation', () => {
  it('maps gather, articulate, settle and interrupt from observed work', () => {
    expect(conversationMotionMode(observedOperation('a', 'sending'))).toBe('sending');
    expect(conversationMotionMode(observedOperation('a', 'waiting', 'pending'))).toBe('gather');
    expect(conversationMotionMode(observedOperation('a', 'searching', 'pending'))).toBe(
      'articulate',
    );
    expect(conversationMotionMode(observedOperation('a', 'saving', 'pending'))).toBe('settle');
    expect(conversationMotionMode(observedOperation('a', 'complete', 'confirmed'))).toBe('rest');
    expect(conversationMotionMode(observedOperation('a', 'stopping', 'pending'))).toBe('interrupt');
    expect(conversationMotionMode(observedOperation('a', 'cancelled', 'uncertain'))).toBe(
      'interrupt',
    );
  });

  it('hides waiting copy once text is streaming and keeps Saved visible', () => {
    expect(conversationStatusVisible(observedOperation('a', 'waiting', 'pending'))).toBe(true);
    expect(conversationStatusVisible(observedOperation('a', 'generating', 'pending'))).toBe(false);
    expect(conversationStatusVisible(observedOperation('a', 'complete', 'confirmed'))).toBe(true);
    expect(conversationStatusVisible(observedOperation('a', 'ready'))).toBe(false);
  });

  it('uses real search and image events rather than invented research stages', () => {
    expect(conversationActivityLabel(observedOperation('a', 'searching', 'pending'))).toBe(
      'Searching the web',
    );
    expect(
      conversationActivityLabel(observedOperation('a', 'generating', 'pending'), [
        { kind: 'image', title: 'Board', status: 'approval' },
      ]),
    ).toBe('Creating an image');
    expect(
      conversationActivityLabel(observedOperation('a', 'searching', 'pending'), [
        { kind: 'image', title: 'Board' },
      ]),
    ).toBe('Searching the web');
    expect(conversationArtifactReady({ kind: 'image', status: 'approval' })).toBe(false);
    expect(conversationArtifactReady({ kind: 'image', status: 'complete' })).toBe(true);
  });

  it('rejects stale ids and late success from a finished request', () => {
    const current = observedOperation('live', 'waiting', 'pending');
    expect(nextObservedOperation(current, observedOperation('old', 'searching', 'pending'))).toEqual(
      current,
    );
    const saved = observedOperation('live', 'complete', 'confirmed');
    expect(nextObservedOperation(saved, observedOperation('live', 'waiting', 'pending'))).toEqual(
      saved,
    );
    const stopping = observedOperation('live', 'stopping', 'pending');
    expect(nextObservedOperation(stopping, observedOperation('live', 'searching'))).toEqual(
      stopping,
    );
    expect(nextObservedOperation(stopping, observedOperation('live', 'cancelled', 'uncertain')).phase).toBe(
      'cancelled',
    );
  });

  it('distinguishes sending, preparing, stopping and stopped', () => {
    expect(intelligenceStatus(observedOperation('a', 'sending', 'pending'))).toBe('Sending');
    expect(intelligenceStatus(observedOperation('a', 'waiting', 'pending'))).toBe(
      'Preparing a reply',
    );
    expect(intelligenceStatus(observedOperation('a', 'stopping', 'pending'))).toBe('Stopping');
    expect(intelligenceStatus(observedOperation('a', 'cancelled', 'uncertain'))).toBe(
      'Stopped · Save unconfirmed',
    );
  });
});

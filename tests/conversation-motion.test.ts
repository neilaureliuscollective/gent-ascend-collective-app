import { describe, expect, it } from 'vitest';
import { observedOperation } from '../src/platform/visual/operation-adapters';
import {
  applyStreamArtifact,
  conversationActivityLabel,
  conversationAnnounceText,
  conversationAnnouncerText,
  conversationArtifactReady,
  conversationMotionMode,
  conversationStatusVisible,
  imageArtifactActivity,
  nextObservedOperation,
  terminalizeConversationArtifacts,
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

  it('uses real search and distinguishes image approval from generation', () => {
    expect(conversationActivityLabel(observedOperation('a', 'searching', 'pending'))).toBe(
      'Searching the web',
    );
    expect(
      conversationActivityLabel(observedOperation('a', 'generating', 'pending'), [
        { kind: 'image', title: 'Board', status: 'approval' },
      ]),
    ).toBe('Waiting for your approval');
    expect(
      conversationActivityLabel(observedOperation('a', 'generating', 'pending'), [
        { kind: 'image', title: 'Board', status: 'running' },
      ]),
    ).toBe('Creating an image');
    expect(
      conversationActivityLabel(observedOperation('a', 'searching', 'pending'), [
        { kind: 'image', title: 'Board', status: 'approval' },
      ]),
    ).toBe('Searching the web');
    expect(imageArtifactActivity([{ kind: 'image', status: 'approval' }])).toBe('approval');
    expect(imageArtifactActivity([{ kind: 'image', status: 'running' }])).toBe('creating');
    expect(conversationArtifactReady({ kind: 'image', status: 'approval' })).toBe(false);
    expect(conversationArtifactReady({ kind: 'image', status: 'complete' })).toBe(true);
    expect(
      conversationMotionMode(observedOperation('a', 'generating', 'pending'), [
        { kind: 'image', status: 'approval' },
      ]),
    ).toBe('gather');
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

  it('announces operational transitions once, including Responding, and stays silent at rest', () => {
    expect(conversationAnnounceText(observedOperation('a', 'ready'))).toBe('');
    expect(conversationAnnounceText(observedOperation('a', 'waiting', 'pending'))).toBe(
      'Preparing a reply',
    );
    expect(conversationAnnounceText(observedOperation('a', 'generating', 'pending'))).toBe(
      'Responding',
    );
    expect(
      conversationAnnounceText(observedOperation('a', 'generating', 'pending'), [
        { kind: 'image', status: 'approval' },
      ]),
    ).toBe('Waiting for your approval');
    expect(
      conversationAnnounceText({
        ...observedOperation('a', 'ready'),
        label: 'Microphone muted',
      }),
    ).toBe('Microphone muted');
  });

  it('does not let a persistent notice mask request activity', () => {
    const lingering = 'Image generation is unavailable; text work remains available.';
    expect(
      conversationAnnouncerText(observedOperation('a', 'sending', 'pending'), [], lingering),
    ).toBe('Sending');
    expect(
      conversationAnnouncerText(observedOperation('a', 'waiting', 'pending'), [], lingering),
    ).toBe('Preparing a reply');
    expect(
      conversationAnnouncerText(observedOperation('a', 'saving', 'pending'), [], lingering),
    ).toBe('Saving');
    expect(
      conversationAnnouncerText(observedOperation('a', 'complete', 'confirmed'), [], 'Reply saved.'),
    ).toBe('Reply saved.');
    expect(
      conversationAnnouncerText(observedOperation('a', 'cancelled', 'uncertain'), [], lingering),
    ).toBe('Stopped · Save unconfirmed');
    expect(conversationAnnouncerText(observedOperation('a', 'ready'), [], lingering)).toBe('');
  });

  it('terminalizes in-progress artifacts and preserves completed ones', () => {
    const artifacts = [
      { id: 'ready', kind: 'image' as const, status: 'complete' },
      { id: 'wait', kind: 'image' as const, status: 'approval' },
      { id: 'run', kind: 'image' as const, status: 'running' },
    ];
    expect(terminalizeConversationArtifacts(artifacts, 'stopped')).toEqual([
      { id: 'ready', kind: 'image', status: 'complete' },
      { id: 'wait', kind: 'image', status: 'stopped' },
      { id: 'run', kind: 'image', status: 'stopped' },
    ]);
    expect(terminalizeConversationArtifacts(artifacts, 'failed')[1]?.status).toBe('failed');
    expect(terminalizeConversationArtifacts(artifacts, 'uncertain')[2]?.status).toBe('uncertain');
  });

  it('rejects late artifact events from an older or already terminal request', () => {
    const current = [{ id: 'img', kind: 'image' as const, status: 'approval' }];
    expect(
      applyStreamArtifact(current, { id: 'img', kind: 'image', status: 'running' }, {
        eventRequestId: 'old',
        activeRequestId: 'live',
        requestTerminal: false,
      }),
    ).toEqual(current);
    expect(
      applyStreamArtifact(current, { id: 'img', kind: 'image', status: 'running' }, {
        eventRequestId: 'live',
        activeRequestId: 'live',
        requestTerminal: true,
      }),
    ).toEqual(current);
    const stopped = [{ id: 'img', kind: 'image' as const, status: 'stopped' }];
    expect(
      applyStreamArtifact(stopped, { id: 'img', kind: 'image', status: 'running' }, {
        eventRequestId: 'live',
        activeRequestId: 'live',
        requestTerminal: false,
      }),
    ).toEqual(stopped);
    const completed = [{ id: 'img', kind: 'image' as const, status: 'complete' }];
    expect(
      applyStreamArtifact(completed, { id: 'img', kind: 'image', status: 'running' }, {
        eventRequestId: 'live',
        activeRequestId: 'live',
        requestTerminal: false,
      }),
    ).toEqual(completed);
    expect(
      applyStreamArtifact([], { id: 'img', kind: 'image', status: 'approval' }, {
        eventRequestId: 'live',
        activeRequestId: 'live',
        requestTerminal: false,
      }),
    ).toEqual([{ id: 'img', kind: 'image', status: 'approval' }]);
    expect(
      applyStreamArtifact(current, { id: 'img', kind: 'image', status: 'running' }, {
        eventRequestId: 'live',
        activeRequestId: 'live',
        requestTerminal: false,
      }),
    ).toEqual([{ id: 'img', kind: 'image', status: 'running' }]);
  });
});

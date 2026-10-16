import { describe, expect, it } from 'vitest';
import { liveCallKind, liveCallVisual } from '../src/platform/visual/live-call-presentation';

const session = {
  sessionId: 'session-1',
  phase: 'listening' as const,
  muted: false,
  playbackBlocked: false,
};

describe('live call visual states', () => {
  it('keeps connecting, listening, speaking, waiting and muted distinct', () => {
    expect(liveCallKind({ ...session, phase: 'connecting' })).toBe('connecting');
    expect(liveCallKind(session)).toBe('listening');
    expect(liveCallKind({ ...session, responsePending: true })).toBe('waiting');
    expect(liveCallKind({ ...session, muted: true })).toBe('muted');
    expect(liveCallKind({ ...session, phase: 'speaking' })).toBe('speaking');
    expect(liveCallKind({ ...session, phase: 'speaking', playbackBlocked: true })).toBe('blocked');
  });

  it('labels reconnect and failure without pretending speech is playing', () => {
    const recovering = liveCallVisual({ ...session, recovering: true });
    expect(recovering.kind).toBe('recovering');
    expect(recovering.label).toBe('Reconnecting');
    expect(recovering.reactive).toBe(false);
    expect(liveCallVisual({ ...session, phase: 'ended' }).kind).toBe('ended');
    expect(liveCallVisual({ ...session, phase: 'ended', error: 'The connection stopped.' }).kind).toBe(
      'error',
    );
    expect(liveCallVisual({ ...session, phase: 'error', error: 'Provider stopped.' }).kind).toBe(
      'error',
    );
  });

  it('uses measured microphone or playback energy only for the matching live phase', () => {
    const listening = liveCallVisual(session, { input: 0.4, output: 0.9, source: 'webrtc-stats' });
    expect(listening.reactive).toBe(true);
    expect(listening.energy).toBe(0.4);
    expect(listening.inward).toBeGreaterThan(listening.outward);
    const speaking = liveCallVisual(
      { ...session, phase: 'speaking' },
      { input: 0.4, output: 0.8, source: 'web-audio-tap' },
    );
    expect(speaking.reactive).toBe(true);
    expect(speaking.energy).toBe(0.8);
    expect(speaking.outward).toBeGreaterThan(speaking.inward);
    const muted = liveCallVisual(
      { ...session, muted: true },
      { input: 0.9, output: 0, source: 'webrtc-stats' },
    );
    expect(muted.kind).toBe('muted');
    expect(muted.reactive).toBe(false);
    expect(muted.energy).toBe(0);
  });

  it('does not label a timer or missing sample as audio-reactive', () => {
    const waiting = liveCallVisual({ ...session, responsePending: true });
    expect(waiting.kind).toBe('waiting');
    expect(waiting.reactive).toBe(false);
    expect(waiting.energySource).toBe('unavailable');
    expect(waiting.energy).toBe(0);
    const connecting = liveCallVisual({ ...session, phase: 'connecting' }, { input: 0, output: 0 });
    expect(connecting.reactive).toBe(false);
    expect(connecting.rotate).toBe(true);
  });

  it('drops the speaking response immediately when the session returns to listening', () => {
    const speaking = liveCallVisual(
      { ...session, phase: 'speaking' },
      { input: 0, output: 0.7, source: 'webrtc-stats' },
    );
    const interrupted = liveCallVisual(session, { input: 0.2, output: 0, source: 'webrtc-stats' });
    expect(speaking.kind).toBe('speaking');
    expect(interrupted.kind).toBe('listening');
    expect(interrupted.outward).toBe(0);
    expect(interrupted.inward).toBeGreaterThan(0);
  });

  it('honors reduced motion by keeping the globe still', () => {
    const visual = liveCallVisual(session, { input: 0.3, output: 0, source: 'webrtc-stats' }, {
      moving: false,
    });
    expect(visual.rotate).toBe(false);
    expect(visual.reactive).toBe(true);
  });
});

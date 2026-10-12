import { describe, it, expect } from 'vitest';
import { motionPresentationPhase } from '../src/platform/visual/motion-presentation';
import { liveMotionOperation } from '../src/platform/visual/operation-adapters';
describe('authored identity respects operation receipts and native Live modifiers', () => {
  it('cannot show successful resolution before confirmed persistence', () => {
    expect(
      motionPresentationPhase({
        id: 'a',
        basis: 'observed',
        phase: 'complete',
        persistence: 'pending',
      }),
    ).toBe('saving');
    expect(
      motionPresentationPhase({
        id: 'a',
        basis: 'observed',
        phase: 'complete',
        persistence: 'uncertain',
      }),
    ).toBe('failed');
    expect(
      motionPresentationPhase({
        id: 'a',
        basis: 'observed',
        phase: 'cancelled',
        persistence: 'uncertain',
      }),
    ).toBe('cancelled');
  });
  it('does not animate blocked playback as responding or waiting on new work', () => {
    const operation = liveMotionOperation(
      { sessionId: 'voice', phase: 'speaking', muted: false, playbackBlocked: true },
      { input: 0, output: 1 },
    );
    expect(motionPresentationPhase(operation)).toBe('ready');
    expect(operation.audioLevel).toBe(0);
  });
  it('retains failure with its truthful connection label', () => {
    expect(
      motionPresentationPhase(
        liveMotionOperation({
          sessionId: 'voice',
          phase: 'error',
          muted: false,
          playbackBlocked: false,
        }),
      ),
    ).toBe('failed');
  });
});

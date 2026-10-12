import { expect, it } from 'vitest';
import {
  liveMotionOperation,
  liveJobMotionOperation,
} from '../src/platform/visual/operation-adapters';
import { intelligenceStatus, measuredAudioLevel } from '../src/platform/visual/intelligence-motion';
const voice = {
  sessionId: 'session-1',
  phase: 'listening' as const,
  muted: false,
  playbackBlocked: false,
};
it('separates microphone input from playback and suppresses muted or blocked audio', () => {
  expect(measuredAudioLevel(liveMotionOperation(voice, { input: 0.2, output: 0.8 }))).toBe(0.2);
  expect(
    measuredAudioLevel(
      liveMotionOperation({ ...voice, phase: 'speaking' }, { input: 0.2, output: 0.8 }),
    ),
  ).toBe(0.8);
  expect(
    measuredAudioLevel(liveMotionOperation({ ...voice, muted: true }, { input: 0.9, output: 0 })),
  ).toBe(0);
  expect(liveMotionOperation({ ...voice, phase: 'speaking', playbackBlocked: true }).phase).toBe(
    'waiting',
  );
  expect(measuredAudioLevel(liveMotionOperation({ ...voice, phase: 'speaking' }))).toBe(0);
});
it('does not claim a saved transcript when a voice session ends or a job awaits approval', () => {
  expect(intelligenceStatus(liveMotionOperation({ ...voice, phase: 'ended' }))).not.toBe('Saved');
  expect(liveJobMotionOperation({ id: 'job', status: 'approval' }).phase).toBe('ready');
  expect(liveJobMotionOperation({ id: 'job', status: 'approved' }).phase).toBe('waiting');
  expect(intelligenceStatus(liveJobMotionOperation({ id: 'job', status: 'complete' }))).toBe(
    'Saved',
  );
  expect(liveJobMotionOperation({ id: 'job', status: 'failed' }).phase).toBe('failed');
});

import { describe, expect, it } from 'vitest';
import {
  intelligenceBusy,
  intelligenceStatus,
  measuredAudioLevel,
  type IntelligenceOperation,
} from '../src/platform/visual/intelligence-motion';
const operation = (patch: Partial<IntelligenceOperation>): IntelligenceOperation => ({
  id: 'request-1',
  phase: 'complete',
  basis: 'observed',
  ...patch,
});
describe('Intelligence motion truth boundaries', () => {
  it('distinguishes a generated result from an acknowledged save', () => {
    expect(intelligenceStatus(operation({}))).toBe('Complete');
    expect(intelligenceStatus(operation({ persistence: 'pending' }))).toBe('Saving');
    expect(intelligenceBusy(operation({ persistence: 'pending' }))).toBe(true);
    expect(intelligenceStatus(operation({ persistence: 'confirmed' }))).toBe('Saved');
    expect(intelligenceStatus(operation({ persistence: 'uncertain' }))).toBe('Save unconfirmed');
    expect(intelligenceBusy(operation({ phase: 'cancelled' }))).toBe(false);
    expect(intelligenceBusy(operation({ phase: 'failed' }))).toBe(false);
  });
  it('does not invent audio activity, including non-audio and invalid measurements', () => {
    expect(measuredAudioLevel(operation({ phase: 'listening' }))).toBe(0);
    expect(measuredAudioLevel(operation({ phase: 'thinking', audioLevel: 1 }))).toBe(0);
    for (const audioLevel of [NaN, Infinity, -1])
      expect(measuredAudioLevel(operation({ phase: 'speaking', audioLevel }))).toBe(0);
    expect(measuredAudioLevel(operation({ phase: 'speaking', audioLevel: 2 }))).toBe(1);
    expect(measuredAudioLevel(operation({ phase: 'listening', audioLevel: 0.4 }))).toBe(0.4);
  });
});

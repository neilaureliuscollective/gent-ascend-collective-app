import { describe, expect, it } from 'vitest';
import { orbEnergy, readOrbState } from '../src/platform/visual/presence-state';
describe('Orb presentation signals', () => {
  it('keeps insight and milestone responses finite, bounded, and distinct from real activity', () => {
    for (const state of ['preview-insight', 'preview-milestone'] as const) {
      expect(readOrbState(state)).toBe(state);
      expect(orbEnergy(state, 1)).toBeGreaterThan(0);
      for (const time of [-1, 0, 3, 100, Number.NaN]) expect(orbEnergy(state, time)).toBe(0);
      for (let time = 0; time < 3; time += 0.1)
        expect(orbEnergy(state, time)).toBeLessThanOrEqual(0.6);
    }
    expect(readOrbState('milestone')).toBe('disconnected');
  });
  it('never invents voice activity for real application states or malformed input', () => {
    expect(readOrbState('speaking')).toBe('disconnected');
    expect(readOrbState(undefined)).toBe('disconnected');
    for (const state of ['disconnected', 'ready', 'stopped'] as const) {
      for (const time of [0, 0.4, 2, 3.8, 400]) expect(orbEnergy(state, time)).toBe(0);
    }
    expect(orbEnergy('preview-speaking', Number.NaN)).toBe(0);
  });
  it('bounds illustrative voice motion and includes a real quiet interval', () => {
    for (const state of ['preview-speaking', 'preview-listening'] as const) {
      for (let time = 0; time < 20; time += 0.03) {
        expect(orbEnergy(state, time)).toBeGreaterThanOrEqual(0);
        expect(orbEnergy(state, time)).toBeLessThanOrEqual(1);
      }
      expect(orbEnergy(state, 1)).toBeGreaterThan(0);
      expect(orbEnergy(state, 4)).toBe(0);
    }
  });
});

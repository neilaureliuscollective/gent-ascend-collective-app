import { describe, it, expect } from 'vitest';
import {
  mirrorGuidance,
  cameraError,
  type MirrorReading,
} from '@/domains/grooming/mirror-guidance';
const reading: MirrorReading = {
  faces: 1,
  outline: [
    { x: 0.5, y: 0.2 },
    { x: 0.5, y: 0.8 },
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
  ],
  brightness: 100,
  turn: 0.5,
};
describe('Mirror positioning is capture guidance, not appearance analysis', () => {
  it('requires one centered face, plausible turn, and usable light', () => {
    expect(mirrorGuidance(reading, 'front').ready).toBe(true);
    expect(mirrorGuidance({ ...reading, faces: 0 }, 'front').ready).toBe(false);
    expect(mirrorGuidance({ ...reading, faces: 2 }, 'front').ready).toBe(false);
    expect(mirrorGuidance({ ...reading, brightness: 5 }, 'front').text).toContain('light');
    expect(mirrorGuidance({ ...reading, turn: 0.78 }, 'front').ready).toBe(false);
    expect(mirrorGuidance({ ...reading, turn: 0.78 }, 'left').ready).toBe(true);
    expect(mirrorGuidance({ ...reading, turn: 0.22 }, 'right').ready).toBe(true);
    expect(mirrorGuidance({ ...reading, turn: NaN }, 'front').ready).toBe(false);
    expect(mirrorGuidance(reading, 'hair').ready).toBe(false);
  });
  it('separates permission denial from camera busy and missing hardware', () => {
    expect(cameraError(new DOMException('', 'NotAllowedError'))).toContain('permission');
    expect(cameraError(new DOMException('', 'NotReadableError'))).toContain('busy');
    expect(cameraError(new DOMException('', 'NotFoundError'))).toContain('No camera');
  });
});

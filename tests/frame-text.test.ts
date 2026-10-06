import { expect, test, vi } from 'vitest';
import { frameText } from '../src/components/aurelius/frame-text';
test('tokens paint together; saved completion cancels stale partial paint', () => {
  const paint = vi.fn();
  let queued: FrameRequestCallback = () => {};
  const schedule = vi.fn((callback: FrameRequestCallback) => {
    queued = callback;
    return 8;
  });
  const cancel = vi.fn();
  const stream = frameText(paint, schedule, cancel);
  stream.append('First ');
  stream.append('reply');
  expect(schedule).toHaveBeenCalledTimes(1);
  queued(0);
  expect(paint).toHaveBeenLastCalledWith('First reply');
  stream.append(' tail');
  stream.finish();
  expect(cancel).toHaveBeenCalledWith(8);
  expect(paint).toHaveBeenCalledTimes(1);
});
test('interruption retains the final partial without triggering a new request', () => {
  const paint = vi.fn(),
    cancel = vi.fn();
  const stream = frameText(paint, () => 4, cancel);
  stream.append('Saved draft');
  stream.finish(true);
  expect(paint).toHaveBeenCalledExactlyOnceWith('Saved draft');
  expect(cancel).toHaveBeenCalledWith(4);
});

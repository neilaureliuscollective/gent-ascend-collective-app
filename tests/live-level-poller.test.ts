import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLiveLevelPoller } from '../src/platform/visual/live-level-poller';

afterEach(() => {
  vi.useRealTimers();
});

describe('live level poller', () => {
  it('reuses one in-flight read and ignores results after dispose', async () => {
    let resolveRead!: (value: { input: number; output: number }) => void;
    const read = vi.fn(
      () =>
        new Promise<{ input: number; output: number }>((resolve) => {
          resolveRead = resolve;
        }),
    );
    const apply = vi.fn();
    const poller = createLiveLevelPoller({
      read,
      apply,
      shouldPoll: () => true,
      interval: 160,
    });
    poller.sync();
    poller.sync();
    expect(read).toHaveBeenCalledTimes(1);
    poller.dispose();
    resolveRead({ input: 0.4, output: 0.2 });
    await Promise.resolve();
    await Promise.resolve();
    expect(apply).not.toHaveBeenCalled();
  });

  it('takes one sample when polling is paused and does not overlap later reads', async () => {
    const read = vi.fn(async () => ({ input: 0.1, output: 0 }));
    const apply = vi.fn();
    const allowed = false;
    const poller = createLiveLevelPoller({
      read,
      apply,
      shouldPoll: () => allowed,
      interval: 10_000,
    });
    poller.sync();
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({
      input: 0.1,
      output: 0,
      source: 'webrtc-stats',
    });
    poller.sync();
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(2);
    poller.dispose();
  });
});

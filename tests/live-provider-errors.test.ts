import { expect, it } from 'vitest';
import { recoverableLiveError } from '@/domains/live/provider-errors';
it('shares a narrow session-preserving cancellation classification across browser and sideband', () => {
  expect(
    recoverableLiveError({
      type: 'error',
      error: { type: 'invalid_request_error', code: 'response_cancel_not_active' },
    }),
  ).toBe(true);
  for (const event of [
    { type: 'error' },
    { type: 'error', error: { code: 'server_error' } },
    { type: 'error', error: { type: 'authentication_error', code: 'response_cancel_not_active' } },
    { type: 'response.done' },
  ])
    expect(recoverableLiveError(event)).toBe(false);
});

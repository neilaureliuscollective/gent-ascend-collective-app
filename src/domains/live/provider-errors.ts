import type { LiveEvent } from './contract';
/** Realtime documents a no-active-response cancel error as session-preserving.
 * Keep this allowlist narrow: admission/auth/unknown errors remain fatal. Both the
 * browser and the admitted server sideband must make the same decision. */
export function recoverableLiveError(event: LiveEvent): boolean {
  return (
    event.type === 'error' &&
    event.error?.code === 'response_cancel_not_active' &&
    (!event.error.type || event.error.type === 'invalid_request_error')
  );
}

export const TALK_TEXT_LIMIT = 6000;
export const LIVE_TEXT_LIMIT = 4000;

export type LiveTextSend =
  | { accepted: true }
  | { accepted: false; reason: 'empty' | 'limit' | 'channel' };

export function liveComposerLimit(phase: string) {
  return phase === 'listening' || phase === 'speaking' ? LIVE_TEXT_LIMIT : TALK_TEXT_LIMIT;
}

/** Voice cleanup or a failed call must not disable ordinary text. */
export function talkComposerSendRoute(phase: string) {
  if (phase === 'listening' || phase === 'speaking') return 'voice' as const;
  if (phase === 'connecting') return 'hold' as const;
  return 'text' as const;
}

export function liveTextRejection(reason: Exclude<LiveTextSend, { accepted: true }>['reason']) {
  if (reason === 'limit')
    return `Voice messages can be ${LIVE_TEXT_LIMIT} characters. Your draft is unchanged.`;
  if (reason === 'channel')
    return 'Voice is not ready to accept typed text. Your draft is unchanged.';
  return 'Enter a message before sending.';
}

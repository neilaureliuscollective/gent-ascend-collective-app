export type ConversationMilestone =
  | 'acknowledged'
  | 'acknowledgement-render'
  | 'accepted'
  | 'first-event'
  | 'first-text'
  | 'first-render'
  | 'saved'
  | 'ended';
/** Local, opt-in development measurements. Never receives IDs, prompts or response text. */
export function conversationTiming() {
  let enabled = false;
  try {
    enabled =
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development' &&
      window.localStorage.getItem('aethelios-timing') === '1';
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  const start = performance.now();
  const marks = new Map<ConversationMilestone, number>();
  return {
    enabled,
    mark(stage: ConversationMilestone) {
      if (!enabled || marks.has(stage)) return;
      marks.set(stage, Math.max(0, performance.now() - start));
      window.dispatchEvent(
        new CustomEvent('aethelios:timing', {
          detail: { stage, elapsedMs: marks.get(stage) },
        }),
      );
    },
  };
}

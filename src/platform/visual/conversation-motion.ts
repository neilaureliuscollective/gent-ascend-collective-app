import {
  intelligenceBusy,
  intelligenceStatus,
  type IntelligenceOperation,
} from './intelligence-motion';

export type ConversationMotionMode =
  | 'rest'
  | 'sending'
  | 'gather'
  | 'articulate'
  | 'settle'
  | 'interrupt';

export type ConversationArtifactHint = {
  kind: 'brief' | 'plan' | 'palette' | 'board' | 'handoff' | 'image';
  title?: string;
  status?: string;
};

/** Gather / articulate / settle is presentation only. It never invents work. */
export function conversationMotionMode(operation: IntelligenceOperation): ConversationMotionMode {
  if (operation.persistence === 'uncertain') return 'interrupt';
  if (operation.phase === 'sending') return 'sending';
  if (operation.phase === 'stopping') return 'interrupt';
  if (operation.phase === 'cancelled' || operation.phase === 'failed') return 'interrupt';
  if (operation.phase === 'saving' || (operation.phase === 'complete' && operation.persistence === 'pending'))
    return 'settle';
  if (operation.phase === 'complete' && operation.persistence === 'confirmed') return 'rest';
  if (operation.phase === 'ready') return 'rest';
  if (operation.phase === 'waiting' || operation.phase === 'connecting' || operation.phase === 'loading')
    return 'gather';
  return 'articulate';
}

export function conversationStatusVisible(operation: IntelligenceOperation): boolean {
  if (operation.persistence === 'uncertain') return true;
  if (operation.phase === 'generating') return false;
  if (operation.phase === 'ready') return false;
  if (operation.phase === 'complete' && operation.persistence === 'confirmed') return true;
  return operation.phase !== 'complete' || operation.persistence === 'pending';
}

export function conversationActivityLabel(
  operation: IntelligenceOperation,
  artifacts: ConversationArtifactHint[] = [],
): string {
  if (operation.phase === 'searching') return 'Searching the web';
  if (
    intelligenceBusy(operation) &&
    operation.phase !== 'saving' &&
    artifacts.some((item) => item.kind === 'image')
  )
    return 'Creating an image';
  return intelligenceStatus(operation);
}

export function conversationArtifactReady(artifact: ConversationArtifactHint): boolean {
  return artifact.status === 'complete' || artifact.status === 'saved';
}

/**
 * Same-request terminal truth is sticky. A different id cannot revive a busy
 * request, and a finished request cannot replay gather/articulate.
 */
export function nextObservedOperation(
  current: IntelligenceOperation,
  incoming: IntelligenceOperation,
): IntelligenceOperation {
  if (incoming.id !== current.id) {
    if (intelligenceBusy(current)) return current;
    return incoming;
  }
  if (current.phase === 'complete' && current.persistence === 'confirmed') return current;
  if (current.phase === 'cancelled' && incoming.phase !== 'cancelled') return current;
  if (current.phase === 'failed' && incoming.phase !== 'failed' && incoming.phase !== 'cancelled')
    return current;
  if (
    current.phase === 'stopping' &&
    incoming.phase !== 'cancelled' &&
    incoming.phase !== 'failed' &&
    incoming.phase !== 'stopping'
  )
    return current;
  return incoming;
}

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

export type ConversationStreamArtifact = ConversationArtifactHint & { id: string };

const ARTIFACT_COMPLETED = new Set(['complete', 'saved']);
const ARTIFACT_TERMINAL = new Set([
  'complete',
  'saved',
  'stopped',
  'failed',
  'uncertain',
  'declined',
]);

/** Gather / articulate / settle is presentation only. It never invents work. */
export function conversationMotionMode(
  operation: IntelligenceOperation,
  artifacts: ConversationArtifactHint[] = [],
): ConversationMotionMode {
  if (operation.persistence === 'uncertain') return 'interrupt';
  if (operation.phase === 'sending') return 'sending';
  if (operation.phase === 'stopping') return 'interrupt';
  if (operation.phase === 'cancelled' || operation.phase === 'failed') return 'interrupt';
  if (operation.phase === 'saving' || (operation.phase === 'complete' && operation.persistence === 'pending'))
    return 'settle';
  if (operation.phase === 'complete' && operation.persistence === 'confirmed') return 'rest';
  if (operation.phase === 'ready') return 'rest';
  if (imageArtifactActivity(artifacts) === 'approval' && intelligenceBusy(operation)) return 'gather';
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

export function imageArtifactActivity(
  artifacts: ConversationArtifactHint[],
): 'approval' | 'creating' | null {
  const images = artifacts.filter((item) => item.kind === 'image');
  if (images.some((item) => item.status === 'running' || item.status === 'generating'))
    return 'creating';
  if (images.some((item) => item.status === 'approval' || item.status === 'proposed'))
    return 'approval';
  return null;
}

export function conversationActivityLabel(
  operation: IntelligenceOperation,
  artifacts: ConversationArtifactHint[] = [],
): string {
  if (operation.phase === 'searching') return 'Searching the web';
  if (intelligenceBusy(operation) && operation.phase !== 'saving') {
    const image = imageArtifactActivity(artifacts);
    if (image === 'creating') return 'Creating an image';
    if (image === 'approval') return 'Waiting for your approval';
  }
  return intelligenceStatus(operation);
}

export function conversationAnnounceText(
  operation: IntelligenceOperation,
  artifacts: ConversationArtifactHint[] = [],
): string {
  if (operation.phase === 'ready' && operation.persistence !== 'uncertain' && !operation.label)
    return '';
  const prefix = operation.basis === 'preview' ? 'Preview · ' : '';
  if (operation.phase === 'generating') {
    const image = imageArtifactActivity(artifacts);
    if (image === 'approval') return `${prefix}Waiting for your approval`;
    if (image === 'creating') return `${prefix}Creating an image`;
    return `${prefix}Responding`;
  }
  return `${prefix}${conversationActivityLabel(operation, artifacts)}`;
}

export function conversationArtifactReady(artifact: ConversationArtifactHint): boolean {
  return ARTIFACT_COMPLETED.has(artifact.status ?? '');
}

export function conversationArtifactTerminal(status?: string): boolean {
  return ARTIFACT_TERMINAL.has(status ?? '');
}

export function terminalizeConversationArtifacts<T extends ConversationArtifactHint>(
  artifacts: T[],
  reason: 'stopped' | 'failed' | 'uncertain',
): T[] {
  return artifacts.map((item) => {
    if (conversationArtifactReady(item) || conversationArtifactTerminal(item.status)) return item;
    return { ...item, status: reason };
  });
}

export function applyStreamArtifact<T extends ConversationStreamArtifact>(
  previous: T[],
  incoming: T,
  scope: { eventRequestId: string; activeRequestId: string; requestTerminal: boolean },
): T[] {
  if (!scope.activeRequestId || scope.eventRequestId !== scope.activeRequestId) return previous;
  if (scope.requestTerminal) return previous;
  const index = previous.findIndex((item) => item.id === incoming.id && item.kind === incoming.kind);
  if (index === -1) return [...previous, incoming];
  const current = previous[index];
  if (!current) return [...previous, incoming];
  if (conversationArtifactReady(current)) return previous;
  if (conversationArtifactTerminal(current.status) && !conversationArtifactReady(incoming))
    return previous;
  const next = previous.slice();
  next[index] = incoming;
  return next;
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

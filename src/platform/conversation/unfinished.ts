export type TalkUnfinishedWork = {
  draft: string;
  attachment: { id: string } | null;
  attachmentBusy: boolean;
  revision: { sourceTurnId: string } | null;
};

export type TalkEditSnapshot<Attachment, Target> = {
  ownerId: string;
  conversationId: string | null;
  draft: string;
  caret: { start: number; end: number };
  attachment: Attachment | null;
  workTarget: Target | null;
};

export function hasUnfinishedTalkWork(work: TalkUnfinishedWork) {
  return Boolean(work.draft.trim() || work.attachment || work.attachmentBusy || work.revision);
}

export function unfinishedTalkWorkPrompt(intent: 'switch' | 'new') {
  return intent === 'switch'
    ? 'Discard unfinished work and switch conversations?'
    : 'Discard unfinished work and start a new conversation?';
}

export function snapshotBelongsToConversation(
  snapshot: { ownerId: string; conversationId: string | null } | null,
  ownerId: string,
  conversationId: string | null,
) {
  if (!snapshot) return false;
  if (snapshot.conversationId !== conversationId) return false;
  if (snapshot.ownerId && ownerId && snapshot.ownerId !== ownerId) return false;
  return true;
}

export function beginTalkEditSnapshot<Attachment, Target>(input: {
  ownerId: string;
  conversationId: string | null;
  draft: string;
  caret: { start: number; end: number };
  attachment: Attachment | null;
  workTarget: Target | null;
}): TalkEditSnapshot<Attachment, Target> {
  return {
    ownerId: input.ownerId,
    conversationId: input.conversationId,
    draft: input.draft,
    caret: {
      start: Math.max(0, input.caret.start),
      end: Math.max(input.caret.start, input.caret.end),
    },
    attachment: input.attachment,
    workTarget: input.workTarget,
  };
}

export function revisionAllowedForConversation(
  revision: { sourceTurnId: string } | null,
  snapshot: { ownerId: string; conversationId: string | null } | null,
  ownerId: string,
  conversationId: string | null,
) {
  if (!revision) return null;
  if (!snapshotBelongsToConversation(snapshot, ownerId, conversationId)) return null;
  return revision;
}

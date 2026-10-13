'use client';
import type { ReactNode } from 'react';
import { clearTalkDrafts } from '@/platform/conversation/drafts';
import { useConversationDraft } from './draft-handoff';
/** Clear local recovery on explicit sign-out; server messages are never touched. */
export function TalkSignOutForm({
  action,
  children,
}: {
  action: () => Promise<void>;
  children: ReactNode;
}) {
  const handoff = useConversationDraft();
  return (
    <form
      action={action}
      onSubmit={() => {
        clearTalkDrafts();
        handoff?.stage(null);
      }}
    >
      {children}
    </form>
  );
}

'use client';
import { useState, type ReactNode } from 'react';
import { useConversationDraft } from '@/components/aurelius/draft-handoff';

type FocusPayload = {
  commandFocus?: { title?: string; source?: string };
};

/** Read the incoming Command handoff once. Talk still owns the draft take. */
export function CommandTalkContext({ children }: { children: ReactNode }) {
  const handoff = useConversationDraft();
  const [focus] = useState(() => {
    const payload = handoff?.peek()?.payload as FocusPayload | undefined;
    return payload?.commandFocus ?? null;
  });
  if (!focus?.title) return children;
  return (
    <>
      <p className="command-talk-context" role="status">
        Continuing from Command · {focus.source}: {focus.title}. This names the selected work. It
        is not a sent message and does not start a build.
      </p>
      {children}
    </>
  );
}

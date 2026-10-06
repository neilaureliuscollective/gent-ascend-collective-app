'use client';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { CapabilityId } from '@/domains/intelligence/capabilities';

export type Handoff = {
  text: string;
  ownerId: string;
  target?: CapabilityId;
  conversationId?: string;
  payload?: unknown;
};
type DraftHandoff = {
  peek: () => Handoff | null;
  stage: (draft: Handoff | null) => void;
  take: (target?: CapabilityId, ownerId?: string) => Handoff | null;
};
const DraftContext = createContext<DraftHandoff | null>(null);

/** Transient route handoff only: never URLs, cookies, browser storage or extra model calls. */
export function ConversationDraftProvider({ children }: { children: ReactNode }) {
  const pending = useRef<Handoff | null>(null);
  const value = useMemo<DraftHandoff>(
    () => ({
      peek: () => pending.current,
      stage: (draft) => {
        pending.current = draft;
      },
      take: (target, ownerId) => {
        const draft = pending.current;
        if (!draft) return null;
        if (target && draft.target !== target) return null;
        if (ownerId && draft.ownerId !== ownerId) return null;
        pending.current = null;
        return draft;
      },
    }),
    [],
  );
  return <DraftContext value={value}>{children}</DraftContext>;
}
export function useConversationDraft() {
  return useContext(DraftContext);
}

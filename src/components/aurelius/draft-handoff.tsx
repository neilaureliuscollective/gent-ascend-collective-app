'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

type Handoff = { text: string; ownerId: string };
type DraftHandoff = {
  pending: Handoff | null;
  stage: (draft: Handoff | null) => void;
};
const DraftContext = createContext<DraftHandoff | null>(null);
/** Transient route handoff only: never URLs, cookies, browser storage or model calls. */
export function ConversationDraftProvider({ children }: { children: ReactNode }) {
  const [pending, stage] = useState<Handoff | null>(null);
  return <DraftContext value={{ pending, stage }}>{children}</DraftContext>;
}
export function useConversationDraft() {
  return useContext(DraftContext);
}

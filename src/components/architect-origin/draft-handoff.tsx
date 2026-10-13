'use client';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { z } from 'zod';
import type { OriginProject, ProjectContent, saveCommand } from '@/domains/architect-origin/schema';

export type OriginDraft = {
  base: OriginProject;
  content: ProjectContent;
  pending: z.infer<typeof saveCommand> | null;
  uncertainRun: boolean;
};

/** One transient draft per mounted workspace, never browser storage or history state. */
export function createOriginDraftHandoff() {
  let retained: OriginDraft | null = null;
  return {
    hasDraft() {
      return retained !== null;
    },
    stage(draft: OriginDraft | null) {
      retained = draft?.base.person_id ? structuredClone(draft) : null;
    },
    take(project: OriginProject | undefined) {
      const draft = retained;
      retained = null;
      // Only a fresh, session-bound project read can authorize restoration. Clear on
      // an absent project, owner change or different project; never resurrect later.
      return project && draft?.base.id === project.id && draft.base.person_id === project.person_id
        ? draft
        : null;
    },
  };
}
const DraftContext = createContext<ReturnType<typeof createOriginDraftHandoff> | null>(null);
export function OriginDraftProvider({ children }: { children: ReactNode }) {
  const handoff = useMemo(() => createOriginDraftHandoff(), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (handoff.hasDraft()) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [handoff]);
  return <DraftContext value={handoff}>{children}</DraftContext>;
}
export function useOriginDraft() {
  return useContext(DraftContext);
}

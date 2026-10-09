'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Turn } from '@/domains/intelligence/types';
import type { Workspace } from '@/domains/technology/schema';

export function TalkWebsite({
  turns,
  conversationId,
}: {
  turns: Turn[];
  conversationId: string | null;
}) {
  const [target, setTarget] = useState<{ id: string; name: string; revision: number } | null>(null);
  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get('technology');
    if (!projectId) return;
    const controller = new AbortController();
    void fetch('/api/technology', { cache: 'no-store', signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const workspace = (await r.json()) as Workspace;
        const project = workspace.projects.find((p) => p.id === projectId);
        if (!project?.mission_id) return;
        if (project.conversation_id !== conversationId) return;
        const version = workspace.versions.find(
          (v) => v.project_id === project.id && v.revision === project.revision,
        );
        if (version)
          setTarget({ id: project.id, name: version.brief.name, revision: project.revision });
      })
      .catch(() => {});
    return () => {
      controller.abort();
      setTarget(null);
    };
  }, [conversationId]);
  const turn = turns
    .filter(
      (t) =>
        t.status === 'complete' &&
        t.user_text.trim().length >= 3 &&
        t.user_text.trim().length <= 1000,
    )
    .at(-1);
  if (!target) return null;
  return (
    <div className="talk-mission">
      <p>
        Website: {target.name} · v{target.revision}. Talk does not automatically receive the website
        brief. Review your selected request in Technology before applying it.
      </p>
      {turn && (
        <Link href={`/app/work/technology?project=${target.id}&turn=${turn.id}`}>
          Review latest completed request as a website revision ↗
        </Link>
      )}
      <Link href={`/app/work/technology?project=${target.id}`}>Open website ↗</Link>
    </div>
  );
}

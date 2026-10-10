'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Turn } from '@/domains/intelligence/types';
import { parseWebsiteProposal, planningVersion } from '@/domains/technology/planning';
import type { Workspace } from '@/domains/technology/schema';

export type SelectedWebsiteContext = {
  id: string;
  revision: number;
  conversationId: string;
  enabled: boolean;
};
export function TalkWebsite({
  turns,
  conversationId,
  onContext,
  planning,
  onPlanning,
  mission,
  disabled,
}: {
  turns: Turn[];
  conversationId: string | null;
  onContext: (value: SelectedWebsiteContext | null) => void;
  planning: boolean;
  onPlanning: (value: boolean) => void;
  mission: { id: string; revision: number; conversationId: string } | null;
  disabled: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState<{ id: string; name: string; revision: number } | null>(null);
  useEffect(() => {
    void Promise.resolve().then(() => {
      onContext(null);
      setEnabled(false);
    });
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
  }, [conversationId, onContext]);
  const turn = turns
    .filter(
      (t) =>
        t.status === 'complete' &&
        t.user_text.trim().length >= 3 &&
        t.user_text.trim().length <= 1000,
    )
    .at(-1);
  const proposal = turns
    .filter(
      (t) =>
        t.status === 'complete' &&
        t.prompt_version?.endsWith(`:${planningVersion}`) &&
        parseWebsiteProposal(t.assistant_text),
    )
    .at(-1);
  if (!target)
    return (
      <div className="talk-mission" aria-label="Website planning">
        <label>
          <input
            type="checkbox"
            checked={planning}
            disabled={disabled}
            onChange={(e) => onPlanning(e.target.checked)}
          />{' '}
          Plan a website with Aethelios
        </label>
        {planning && (
          <p>
            Describe your business, audience and goals. Aethelios will ask about missing essentials
            and propose a brief for your review. Planning uses the normal Talk allowance. Nothing is
            built or published here; your conversation saves with each reply.
          </p>
        )}
        {proposal &&
          (mission?.conversationId === conversationId ? (
            <Link href={`/app/work/technology?mission=${mission.id}&proposal=${proposal.id}`}>
              Review proposed website brief ↗
            </Link>
          ) : (
            <p>
              Capture this conversation as a Mission to review the proposal in Technology and
              preserve its conversation link.
            </p>
          ))}
      </div>
    );
  return (
    <div className="talk-mission">
      <p>
        Website: {target.name} · v{target.revision}. Discuss a saved version, then review changes in
        Technology before applying them.
      </p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            onPlanning(false);
            onContext({
              id: target.id,
              revision: target.revision,
              conversationId: conversationId!,
              enabled: e.target.checked,
            });
          }}
        />{' '}
        Include this website brief in my next Talk message
      </label>
      {enabled && (
        <p>
          Sends the exact saved v{target.revision} brief with your message. If the website changes,
          reload before sending. Talk proposes changes; it does not apply them.
        </p>
      )}
      {turn && (
        <Link href={`/app/work/technology?project=${target.id}&turn=${turn.id}`}>
          Review latest completed request as a website revision ↗
        </Link>
      )}
      <Link href={`/app/work/technology?project=${target.id}`}>Open website ↗</Link>
    </div>
  );
}

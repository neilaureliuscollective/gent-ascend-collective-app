'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Mission } from '@/domains/missions/schema';
import {
  directionFields,
  type Direction,
  type MissionProposal,
} from '@/domains/missions/continuity-schema';
import { jsonRequest } from '@/components/aurelius/memory-editor';

type Continuity = {
  mission: Mission;
  proposals: MissionProposal[];
  projectId: string | null;
  studioRevision: number | null;
  outputs: { id: string; assistant_text: string; created_at: string }[];
  images: { id: string; status: string; prompt: string; created_at: string }[];
};
const fields: [keyof Direction, string][] = [
  ['title', 'Name'],
  ['objective', 'Objective'],
  ['decisions', 'Decisions'],
  ['open_questions', 'Open questions'],
  ['next_actions', 'Next action'],
];
export type SelectedMissionContext = {
  enabled: boolean;
  id: string;
  revision: number;
  conversationId: string;
};
export function MissionContinuity({
  mission,
  turnId,
  onChange,
}: {
  mission: Mission;
  turnId?: string;
  onChange?: () => void;
}) {
  const [data, setData] = useState<Continuity | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    fetch(`/api/missions/continuity?id=${mission.id}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [mission.id, mission.revision]);
  async function act(body: unknown) {
    if (busy || uncertain) return;
    setBusy(true);
    setError('');
    try {
      const result = (await jsonRequest('/api/missions/continuity', 'POST', body)) as {
        projectId?: string;
      };
      if (result.projectId) {
        router.push(`/app/studio?project=${result.projectId}`);
        return;
      }
      const response = await fetch(`/api/missions/continuity?id=${mission.id}`, {
        cache: 'no-store',
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      setData(next);
      onChange?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save was not confirmed.');
      setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  const current = data?.mission ?? mission;
  return (
    <section className="mission-continuity" aria-label="Mission continuity">
      <p className="eyebrow">Saved direction · revision {current.revision}</p>
      <h3>{current.title}</h3>
      <p>{current.objective}</p>
      <p>
        <strong>Next move</strong> ·{' '}
        {current.next_actions || 'Choose the next useful step with Aethelios.'}
      </p>
      <div className="mission-actions">
        <Link href={`/app/aethelios?conversation=${current.conversation_id}`}>
          Continue in Talk ↗
        </Link>
        <button
          type="button"
          className="secondary-button"
          disabled={
            busy ||
            uncertain ||
            !data ||
            (!data.projectId && ['archived', 'completed'].includes(current.status))
          }
          onClick={() =>
            data?.projectId
              ? router.push(`/app/studio?project=${data.projectId}`)
              : void act({ action: 'studio', missionId: current.id, revision: current.revision })
          }
        >
          {data?.projectId ? 'Open linked Studio' : 'Prepare creative project'}
        </button>
        {turnId && (
          <>
            <button
              type="button"
              className="text-button"
              disabled={
                busy || uncertain || !data || ['archived', 'completed'].includes(current.status)
              }
              onClick={() =>
                void act({
                  action: 'propose',
                  missionId: current.id,
                  revision: current.revision,
                  turnId,
                  requestId: crypto.randomUUID(),
                })
              }
            >
              Propose direction update
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy || uncertain || !data}
              onClick={() => void act({ action: 'pin', missionId: current.id, turnId })}
            >
              Pin latest reply
            </button>
          </>
        )}
      </div>
      <p className="quiet-label">
        Creative preparation saves an editable brief. You choose when to generate. Direction
        proposals use the latest completed reply and need your review.
      </p>
      {data?.studioRevision && data.studioRevision !== current.revision && (
        <p>
          The linked Studio brief began at revision {data.studioRevision}. Review its direction
          before generating.
        </p>
      )}
      {busy && <p role="status">Saving your next move…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" className="text-button" onClick={() => window.location.reload()}>
            Reload saved state
          </button>
        </p>
      )}
      {data?.proposals.map((p) => (
        <ProposalReview
          key={p.id}
          proposal={p}
          current={current}
          disabled={busy || uncertain}
          decide={(direction) => void act({ action: 'decide', proposalId: p.id, direction })}
        />
      ))}
      <details>
        <summary>Saved decisions & outputs</summary>
        <p>
          <strong>Decisions</strong> · {current.decisions || 'No decisions recorded.'}
        </p>
        <p>
          <strong>Open questions</strong> · {current.open_questions || 'None recorded.'}
        </p>
        {!data?.outputs.length && !data?.images.length && (
          <p>No pinned outputs yet. Your conversation remains saved.</p>
        )}
        {data?.outputs.map((o) => (
          <details key={o.id}>
            <summary>Saved reply · {new Date(o.created_at).toLocaleDateString()}</summary>
            <p className="mission-output-text">{o.assistant_text}</p>
          </details>
        ))}
        {data?.images.map((i) => (
          <p key={i.id}>
            {i.status === 'complete' ? (
              <a
                href={`/api/studio/image?id=${i.id}&kind=version`}
                target="_blank"
                rel="noreferrer"
              >
                Open saved visual ↗
              </a>
            ) : (
              <span>Visual · {i.status}</span>
            )}{' '}
            · {i.prompt.slice(0, 120)}
          </p>
        ))}
      </details>
    </section>
  );
}
function ProposalReview({
  proposal,
  current,
  disabled,
  decide,
}: {
  proposal: MissionProposal;
  current: Mission;
  disabled: boolean;
  decide: (d: Direction | null) => void;
}) {
  const [value, setValue] = useState(() => directionFields(proposal.direction));
  const stale = proposal.base_revision !== current.revision;
  return (
    <details className="mission-proposal" open>
      <summary>Review proposed direction</summary>
      <p>
        From one saved turn · based on revision {proposal.base_revision}.{' '}
        {stale
          ? 'Direction has changed. Dismiss and prepare a fresh proposal.'
          : 'Edit any field before accepting.'}
      </p>
      {fields
        .filter(([key]) => proposal.direction[key] !== current[key])
        .map(([key, label]) => (
          <label key={key}>
            {label}
            <span className="quiet-label">Previously: {current[key] || 'Not recorded'}</span>
            <textarea
              rows={2}
              value={value[key]}
              maxLength={key === 'title' ? 120 : key === 'decisions' ? 4000 : 2000}
              disabled={disabled || stale}
              onChange={(e) => setValue({ ...value, [key]: e.target.value })}
            />
          </label>
        ))}
      <div className="mission-actions">
        <button
          type="button"
          className="button"
          disabled={disabled || stale || !value.title.trim() || value.objective.trim().length < 3}
          onClick={() => decide(value)}
        >
          Accept reviewed direction
        </button>
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => decide(null)}
        >
          Dismiss
        </button>
      </div>
    </details>
  );
}
export function TalkMission({
  conversationId,
  turnId,
  onContext,
}: {
  conversationId: string | null;
  turnId?: string;
  onContext: (value: SelectedMissionContext | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(`/api/missions${conversationId ? `?conversation=${conversationId}` : ''}`, {
      cache: 'no-store',
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d) => {
        if (active) {
          setMissions(d.missions);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [conversationId, refresh]);
  const mission = conversationId
    ? missions.find((m) => m.conversation_id === conversationId)
    : undefined;
  const allowed = !!mission && !['archived', 'completed'].includes(mission.status);
  useEffect(() => {
    onContext(
      !error && mission
        ? {
            enabled: enabled && allowed,
            id: mission.id,
            revision: mission.revision,
            conversationId: mission.conversation_id,
          }
        : null,
    );
  }, [enabled, allowed, mission, onContext, error]);
  if (error)
    return (
      <p role="status">
        Mission context unavailable. <Link href="/app/missions">Check Missions ↗</Link>
      </p>
    );
  if (!conversationId && !missions.length) return null;
  if (!conversationId)
    return (
      <div className="mission-recent" aria-label="Continue a Mission">
        {missions
          .filter((m) => !['archived', 'completed'].includes(m.status))
          .slice(0, 3)
          .map((m) => (
            <Link key={m.id} href={`/app/aethelios?conversation=${m.conversation_id}`}>
              Continue · {m.title}
            </Link>
          ))}
      </div>
    );
  if (!mission) return null;
  return (
    <div className="talk-mission">
      <button
        type="button"
        className="text-button talk-mission-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        Mission · {mission.title} · {enabled && allowed ? 'context on' : 'context off'}
      </button>
      <dialog
        id="mission-context"
        ref={dialog}
        className="council-dialog mission-dialog"
        aria-labelledby="mission-dialog-title"
      >
        <header>
          <h2 id="mission-dialog-title">Mission direction</h2>
          <button type="button" className="text-button" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>
        <label>
          <input
            type="checkbox"
            checked={enabled && allowed}
            disabled={!allowed}
            onChange={(e) => setEnabled(e.target.checked)}
          />{' '}
          Use this Mission’s reviewed direction in Talk and Council
        </label>
        <MissionContinuity
          mission={mission}
          turnId={turnId}
          onChange={() => setRefresh((n) => n + 1)}
        />
      </dialog>
    </div>
  );
}

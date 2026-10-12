'use client';
import Link from 'next/link';
import Markdown from 'react-markdown';
import { useEffect, useRef, useState } from 'react';
import type { readCompanyTalk } from '@/domains/companies/service';
import { observedOperation } from '@/platform/visual/operation-adapters';
import { IntelligenceStatus, IntelligenceResponse } from '../intelligence-motion/presence';
import type { IntelligenceOperation } from '@/platform/visual/intelligence-motion';
import { companyJobs } from '@/domains/company-work/starters';
import {
  council,
  allSpecialists,
  councilFromVersion,
  type SpecialistId,
  type CouncilSelection,
} from '@/domains/intelligence/council';
import { CouncilPanel } from '@/components/aurelius/council-panel';
import type { readWork } from '@/domains/company-work/service';
import { readConversationStream } from '@/platform/conversation/read-stream';
import { frameText } from '@/components/aurelius/frame-text';
import { TalkDrawer, TalkInput } from '@/components/aurelius/talk-controls';
import { TalkPresence } from '@/components/aurelius/talk-presence';
import { useTalkViewport } from '@/components/aurelius/conversation-viewport';
import { ConversationTurn } from '@/components/aurelius/message';
import { JobCreator } from './job-creator';
import { WorkPanel } from './work-panel';
import { BriefEditor } from './brief-editor';
import { MissionTasks } from '@/components/founder-office/mission-tasks';
import { MissionApprovals } from '@/components/founder-office/mission-approvals';
type RoomData = Awaited<ReturnType<typeof readCompanyTalk>>;
export function CompanyRoom({
  initial,
  initialConversation,
  initialWork,
}: {
  initial: RoomData;
  initialConversation?: string;
  initialWork?: Awaited<ReturnType<typeof readWork>>;
}) {
  const [data, setData] = useState(initial);
  const [work, setWork] = useState(initialWork);
  const [showWork, setShowWork] = useState(false);
  const [focused, setFocused] = useState(true);
  const room = useRef<HTMLElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [away, setAway] = useState(false);
  useTalkViewport(room);
  const [jobs, setJobs] = useState<Array<{ id: string; scope: { request: string } }>>([]);
  const [jobsError, setJobsError] = useState('');
  const [creatingJob, setCreatingJob] = useState(false);
  const [outputMode, setOutputMode] = useState(false);
  const [revision, setRevision] = useState<{
    sourceTurnId: string;
    revisionKind: 'retry' | 'regenerate' | 'edit';
  } | null>(null);
  const [generation, setGeneration] = useState<{
    requestId: string;
    expected: number;
    instruction: string;
    specialistId?: SpecialistId;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/company-work?companyId=${initial.company.id}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Jobs unavailable.');
        setJobs(result.jobs);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setJobsError(e instanceof Error ? e.message : 'Jobs unavailable.');
      });
    return () => controller.abort();
  }, [initial.company.id]);
  const [conversation, setConversation] = useState(initialConversation ?? '');
  const [draft, setDraft] = useState('');
  const [coworker, setCoworker] = useState<SpecialistId | ''>(() => {
    const assigned = initialWork?.job.scope.constraints.match(
      /^Assigned Coworker: ([a-z]+)\./,
    )?.[1];
    return (
      (initial.founderAccess ? allSpecialists : council).find((member) => member.id === assigned)
        ?.id ?? ''
    );
  });
  const [partial, setPartial] = useState('');
  const [team, setTeam] = useState<CouncilSelection | null>(() => {
    const prior = councilFromVersion(initial.turns.at(-1)?.prompt_version ?? '');
    return prior?.kind === 'table' ? prior : null;
  });
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<IntelligenceOperation>(
    observedOperation('work-idle', 'ready'),
  );
  const [streaming, setStreaming] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setFocused(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  const recoverable = work
    ? data.turns
        .filter(
          (turn) =>
            turn.status === 'complete' &&
            turn.assistant_text.includes('```company-work') &&
            !work.versions.some((v) => v.source_turn === turn.id),
        )
        .map((turn) => {
          const match = turn.user_text.match(/^\[Job work v(\d+)\] ([\s\S]*)$/);
          return match && Number(match[1]) === work.job.revision && match[2]
            ? {
                requestId: turn.id,
                expected: Number(match[1]),
                instruction: match[2],
                specialistId: councilFromVersion(turn.prompt_version)?.specialists[0],
              }
            : null;
        })
        .find(Boolean)
    : null;
  function remember(id: string) {
    if (work) return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('conversation', id);
    else url.searchParams.delete('conversation');
    window.history.replaceState(null, '', url);
  }
  async function read(id: string, before?: string, listBefore?: string) {
    const query = new URLSearchParams({ companyId: data.company.id });
    if (id) query.set('conversationId', id);
    if (before) query.set('before', before);
    if (listBefore) query.set('listBefore', listBefore);
    const response = await fetch(`/api/company-talk?${query}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Company conversation unavailable.');
    return result as RoomData;
  }
  const olderScroll = useRef<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const el = transcript.current,
      before = olderScroll.current;
    if (el && before) {
      el.scrollTop = before.top + el.scrollHeight - before.height;
      olderScroll.current = null;
    }
  }, [data.turns]);
  async function load(id: string, older = false, more = false) {
    setBusy(true);
    setError('');
    try {
      const next = await read(
        id,
        older ? data.turns[0]?.created_at : undefined,
        more ? (data.nextCursor ?? undefined) : undefined,
      );
      if (work && !older && !more) {
        const response = await fetch(
          `/api/company-work?companyId=${data.company.id}&jobId=${work.job.id}`,
          { cache: 'no-store' },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Job unavailable.');
        setWork(result);
      }
      if (older && transcript.current) {
        follow.current = false;
        olderScroll.current = {
          height: transcript.current.scrollHeight,
          top: transcript.current.scrollTop,
        };
      }
      setData((previous) => ({
        ...next,
        turns: older ? [...next.turns, ...previous.turns] : more ? previous.turns : next.turns,
        hasOlderTurns: more ? previous.hasOlderTurns : next.hasOlderTurns,
        conversations: more
          ? [...previous.conversations, ...next.conversations]
          : next.conversations,
      }));
      if (!older && !more) {
        setConversation(id);
        setDraft('');
        setPartial('');
        setSent('');
        setNeedsReload(false);
        remember(id);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Conversation unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function send(
    recover = false,
    payload?: NonNullable<typeof generation>,
    contribution?: { text: string; selection: CouncilSelection },
  ) {
    const recovery = payload ?? generation;
    const text = contribution?.text ?? (recover && recovery ? recovery.instruction : draft.trim());
    if (!text || busy || (needsReload && !recover)) return;
    const id = conversation || crypto.randomUUID();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setStreaming(true);
    setError('');
    setPartial('');
    setSent(text);
    const outputRequest =
      work && (outputMode || recover)
        ? recover && recovery
          ? recovery
          : {
              requestId: crypto.randomUUID(),
              expected: work.job.revision,
              instruction: text,
              ...(coworker ? { specialistId: coworker } : {}),
            }
        : null;
    if (outputRequest) setGeneration(outputRequest);
    const motionId = outputRequest?.requestId ?? crypto.randomUUID();
    setOperation(observedOperation(motionId, 'waiting', 'pending'));
    let saved = false;
    const painted = frameText(setPartial);
    let accepted = false;
    try {
      if (outputRequest && work) {
        const response = await fetch('/api/company-work', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            companyId: data.company.id,
            jobId: work.job.id,
            ...outputRequest,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Deliverable generation unavailable.');
        saved = true;
        setOperation(observedOperation(motionId, 'complete', 'confirmed'));
        setWork(result);
        setShowWork(true);
        setData(await read(work.job.conversation_id));
        setDraft('');
        setPartial('');
        setSent('');
        setOutputMode(false);
        setGeneration(null);
        setNeedsReload(false);
        return;
      }
      const response = await fetch('/api/company-talk/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aethelios-Motion': '1' },
        signal: controller.signal,
        body: JSON.stringify({
          companyId: data.company.id,
          conversationId: id,
          requestId: motionId,
          text,
          ...(work ? { jobId: work.job.id } : {}),
          ...(revision ?? {}),
          ...(contribution?.selection
            ? { council: contribution.selection }
            : team
              ? { council: team }
              : coworker
                ? { council: { kind: 'specialist', specialists: [coworker] } }
                : {}),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'Reply unavailable.');
      }
      // The server accepted the immutable binding. Keep a reload link even if streaming fails.
      accepted = true;
      setConversation(id);
      remember(id);
      setDraft((current) => (current.trim() === text ? '' : current));
      for await (const event of readConversationStream(response.body)) {
        if (event.type === 'activity') {
          if (event.phase === 'saving') painted.finish(true);
          setOperation(observedOperation(motionId, event.phase, 'pending'));
        } else if (event.type === 'delta') {
          setOperation((previous) =>
            previous.id === motionId && ['searching', 'generating'].includes(previous.phase)
              ? previous
              : observedOperation(motionId, 'generating', 'pending'),
          );
          painted.append(event.text);
        } else if (event.type === 'error') throw new Error(event.message);
        else if (event.type === 'saved') {
          painted.finish();
          saved = true;
          setOperation(observedOperation(motionId, 'complete', 'confirmed'));
          setData((previous) => ({ ...previous, turns: [...previous.turns, event.turn] }));
        }
      }
      if (!saved) throw new Error('Reply did not confirm a save. Reload before trying again.');
      setRevision(null);
      setPartial('');
      setSent('');
      setData(await read(id));
    } catch (error) {
      if (accepted && !saved) setDraft((current) => current || text);
      setOperation(
        observedOperation(
          motionId,
          saved ? 'complete' : controller.signal.aborted ? 'cancelled' : 'failed',
          saved ? 'confirmed' : accepted || outputRequest ? 'uncertain' : 'not-applicable',
        ),
      );
      if ((accepted || outputRequest) && !saved) setNeedsReload(true);
      setError(
        saved
          ? 'Reply saved; refresh to update the conversation list.'
          : outputRequest
            ? error instanceof Error
              ? error.message
              : 'Generation was interrupted. Reload or recover the exact request.'
            : controller.signal.aborted
              ? 'Reply stopped. Reload to check the saved record before sending again.'
              : error instanceof Error
                ? error.message
                : 'Reply unavailable. Reload before trying again.',
      );
    } finally {
      painted.finish(!saved);
      setBusy(false);
      setStreaming(false);
      requestRef.current = null;
    }
  }
  useEffect(() => {
    if (follow.current && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [partial, sent, data.turns]);
  return (
    <section
      ref={room}
      className={`company-work talk-company company-room${focused ? ' company-room-focused' : ''}`}
      aria-labelledby="company-room-title"
    >
      <header className="talk-company-heading">
        <TalkPresence
          operation={operation}
          state={busy ? 'working' : needsReload ? 'stopped' : 'ready'}
        />
        <Link href="/app/work" aria-label="Companies">
          ←
        </Link>
        <h1 id="company-room-title">{data.company.name}</h1>
        <TalkDrawer label="Company history">
          {(close) => (
            <>
              {' '}
              <aside aria-label="Company conversations">
                <h2>Saved jobs</h2>
                {jobs.map((job) => (
                  <Link key={job.id} href={`/app/companies/${data.company.id}/work/${job.id}`}>
                    {job.scope.request}
                  </Link>
                ))}
                {jobsError && <p role="alert">{jobsError}</p>}
                <h2>Conversations</h2>
                {!work &&
                  data.conversations.map((row) => (
                    <button
                      key={row.id}
                      disabled={busy}
                      aria-current={row.id === conversation ? 'page' : undefined}
                      onClick={() => {
                        if (
                          draft.trim() &&
                          !confirm('Discard the unsent draft and switch conversations?')
                        )
                          return;
                        close();
                        follow.current = true;
                        setAway(false);
                        void load(row.id);
                      }}
                    >
                      {row.title}
                    </button>
                  ))}
                {!data.conversations.length && <p>No saved conversations yet.</p>}
                {!work && data.nextCursor && (
                  <button disabled={busy} onClick={() => void load(conversation, false, true)}>
                    More conversations
                  </button>
                )}
              </aside>
            </>
          )}
        </TalkDrawer>
        <TalkDrawer label="Company tools">
          <div className="company-room-actions">
            <button aria-pressed={focused} onClick={() => setFocused((value) => !value)}>
              {focused ? 'Exit full-screen' : 'Full-screen work'}
            </button>
            <button
              onClick={(event) => {
                event.currentTarget.closest('dialog')?.close();
                setEditing(true);
              }}
              disabled={busy}
            >
              Review brief · v{data.company.version}
            </button>
            {!work && (
              <button
                disabled={busy}
                onClick={(event) => {
                  if (
                    draft.trim() &&
                    !confirm('Discard the unsent draft and start a new company conversation?')
                  )
                    return;
                  event.currentTarget.closest('dialog')?.close();
                  follow.current = true;
                  setAway(false);
                  setConversation('');
                  setData((previous) => ({ ...previous, turns: [], hasOlderTurns: false }));
                  setDraft('');
                  setPartial('');
                  setSent('');
                  setError('');
                  setNeedsReload(false);
                  remember('');
                }}
              >
                New conversation
              </button>
            )}
            <button
              disabled={busy}
              onClick={(event) => {
                event.currentTarget.closest('dialog')?.close();
                setCreatingJob(true);
              }}
            >
              Prepare a saved job
            </button>
          </div>

          <label>
            Bring in a specialist
            <select
              value={coworker}
              disabled={busy}
              onChange={(event) => {
                setTeam(null);
                setCoworker(
                  (data.founderAccess ? allSpecialists : council).find(
                    (member) => member.id === event.target.value,
                  )?.id ?? '',
                );
              }}
            >
              <option value="">Aethelios · direct conversation</option>
              {(data.founderAccess ? allSpecialists : council).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
          </label>
          {work && (
            <label>
              Conversation action
              <select
                disabled={busy || needsReload}
                value={outputMode ? 'deliverable' : 'discuss'}
                onChange={(e) => {
                  setOutputMode(e.target.value === 'deliverable');
                  if (e.target.value === 'deliverable') setTeam(null);
                  setRevision(null);
                }}
              >
                <option value="discuss">Discuss the job · saves a reply</option>
                <option value="deliverable">Revise deliverable · saves a new version</option>
              </select>
            </label>
          )}
          <p className="company-room-boundary">
            This room uses its confirmed company brief. Personal memory and other companies remain
            outside this conversation.
          </p>
          <CouncilPanel
            founder={Boolean(data.founderAccess)}
            companyMode
            question={draft.trim() || data.turns.at(-1)?.user_text || ''}
            selection={team ?? (coworker ? { kind: 'specialist', specialists: [coworker] } : null)}
            disabled={busy || outputMode || needsReload || !data.canChat}
            includeContext={false}
            onSelect={(selection) => {
              setTeam(selection?.kind === 'table' ? selection : null);
              setCoworker(selection?.kind === 'specialist' ? selection.specialists[0]! : '');
            }}
            onFocused={(id) => {
              setCoworker(id);
              setTeam(null);
              setDraft(
                `Review this company through your ${allSpecialists.find((member) => member.id === id)?.role ?? 'specialist'} lens. Use only the confirmed company brief and this conversation.`,
              );
            }}
            onAssemble={(text, selection) => {
              setTeam(selection);
              setCoworker('');
              setDraft(text);
              void send(false, undefined, { text, selection });
            }}
          />
        </TalkDrawer>
      </header>
      {editing && (
        <BriefEditor
          company={data.company}
          onCancel={() => setEditing(false)}
          onSaved={(company) => {
            setData((previous) => ({ ...previous, company }));
            setEditing(false);
          }}
        />
      )}
      {creatingJob && (
        <JobCreator
          companyId={data.company.id}
          seed={draft || data.turns.at(-1)?.user_text || ''}
          onCancel={() => setCreatingJob(false)}
        />
      )}
      <div className="company-room-layout">
        <div className="company-room-talk">
          {work && (
            <div className="company-room-actions">
              <button aria-pressed={!showWork} onClick={() => setShowWork(false)}>
                Conversation
              </button>
              <button aria-pressed={showWork} onClick={() => setShowWork(true)}>
                Brief & presentation ·{' '}
                {work.versions.length ? `v${work.job.revision}` : 'not drafted'}
              </button>
            </div>
          )}
          {work && (
            <div hidden={!showWork}>
              <WorkPanel
                work={work}
                busy={busy}
                onChanged={setWork}
                onRevise={() => {
                  setShowWork(false);
                  setOutputMode(true);
                  setDraft(
                    work.versions.length
                      ? 'Revise the offer and opening slide. Preserve the other slides.'
                      : 'Create a strategy brief and presentation from the confirmed scope.',
                  );
                  document.getElementById('company-composer')?.focus();
                }}
              />
              {data.founderAccess && (
                <MissionTasks work={work} onChanged={setWork} disabled={busy} />
              )}
              {data.founderAccess && (
                <MissionApprovals work={work} onChanged={setWork} disabled={busy} />
              )}
            </div>
          )}
          <div
            className="talk-company-transcript"
            ref={transcript}
            hidden={showWork}
            aria-label="Conversation messages"
            onScroll={(e) => {
              const el = e.currentTarget;
              follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
              setAway(!follow.current);
            }}
          >
            {!work && !data.turns.length && !sent && (
              <>
                <h2>What should we move forward?</h2>
                <p>Choose a job to prepare a draft, or describe the outcome below.</p>
                <div className="company-room-actions">
                  {companyJobs.map((job) => (
                    <button key={job.id} disabled={busy} onClick={() => setDraft(job.draft)}>
                      {job.title}
                    </button>
                  ))}
                </div>
              </>
            )}
            {work && !data.turns.length && !sent && (
              <div>
                <h2>Build this company job</h2>
                <p>{work.job.scope.request}</p>
                <button
                  disabled={busy || needsReload}
                  onClick={() => {
                    setOutputMode(true);
                    setCoworker('');
                    setDraft('Create a strategy brief and presentation from the confirmed scope.');
                    document.getElementById('company-composer')?.focus();
                  }}
                >
                  Prepare deliverable generation
                </button>
              </div>
            )}
            {data.hasOlderTurns && (
              <button disabled={busy} onClick={() => void load(conversation, true)}>
                Earlier messages
              </button>
            )}
            {data.turns
              .filter((turn) => !data.turns.some((newer) => newer.parent_turn_id === turn.id))
              .map((turn) => (
                <ConversationTurn
                  key={turn.id}
                  turn={turn}
                  operation={turn.id === operation.id ? operation : undefined}
                  disabled={busy}
                  companyWork
                  versions={data.turns.filter((previous) => previous.id === turn.parent_turn_id)}
                  onCopy={() =>
                    void navigator.clipboard
                      .writeText(turn.assistant_text.replace(/```company-work\n[\s\S]*?\n```/g, ''))
                      .catch(() => setError('Copy unavailable. Select the text to copy.'))
                  }
                  onRevise={
                    turn.id === data.turns.at(-1)?.id &&
                    !turn.assistant_text.includes('```company-work')
                      ? (kind) => {
                          setOutputMode(false);
                          setRevision({ sourceTurnId: turn.id, revisionKind: kind });
                          setDraft(turn.user_text);
                          document.getElementById('company-composer')?.focus();
                        }
                      : undefined
                  }
                />
              ))}
            {sent && (
              <article className="company-room-turn">
                <h3>You</h3>
                <p className="company-room-user">{sent}</p>
                <h3>
                  {coworker ? council.find((member) => member.id === coworker)?.name : 'Aethelios'}{' '}
                  · {busy ? 'working' : 'unconfirmed reply'}
                </h3>
                <IntelligenceResponse
                  operation={operation}
                  name={
                    coworker ? council.find((member) => member.id === coworker)?.name : 'Aethelios'
                  }
                />
                <Markdown skipHtml>{partial || 'Preparing the response…'}</Markdown>
              </article>
            )}
            {operation.phase !== 'ready' && <IntelligenceStatus operation={operation} />}
            {error && <p role="alert">{error}</p>}
          </div>
          {away && !showWork && (
            <button
              className="latest-message"
              type="button"
              onClick={() => {
                follow.current = true;
                setAway(false);
                transcript.current?.scrollTo({
                  top: transcript.current.scrollHeight,
                  behavior: 'instant',
                });
              }}
            >
              Latest message ↓
            </button>
          )}
          {recoverable && !generation && !busy && (
            <button onClick={() => void send(true, recoverable)}>
              Recover saved deliverable · no new model request
            </button>
          )}
          {generation && !busy && (
            <button onClick={() => void send(true)}>Recover exact deliverable request</button>
          )}
          {revision && (
            <p>
              Revising the latest reply · {revision.revisionKind}{' '}
              <button disabled={busy} onClick={() => setRevision(null)}>
                Cancel revision
              </button>
            </p>
          )}
          <form
            className="talk-composer"
            hidden={showWork}
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <TalkInput
              id="company-composer"
              label={`Work with ${data.company.name}`}
              value={draft}
              onChange={setDraft}
              inputRef={composer}
              disabled={busy && outputMode}
              placeholder={`Message ${data.company.name}…`}
            />
            <div className="talk-composer-actions">
              <button
                className="button"
                disabled={busy || needsReload || !data.canChat || !draft.trim()}
              >
                {outputMode ? 'Generate deliverable version' : 'Send'}
              </button>
              {streaming && (
                <button type="button" onClick={() => requestRef.current?.abort()}>
                  Stop
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => void load(conversation)}>
                Reload saved work
              </button>
            </div>
          </form>
          {!data.canChat && (
            <p>
              Talk requires enabled account access and a configured model connection. Your company
              brief remains available.
            </p>
          )}
          <p className="company-room-boundary" hidden={focused}>
            Private company work. Client access, shared approvals and file uploads remain outside
            this room. Reviewed export is an explicit version, not client publication.
          </p>
        </div>
      </div>
    </section>
  );
}

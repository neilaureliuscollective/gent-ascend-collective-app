'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConversationDraft } from './draft-handoff';
import { CouncilPanel } from './council-panel';
import {
  councilFromVersion,
  councilPromptVersion,
  councilLabel,
  relevantCouncil,
  specialist,
  type CouncilSelection,
} from '@/domains/intelligence/council';
import type { StreamEvent, Turn, WorkspaceData } from '@/domains/intelligence/types';
import { MemoryEditor, jsonRequest } from './memory-editor';
import { ConversationTurn } from './message';
import { frameText } from './frame-text';
import { TalkDrawer, TalkInput } from './talk-controls';
import { TalkPresence } from './talk-presence';
import { AppearanceControls } from '../visual/appearance';
import { ConversationLibrary } from './conversation-library';
import { ContextPanel } from './context-panel';
import { disconnectedWorkspace } from './preview';
import { AureliusPresence } from '../visual/aurelius-presence';
import { OrbPresentation } from '../visual/orb-presentation';
import { routeCapability } from '@/domains/intelligence/capabilities';
function priorVersions(turn: Turn, turns: Turn[]) {
  const versions: Turn[] = [];
  let parent = turn.parent_turn_id;
  while (parent && versions.length < 20) {
    const previous = turns.find((item) => item.id === parent);
    if (!previous) break;
    versions.push(previous);
    parent = previous.parent_turn_id;
  }
  return versions;
}

import { TodayActions } from './today-actions';
export function AureliusWorkspace({
  compact = false,
  initialDraft = '',
  initialConversation = null,
  founderLinked = false,
}: {
  compact?: boolean;
  initialDraft?: string;
  initialConversation?: string | null;
  founderLinked?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const router = useRouter();
  const composer = useRef<HTMLTextAreaElement>(null);
  const tableReview = useRef<{ open: (asTable?: boolean) => void }>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [selected, setSelected] = useState<string | null>(initialConversation);
  const handoff = useConversationDraft();
  const [homeDraft] = useState(() =>
    !compact && !initialConversation && !initialDraft && !handoff?.peek()?.target
      ? (handoff?.peek() ?? null)
      : null,
  );
  const [draft, setDraft] = useState(initialDraft || homeDraft?.text || '');
  useEffect(() => {
    if (homeDraft && handoff?.peek() === homeDraft) handoff.take(undefined, homeDraft.ownerId);
  }, [homeDraft, handoff]);
  const [councilSelection, setCouncilSelection] = useState<CouncilSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const [tab, setTab] = useState<'conversation' | 'memory' | 'context'>('conversation');
  const [includeContext, setIncludeContext] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [revision, setRevision] = useState<{ sourceTurnId: string; revisionKind: 'edit' } | null>(
    null,
  );
  const generation = useRef<AbortController | null>(null);
  const reading = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  function rememberConversation(id: string | null) {
    if (compact || !window.location.pathname.endsWith('/aethelios')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('starter');
    if (id) url.searchParams.set('conversation', id);
    else url.searchParams.delete('conversation');
    window.history.replaceState(window.history.state, '', url);
  }
  const load = useCallback(
    async (id: string | null = null) => {
      reading.current?.abort();
      const controller = new AbortController();
      reading.current = controller;
      try {
        const response = await fetch('/api/aurelius' + (id ? `?conversationId=${id}` : ''), {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        setError('');
        if (response.status === 401) {
          setPreview(true);
          setCouncilSelection(null);
          setData(disconnectedWorkspace);
          setSelected(null);
          setDraft('');
          setNeedsReload(false);
          return;
        }
        if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
        setPreview(false);
        if (homeDraft && (result as WorkspaceData).ownerId !== homeDraft.ownerId) setDraft('');
        setData(result as WorkspaceData);
        setCouncilSelection(
          councilFromVersion((result as WorkspaceData).turns.at(-1)?.prompt_version ?? ''),
        );
        setSelected(id);
        if (!compact && window.location.pathname.endsWith('/aethelios')) {
          const url = new URL(window.location.href);
          if (id) url.searchParams.set('conversation', id);
          else url.searchParams.delete('conversation');
          window.history.replaceState(window.history.state, '', url);
        }
        setNeedsReload(false);
        setConfirmDelete(false);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Your workspace could not be loaded.');
          throw e;
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [compact, homeDraft],
  );
  function reload(id: string | null = null) {
    setLoading(true);
    setError('');
    return load(id);
  }
  async function updateConversation(id: string, title: string | null, archived: boolean | null) {
    try {
      await jsonRequest('/api/aurelius', 'PATCH', { id, title, archived });
      await reload(selected);
      setNotice(
        archived === true
          ? 'Conversation archived.'
          : archived === false
            ? 'Conversation restored.'
            : 'Title saved.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversation could not be updated.');
      throw e;
    }
  }
  const olderScroll = useRef<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const el = scroll.current,
      before = olderScroll.current;
    if (el && before) {
      el.scrollTop = before.top + el.scrollHeight - before.height;
      olderScroll.current = null;
    }
  }, [data?.turns]);
  async function loadOlder() {
    const first = data?.turns[0];
    if (!selected || !first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await fetch(
        `/api/aurelius?conversationId=${selected}&before=${encodeURIComponent(first.created_at)}`,
        { cache: 'no-store' },
      );
      const older = (await response.json()) as WorkspaceData;
      if (!response.ok) throw new Error('Older messages could not be loaded.');
      if (scroll.current)
        olderScroll.current = {
          height: scroll.current.scrollHeight,
          top: scroll.current.scrollTop,
        };
      setData((previous) =>
        previous
          ? {
              ...previous,
              turns: [...older.turns, ...previous.turns],
              hasOlderTurns: older.hasOlderTurns,
            }
          : previous,
      );
      follow.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Older messages could not be loaded.');
    } finally {
      setLoadingOlder(false);
    }
  }
  async function loadMoreConversations() {
    if (!data?.nextConversationCursor) return;
    const response = await fetch(
      `/api/aurelius?listBefore=${encodeURIComponent(data.nextConversationCursor)}`,
      { cache: 'no-store' },
    );
    const more = (await response.json()) as WorkspaceData;
    if (!response.ok) {
      setError('More conversations could not be loaded.');
      return;
    }
    setData((previous) =>
      previous
        ? {
            ...previous,
            conversations: [
              ...previous.conversations,
              ...more.conversations.filter(
                (c) => !previous.conversations.some((p) => p.id === c.id),
              ),
            ],
            nextConversationCursor: more.nextConversationCursor,
          }
        : previous,
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    reading.current = controller;
    void fetch(
      '/api/aurelius' + (initialConversation ? `?conversationId=${initialConversation}` : ''),
      { cache: 'no-store', signal: controller.signal },
    )
      .then(async (response) => {
        if (response.status === 401) return null;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
        return result as WorkspaceData;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (homeDraft && (!result || result.ownerId !== homeDraft.ownerId)) setDraft('');
        setPreview(result === null);
        if (result === null) setSelected(null);
        setData(result ?? disconnectedWorkspace);
        setCouncilSelection(councilFromVersion(result?.turns.at(-1)?.prompt_version ?? ''));
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Your workspace could not be loaded.');
          setLoading(false);
        }
      });
    return () => {
      reading.current?.abort();
      generation.current?.abort();
    };
  }, [initialConversation, homeDraft]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = data?.turns.length ? scroll.current.scrollHeight : 0;
  }, [data?.turns]);
  async function sendMessage(
    messageText: string,
    replace?: { sourceTurnId: string; revisionKind: 'retry' | 'regenerate' | 'edit' } | null,
    requestedCouncil: CouncilSelection | null = councilSelection,
  ) {
    if (
      generation.current ||
      preview ||
      !data?.configured ||
      !data.canChat ||
      !messageText.trim() ||
      needsReload ||
      data.currentConversation?.archived_at
    )
      return;
    const id = selected ?? crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const text = messageText.trim();
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    setError('');
    setNotice(
      requestedCouncil?.kind === 'table'
        ? 'The Council is examining your question…'
        : `${councilLabel(requestedCouncil)} is thinking…`,
    );
    follow.current = true;
    let saved = false;
    const painted = frameText((reply) => {
      setNotice('Aethelios is responding…');
      setData((previous) =>
        previous
          ? {
              ...previous,
              turns: previous.turns.map((turn) =>
                turn.id === requestId && turn.status === 'pending'
                  ? { ...turn, assistant_text: reply }
                  : turn,
              ),
            }
          : previous,
      );
    });
    try {
      const response = await fetch('/api/aurelius/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          requestId,
          text,
          includeContext,
          ...replace,
          ...(requestedCouncil ? { council: requestedCouncil } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'The message could not be sent.');
      }
      const pending: Turn = {
        id: requestId,
        person_id: '',
        conversation_id: id,
        user_text: text,
        assistant_text: '',
        status: 'pending',
        model: data.model,
        context_included: includeContext,
        prompt_version: requestedCouncil ? councilPromptVersion(requestedCouncil) : '',
        feedback: null,
        created_at: new Date().toISOString(),
        finished_at: null,
        parent_turn_id: replace?.sourceTurnId ?? null,
        revision_kind: replace?.revisionKind ?? null,
      };
      setSelected(id);
      rememberConversation(id);
      setData((previous) =>
        previous ? { ...previous, turns: [...previous.turns, pending] } : previous,
      );
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reply stream was received.');
      const decoder = new TextDecoder();
      let buffer = '';
      const consume = (line: string) => {
        if (!line.trim()) return;
        const item = JSON.parse(line) as StreamEvent;
        if (item.type === 'delta') {
          painted.append(item.text);
        } else if (item.type === 'saved') {
          painted.finish();
          saved = true;
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  turns: previous.turns.map((turn) => (turn.id === requestId ? item.turn : turn)),
                }
              : previous,
          );
        } else if (item.type === 'error') throw new Error(item.message);
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) consume(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (!saved) throw new Error('The connection ended before the save was confirmed.');
      setDraft('');
      setRevision(null);
      setNotice('Reply saved.');
      await reload(id);
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'Reply stopped. Reload to check what was saved.'
          : e instanceof Error
            ? e.message
            : 'The reply could not be confirmed.',
      );
      setNeedsReload(true);
      setNotice('');
    } finally {
      painted.finish(!saved);
      generation.current = null;
      setBusy(false);
    }
  }
  async function feedback(id: string, value: 'helpful' | 'needs_work') {
    try {
      await jsonRequest('/api/aurelius/feedback', 'POST', { id, feedback: value });
      setData((previous) =>
        previous
          ? {
              ...previous,
              turns: previous.turns.map((t) => (t.id === id ? { ...t, feedback: value } : t)),
            }
          : previous,
      );
      setNotice('Feedback saved for review. This does not retrain the model automatically.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feedback could not be saved.');
    }
  }
  async function deleteConversation() {
    if (!selected) return;
    setDeleting(true);
    try {
      await jsonRequest('/api/aurelius', 'DELETE', { id: selected });
      await reload();
      setDraft('');
      setNotice(
        'Conversation deleted. Confirmed memories and daily actions remain in their own records.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion could not be confirmed.');
    } finally {
      setDeleting(false);
    }
  }
  function newConversation() {
    setSelected(null);
    setCouncilSelection(null);
    rememberConversation(null);
    setAwayFromLatest(false);
    setData((previous) =>
      previous ? { ...previous, turns: [], currentConversation: null } : previous,
    );
    setDraft('');
    setNeedsReload(false);
    setConfirmDelete(false);
    setError('');
    setNotice('');
    setTab('conversation');
    setRevision(null);
    follow.current = true;
    composer.current?.focus();
  }
  const blocked = busy || loading || deleting || orchestrating;
  const capability = routeCapability(draft.trim() || data?.turns.at(-1)?.user_text || '');

  async function prepareCapability() {
    if (
      !capability ||
      !data?.ownerId ||
      !['performance', 'studio', 'presence'].includes(capability.id) ||
      orchestrating
    )
      return;
    const text = draft.trim() || data.turns.at(-1)?.user_text || '';
    if (!text) return;
    setOrchestrating(true);
    setError('');
    setNotice(`Preparing ${capability.label}…`);
    try {
      const response = await fetch('/api/aurelius/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: capability.id, text }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? `${capability.label} could not be prepared.`);
      if (result.ownerId !== data.ownerId)
        throw new Error('Account changed. Reopen Aethelios before continuing.');
      handoff?.stage({ text, ownerId: data.ownerId, target: capability.id, payload: result });
      router.push(capability.href);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : `${capability.label} could not be prepared.`,
      );
      setNotice('');
    } finally {
      setOrchestrating(false);
    }
  }
  if (!data)
    return (
      <div className="aurelius-unavailable">
        <span className="orb large" aria-hidden="true" />
        <h3>A clearer perspective.</h3>
        <p role={error ? 'alert' : 'status'}>{error || 'Opening your personal workspace…'}</p>
        {!loading && (
          <>
            <Link href="/app/you" className="button">
              Your account
            </Link>
            <button className="text-button" onClick={() => void reload().catch(() => {})}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className={`aurelius-layout talk-layout ${compact ? 'compact-layout' : ''}`}>
      <div className={`aurelius-workspace ${compact ? 'compact' : ''}`}>
        <div className="talk-toolbar">
          <TalkPresence
            state={
              busy
                ? 'working'
                : needsReload
                  ? 'stopped'
                  : preview || !data.configured
                    ? 'disconnected'
                    : 'ready'
            }
          />
          {!compact && (
            <TalkDrawer label="Conversations">
              {(close) => (
                <>
                  <ConversationLibrary
                    conversations={data.conversations}
                    selected={selected}
                    disabled={blocked}
                    preview={preview}
                    onSelect={(id) => {
                      setTab('conversation');
                      if (
                        draft.trim() &&
                        !confirm('Discard the unsent draft and switch conversations?')
                      )
                        return;
                      close();
                      setDraft('');
                      follow.current = true;
                      void reload(id).catch(() => {});
                    }}
                    onNew={() => {
                      if (
                        draft.trim() &&
                        !confirm('Discard the unsent draft and start a new conversation?')
                      )
                        return;
                      newConversation();
                      close();
                    }}
                    onRename={(id, title) => updateConversation(id, title, null)}
                    onArchive={(id, archived) => updateConversation(id, null, archived)}
                    nextCursor={data.nextConversationCursor}
                    onMore={loadMoreConversations}
                  />
                </>
              )}
            </TalkDrawer>
          )}
          <span className="talk-title">
            {selected ? data.currentConversation?.title || 'Conversation' : 'New conversation'}
          </span>
          <button
            type="button"
            className="talk-tool"
            disabled={blocked}
            onClick={() => {
              if (
                !draft.trim() ||
                confirm('Discard the unsent draft and start a new conversation?')
              )
                newConversation();
            }}
          >
            New
          </button>
          <TalkDrawer label="Tools & context">
            <AppearanceControls />
            <div className="aurelius-tabs" role="group" aria-label="Aethelios workspace">
              <button aria-pressed={tab === 'conversation'} onClick={() => setTab('conversation')}>
                Conversation
              </button>
              <button aria-pressed={tab === 'memory'} onClick={() => setTab('memory')}>
                Memory
              </button>
              <button aria-pressed={tab === 'context'} onClick={() => setTab('context')}>
                Context
              </button>
            </div>
            {tab === 'memory' ? (
              <MemoryEditor
                memories={data.memories}
                onChanged={() => reload(selected)}
                disabled={blocked || preview}
                preview={preview}
              />
            ) : tab === 'context' ? (
              <ContextPanel data={data} preview={preview} included={includeContext} />
            ) : (
              <>
                <div
                  className={`conversation-controls ${compact ? '' : 'full-conversation-controls'}`}
                >
                  {compact ? (
                    <>
                      <label className="sr-only" htmlFor="conversation-choice">
                        Saved conversations
                      </label>
                      <select
                        id="conversation-choice"
                        value={selected ?? ''}
                        disabled={blocked}
                        onChange={(e) => {
                          follow.current = true;
                          void reload(e.target.value || null).catch(() => {});
                        }}
                      >
                        <option value="">New conversation</option>
                        {selected && !data.conversations.some((c) => c.id === selected) && (
                          <option value={selected}>Current conversation</option>
                        )}
                        {data.conversations.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <button
                        className="secondary-button"
                        disabled={blocked}
                        onClick={newConversation}
                      >
                        New
                      </button>
                    </>
                  ) : (
                    <span className="conversation-title">
                      {selected
                        ? data.currentConversation?.title ||
                          data.conversations.find((c) => c.id === selected)?.title ||
                          'Current conversation'
                        : 'A space to think clearly.'}
                    </span>
                  )}
                  {selected && (
                    <button
                      className="text-button"
                      disabled={blocked}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete conversation
                    </button>
                  )}
                </div>
                {confirmDelete && (
                  <div className="confirm-row">
                    <p>
                      Delete this conversation and its messages? Confirmed memories and daily
                      actions remain separate.
                    </p>
                    <button
                      className="secondary-button"
                      disabled={blocked}
                      onClick={() => void deleteConversation()}
                    >
                      Confirm delete
                    </button>
                    <button className="text-button" onClick={() => setConfirmDelete(false)}>
                      Keep conversation
                    </button>
                  </div>
                )}
                {!preview && (
                  <TodayActions
                    brief={data.context.dailyBrief}
                    disabled={blocked}
                    onChanged={() => reload(selected)}
                  />
                )}
              </>
            )}
            {!preview && (
              <div className="council-access">
                <button
                  type="button"
                  className="text-button"
                  disabled={blocked || needsReload || !data.canChat || !data.configured}
                  onClick={() => tableReview.current?.open(false)}
                >
                  The Council
                </button>
                {councilSelection ? (
                  <>
                    <span>{councilLabel(councilSelection)}</span>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setCouncilSelection(null)}
                    >
                      {councilSelection.kind === 'table'
                        ? 'Leave The Table'
                        : 'Return to Aethelios'}
                    </button>
                  </>
                ) : (
                  <span>
                    Relevant Council ·{' '}
                    {relevantCouncil(draft.trim() || data.turns.at(-1)?.user_text || '')
                      .map((route) => specialist(route.id).name)
                      .join(' · ')}
                  </span>
                )}
                <button
                  type="button"
                  className="text-button"
                  disabled={
                    blocked ||
                    needsReload ||
                    !data.canChat ||
                    !data.configured ||
                    !(draft.trim() || data.turns.at(-1)?.user_text)
                  }
                  onClick={() => tableReview.current?.open(true)}
                >
                  {councilSelection?.kind === 'table' ? 'Review The Table' : 'Assemble Around This'}
                </button>
              </div>
            )}
            <label className="context-toggle">
              <input
                type="checkbox"
                checked={includeContext}
                disabled={blocked}
                onChange={(e) => setIncludeContext(e.target.checked)}
              />
              Use personal context
            </label>
            <details className="composer-privacy">
              <summary>What Aethelios receives</summary>
              <p className="composer-disclosure">
                {preview ? (
                  'Explore the workspace. Drafts stay in this open view; sending and saving require sign-in and a model connection.'
                ) : (
                  <>
                    Sending shares this conversation’s recent messages
                    {councilSelection ? ' with the selected Council specialists' : ''}
                    {includeContext
                      ? `, profile, active goal, confirmed memories, daily records and relevant training summaries and Presence records${founderLinked && !councilSelection ? ', plus relevant private Aethelios teaching and researched knowledge' : ''}`
                      : ''}{' '}
                    with our AI service. Read-only web research may consult public sources; returned
                    sources are linked in saved replies. Nothing is automatically added to memory.
                  </>
                )}
              </p>
            </details>
          </TalkDrawer>
        </div>
        {!preview && (
          <CouncilPanel
            hideAccess
            reviewRef={tableReview}
            question={draft.trim() || data.turns.at(-1)?.user_text || ''}
            selection={councilSelection}
            disabled={
              blocked ||
              needsReload ||
              !data.canChat ||
              !data.configured ||
              Boolean(data.currentConversation?.archived_at)
            }
            includeContext={includeContext}
            onSelect={setCouncilSelection}
            onFocused={(id) => {
              newConversation();
              setCouncilSelection({ kind: 'specialist', specialists: [id] });
            }}
            onAssemble={(question, selection) => {
              setCouncilSelection(selection);
              void sendMessage(question, revision, selection);
            }}
          />
        )}
        {preview && (
          <div className="workspace-preview-note">
            <p>Sign in to use your Aethelios workspace.</p>
            <Link href="/app/you">Your account →</Link>
          </div>
        )}
        {error && (
          <div role="alert" className="form-feedback error">
            <p>{error}</p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void reload(selected).catch(() => {})}
            >
              Reload saved state
            </button>
          </div>
        )}
        <>
          <div
            className="conversation-scroll"
            ref={scroll}
            onScroll={() => {
              const el = scroll.current;
              if (el) {
                follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                setAwayFromLatest(!follow.current);
              }
            }}
            aria-label="Conversation messages"
            aria-busy={busy}
          >
            {data.hasOlderTurns && (
              <button
                type="button"
                className="secondary-button older-messages"
                disabled={loadingOlder}
                onClick={() => void loadOlder()}
              >
                {loadingOlder ? 'Loading…' : 'Load older messages'}
              </button>
            )}
            {!data.turns.length ? (
              <div className="aurelius-welcome">
                <div className="welcome-heading">
                  {compact ? (
                    <AureliusPresence
                      state={
                        busy ? 'working' : preview || !data.configured ? 'disconnected' : 'ready'
                      }
                    />
                  ) : (
                    <OrbPresentation
                      state={
                        busy
                          ? 'working'
                          : needsReload
                            ? 'stopped'
                            : preview || !data.configured
                              ? 'disconnected'
                              : 'ready'
                      }
                    />
                  )}

                  <div>
                    <p className="eyebrow">Aethelios · Digital Co-Founder</p>
                    <h2>What’s on your mind?</h2>
                    <Link
                      className="text-link aethelios-meet-link"
                      href="/app/aethelios/meet"
                      onClick={(event) => {
                        if (compact) event.currentTarget.closest('dialog')?.close();
                      }}
                    >
                      Meet Aethelios →
                    </Link>
                  </div>
                </div>
                <p>
                  Bring the ambition, the uncertainty,
                  <br />
                  or the decision you’re sitting with.
                </p>
                <div className="conversation-starters">
                  {[
                    'Help me understand my company and choose the highest-value next move.',
                    'Help me sharpen my company positioning.',
                    'Help me scope a client project.',
                  ].map((text) => (
                    <button
                      key={text}
                      onClick={() => {
                        setDraft(text);
                        composer.current?.focus();
                      }}
                      disabled={blocked}
                    >
                      {text}
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              data.turns
                .filter((turn) => !data.turns.some((newer) => newer.parent_turn_id === turn.id))
                .map((turn) => (
                  <ConversationTurn
                    key={turn.id}
                    turn={turn}
                    onFeedback={(id, value) => void feedback(id, value)}
                    disabled={blocked}
                    versions={priorVersions(turn, data.turns)}
                    onCopy={() => void navigator.clipboard.writeText(turn.assistant_text)}
                    onRevise={
                      turn.id === data.turns.at(-1)?.id && !data.currentConversation?.archived_at
                        ? (kind) => {
                            if (kind === 'edit') {
                              setDraft(turn.user_text);
                              setRevision({ sourceTurnId: turn.id, revisionKind: 'edit' });
                              composer.current?.focus();
                            } else
                              void sendMessage(
                                turn.user_text,
                                { sourceTurnId: turn.id, revisionKind: kind },
                                councilFromVersion(turn.prompt_version),
                              );
                          }
                        : undefined
                    }
                    action={
                      turn.id ===
                        data.turns.filter((item) => item.status === 'complete').at(-1)?.id &&
                      data.canChat
                        ? {
                            proposal: data.actionProposals?.find(
                              (item) => item.source_turn_id === turn.id,
                            ),
                            onChanged: () => reload(selected),
                          }
                        : undefined
                    }
                  />
                ))
            )}
          </div>
          {!preview && (!data.configured || !data.canChat) && (
            <p className="connection-note">
              {!data.configured
                ? 'Aethelios is waiting for its model connection. Saved conversations and memory remain available.'
                : 'Conversation access is not enabled for this account. If you were invited, confirm your access in the founding member guide.'}
            </p>
          )}
          {awayFromLatest && (
            <button
              className="latest-message"
              onClick={() => {
                follow.current = true;
                setAwayFromLatest(false);
                scroll.current?.scrollTo({
                  top: scroll.current.scrollHeight,
                  behavior: 'instant',
                });
              }}
            >
              Latest message ↓
            </button>
          )}
          <form
            className="aurelius-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (councilSelection?.kind === 'table') {
                tableReview.current?.open();
                return;
              }
              void sendMessage(draft, revision);
            }}
          >
            {capability && !councilSelection && (
              <div className="revision-notice" aria-live="polite">
                <span>
                  Aethelios is routing this through <strong>{capability.label}</strong>{' '}
                  intelligence.
                </span>{' '}
                {['performance', 'studio', 'presence'].includes(capability.id) ? (
                  <button
                    type="button"
                    className="text-button"
                    disabled={orchestrating}
                    onClick={() => void prepareCapability()}
                  >
                    {orchestrating
                      ? `Preparing ${capability.label}…`
                      : `Prepare in ${capability.label} ↗`}
                  </button>
                ) : (
                  <Link
                    href={capability.href}
                    onClick={() => {
                      if (data.ownerId)
                        handoff?.stage({
                          text: draft.trim() || data.turns.at(-1)?.user_text || '',
                          ownerId: data.ownerId,
                          target: capability.id,
                        });
                    }}
                  >
                    Open {capability.label} only if you want depth ↗
                  </Link>
                )}
              </div>
            )}
            {revision && (
              <div className="revision-notice">
                Editing your last message{' '}
                <button
                  type="button"
                  onClick={() => {
                    setRevision(null);
                    setDraft('');
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <TalkInput
              id="aurelius-message"
              label="Message Aethelios"
              inputRef={composer}
              value={draft}
              onChange={setDraft}
              disabled={blocked}
              placeholder={
                councilSelection?.kind === 'specialist'
                  ? `Message ${councilLabel(councilSelection)}…`
                  : 'Message Aethelios…'
              }
            />
            <div className="composer-controls">
              <span className="quiet-label">
                {includeContext ? 'Personal context on' : 'Private conversation'}
              </span>
              {busy ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => generation.current?.abort()}
                >
                  Stop reply
                </button>
              ) : (
                <button
                  className="button"
                  disabled={
                    blocked ||
                    !data.configured ||
                    !data.canChat ||
                    !draft.trim() ||
                    needsReload ||
                    Boolean(data.currentConversation?.archived_at)
                  }
                  type="submit"
                >
                  {councilSelection?.kind === 'table' ? 'Review The Table' : 'Send'}{' '}
                  <span aria-hidden="true">↑</span>
                </button>
              )}
            </div>
          </form>
        </>
        <p className="aurelius-notice" role="status">
          {notice}
        </p>
      </div>
    </div>
  );
}

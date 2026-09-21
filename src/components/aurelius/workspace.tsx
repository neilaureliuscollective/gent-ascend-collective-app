'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { StreamEvent, Turn, WorkspaceData } from '@/domains/intelligence/types';
import { MemoryEditor, jsonRequest } from './memory-editor';
import { ConversationTurn } from './message';
import { ConversationLibrary } from './conversation-library';
import { ContextPanel } from './context-panel';
import { disconnectedWorkspace } from './preview';
import { AureliusPresence } from '../visual/aurelius-presence';
export function AureliusWorkspace({ compact = false }: { compact?: boolean }) {
  const [preview, setPreview] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const [tab, setTab] = useState<'conversation' | 'memory' | 'context'>('conversation');
  const [includeContext, setIncludeContext] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const generation = useRef<AbortController | null>(null);
  const reading = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const load = useCallback(async (id: string | null = null) => {
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
        setData(disconnectedWorkspace);
        setSelected(null);
        setDraft('');
        setNeedsReload(false);
        return;
      }
      if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
      setPreview(false);
      setData(result as WorkspaceData);
      setSelected(id);
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
  }, []);
  function reload(id: string | null = null) {
    setLoading(true);
    setError('');
    return load(id);
  }
  useEffect(() => {
    const controller = new AbortController();
    reading.current = controller;
    void fetch('/api/aurelius', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return null;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
        return result as WorkspaceData;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPreview(result === null);
        setData(result ?? disconnectedWorkspace);
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
  }, []);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = data?.turns.length ? scroll.current.scrollHeight : 0;
  }, [data?.turns]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (
      generation.current ||
      preview ||
      !data?.configured ||
      !data.canChat ||
      !draft.trim() ||
      needsReload
    )
      return;
    const id = selected ?? crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const text = draft.trim();
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    setError('');
    setNotice('Aurelius is thinking…');
    follow.current = true;
    let saved = false;
    try {
      const response = await fetch('/api/aurelius/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id, requestId, text, includeContext }),
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
        prompt_version: '',
        feedback: null,
        created_at: new Date().toISOString(),
        finished_at: null,
      };
      setSelected(id);
      setData((previous) =>
        previous ? { ...previous, turns: [...previous.turns, pending] } : previous,
      );
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reply stream was received.');
      const decoder = new TextDecoder();
      let buffer = '';
      let reply = '';
      const consume = (line: string) => {
        if (!line.trim()) return;
        const item = JSON.parse(line) as StreamEvent;
        if (item.type === 'delta') {
          reply += item.text;
          setNotice('Aurelius is responding…');
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  turns: previous.turns.map((turn) =>
                    turn.id === requestId ? { ...turn, assistant_text: reply } : turn,
                  ),
                }
              : previous,
          );
        } else if (item.type === 'saved') {
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
      setNotice('Conversation deleted. Separately confirmed memories remain under Memory.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion could not be confirmed.');
    } finally {
      setDeleting(false);
    }
  }
  function newConversation() {
    setSelected(null);
    setData((previous) => (previous ? { ...previous, turns: [] } : previous));
    setDraft('');
    setNeedsReload(false);
    setConfirmDelete(false);
    setError('');
    setNotice('');
    setTab('conversation');
    follow.current = true;
    composer.current?.focus();
  }
  const blocked = busy || loading || deleting;
  if (!data)
    return (
      <div className="aurelius-unavailable">
        <span className="orb large" aria-hidden="true" />
        <h3>A clearer perspective.</h3>
        <p role={error ? 'alert' : 'status'}>{error || 'Opening your personal workspace…'}</p>
        {!loading && (
          <>
            <Link href="/you" className="button">
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
    <div className={`aurelius-layout ${compact ? 'compact-layout' : ''}`}>
      {!compact && (
        <ConversationLibrary
          conversations={data.conversations}
          selected={selected}
          disabled={blocked}
          preview={preview}
          onSelect={(id) => {
            setTab('conversation');
            follow.current = true;
            void reload(id).catch(() => {});
          }}
          onNew={newConversation}
        />
      )}
      <div className={`aurelius-workspace ${compact ? 'compact' : ''}`}>
        <div className="aurelius-toolbar">
          <div className="aurelius-tabs" role="group" aria-label="Aurelius workspace">
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
          <div className="quiet-label">
            <AureliusPresence
              state={
                busy
                  ? 'working'
                  : needsReload
                    ? 'stopped'
                    : notice === 'Reply saved.'
                      ? 'saved'
                      : preview || !data.configured
                        ? 'disconnected'
                        : 'ready'
              }
            />
            {preview
              ? 'Workspace preview'
              : data.configured
                ? 'Model configured'
                : 'Connection pending'}
          </div>
        </div>
        {preview && (
          <div className="workspace-preview-note">
            <p>Sign in to use your Aurelius workspace.</p>
            <Link href="/you">Your account →</Link>
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
            <div className={`conversation-controls ${compact ? '' : 'full-conversation-controls'}`}>
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
                  <button className="secondary-button" disabled={blocked} onClick={newConversation}>
                    New
                  </button>
                </>
              ) : (
                <span className="conversation-title">
                  {selected
                    ? data.conversations.find((c) => c.id === selected)?.title ||
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
                  Delete this conversation and all its messages? Confirmed memories remain separate.
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
            <div
              className="conversation-scroll"
              ref={scroll}
              onScroll={() => {
                const el = scroll.current;
                if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
              }}
              aria-label="Conversation messages"
              aria-busy={busy}
            >
              {!data.turns.length ? (
                <div className="aurelius-welcome">
                  <div className="welcome-heading">
                    <AureliusPresence
                      enhanced={!compact}
                      state={preview || !data.configured ? 'disconnected' : 'ready'}
                    />
                    <div>
                      <p className="eyebrow">Clarity. Judgment. Direction.</p>
                      <h2>What’s on your mind?</h2>
                    </div>
                  </div>
                  <p>
                    Bring the ambition, the uncertainty,
                    <br />
                    or the decision you’re sitting with.
                  </p>
                  <div className="conversation-starters">
                    {[
                      'Help me decide what matters most today.',
                      'Challenge an assumption in my current goal.',
                      'Help me think through a decision.',
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
                data.turns.map((turn) => (
                  <ConversationTurn
                    key={turn.id}
                    turn={turn}
                    onFeedback={(id, value) => void feedback(id, value)}
                    disabled={blocked}
                  />
                ))
              )}
            </div>
            {!preview && (!data.configured || !data.canChat) && (
              <p className="connection-note">
                {!data.configured
                  ? 'Aurelius is waiting for its model connection. Saved conversations and memory remain available.'
                  : 'Conversation access is not enabled for this account. Local founders can restore the Founder scenario in the developer console.'}
              </p>
            )}
            <form className="aurelius-composer" onSubmit={send}>
              <label htmlFor="aurelius-message" className="sr-only">
                Message Aurelius
              </label>
              <textarea
                id="aurelius-message"
                ref={composer}
                rows={2}
                maxLength={6000}
                value={draft}
                disabled={blocked}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Think it through with Aurelius…"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="composer-controls">
                <label className="context-toggle">
                  <input
                    type="checkbox"
                    checked={includeContext}
                    disabled={blocked}
                    onChange={(e) => setIncludeContext(e.target.checked)}
                  />
                  Use personal context
                </label>
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
                      blocked || !data.configured || !data.canChat || !draft.trim() || needsReload
                    }
                    type="submit"
                  >
                    Send <span aria-hidden="true">↑</span>
                  </button>
                )}
              </div>
              <p className="composer-disclosure">
                {preview ? (
                  'Explore the workspace. Drafts stay in this open view; sending and saving require sign-in and a model connection.'
                ) : (
                  <>
                    Sending shares this conversation’s recent messages
                    {includeContext ? ', profile, active goal and confirmed memories' : ''} with our
                    AI service. Nothing is automatically added to memory.
                  </>
                )}
              </p>
            </form>
          </>
        )}
        <p className="aurelius-notice" role="status">
          {notice}
        </p>
      </div>
    </div>
  );
}

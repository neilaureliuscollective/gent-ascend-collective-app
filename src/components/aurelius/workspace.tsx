'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { StreamEvent, Turn, WorkspaceData } from '@/domains/intelligence/types';
import { MemoryEditor, jsonRequest } from './memory-editor';
import { ConversationTurn } from './message';
export function AureliusWorkspace({ compact = false }: { compact?: boolean }) {
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
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/aurelius' + (id ? `?conversationId=${id}` : ''), {
        cache: 'no-store',
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
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
  useEffect(() => {
    const controller = new AbortController();
    reading.current = controller;
    void fetch('/api/aurelius', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
        return result as WorkspaceData;
      })
      .then((result) => {
        setData(result);
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
  }, [load]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = data?.turns.length ? scroll.current.scrollHeight : 0;
  }, [data?.turns]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (generation.current || !data || !draft.trim() || needsReload) return;
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
      await load(id);
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
      await load();
      setDraft('');
      setNotice('Conversation deleted. Separately confirmed memories remain under Memory.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion could not be confirmed.');
    } finally {
      setDeleting(false);
    }
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
            <button className="text-button" onClick={() => void load().catch(() => {})}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  return (
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
        <span className="quiet-label">
          {data.configured ? 'Text intelligence' : 'Connection pending'}
        </span>
      </div>
      {error && (
        <div role="alert" className="form-feedback error">
          <p>{error}</p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void load(selected).catch(() => {})}
          >
            Reload saved state
          </button>
        </div>
      )}
      {tab === 'memory' ? (
        <MemoryEditor
          memories={data.memories}
          onChanged={() => load(selected)}
          disabled={blocked}
        />
      ) : tab === 'context' ? (
        <section className="context-space">
          <p className="eyebrow">Visible context</p>
          <h3>What Aurelius can draw on.</h3>
          <p>
            Your profile, active goal and explicitly confirmed memories are refreshed for each
            message when personal context is enabled.
          </p>
          <dl>
            <dt>Name</dt>
            <dd>{data.context.profile.name}</dd>
            <dt>Current priority</dt>
            <dd>{data.context.profile.priority || 'Not set'}</dd>
            <dt>Active goal</dt>
            <dd>{data.context.goal?.title || 'Not set'}</dd>
            <dt>Next step</dt>
            <dd>{data.context.goal?.nextStep || 'Not set'}</dd>
            <dt>Confirmed memories</dt>
            <dd>{data.memories.length}</dd>
          </dl>
          <p className="privacy-note">
            He receives up to 20 recent completed exchanges within a bounded context window. Older
            conversations are saved, but are not automatically recalled. Turning personal context
            off does not remove details already written in this conversation. Start a new
            conversation for a fresh context.
          </p>
          <p>
            Live web research, voice, file uploads and external actions are not connected in this
            release.
          </p>
          <p className="muted">
            Model: {data.model}. A model response is a suggestion, not a verified fact.
          </p>
        </section>
      ) : (
        <>
          <div className="conversation-controls">
            <label className="sr-only" htmlFor="conversation-choice">
              Saved conversations
            </label>
            <select
              id="conversation-choice"
              value={selected ?? ''}
              disabled={blocked}
              onChange={(e) => void load(e.target.value || null).catch(() => {})}
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
              onClick={() => {
                setSelected(null);
                setData((previous) => (previous ? { ...previous, turns: [] } : previous));
                setDraft('');
                setNeedsReload(false);
                setError('');
                setNotice('');
              }}
            >
              New
            </button>
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
                <span className="orb large" aria-hidden="true" />
                <p className="eyebrow">Clarity. Judgment. Direction.</p>
                <h2>What’s on your mind?</h2>
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
                    <button key={text} onClick={() => setDraft(text)} disabled={blocked}>
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
          {(!data.configured || !data.canChat) && (
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
              rows={3}
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
              Sending shares this conversation’s recent messages
              {includeContext ? ', profile, active goal and confirmed memories' : ''} with our AI
              service. Nothing is automatically added to memory.
            </p>
          </form>
        </>
      )}
      <p className="aurelius-notice" role="status">
        {notice}
      </p>
    </div>
  );
}

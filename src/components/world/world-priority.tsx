'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { dayLabel } from '@/domains/daily/model';
import { prioritySnapshot, type PrioritySnapshot } from '@/domains/daily/world-priority-model';
import { GuestDirection } from './guest-direction';

export function useWorldPriority(open: boolean) {
  const [data, setData] = useState<PrioritySnapshot | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const lock = useRef(false);
  const opened = useRef(open);
  const dirty = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    opened.current = open;
    dirty.current = data?.mode === 'personal' && draft !== data.intention;
  }, [open, data, draft]);

  const reload = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch('/api/world/priority', {
        cache: 'no-store',
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
      });
      if (!response.ok) throw new Error('Your priority could not be loaded. Try again.');
      const result = prioritySnapshot.parse(await response.json());
      if (abort.signal.aborted) return;
      setData(result);
      setDraft(result.mode === 'personal' ? result.intention : '');
      setNeedsReload(false);
      setProblem('');
      setNotice('');
    } catch {
      if (!abort.signal.aborted) {
        setProblem('Your saved priority is unavailable. Your world is still ready to explore.');
        setNeedsReload(true);
      }
    } finally {
      if (!abort.signal.aborted) {
        lock.current = false;
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    // Let the complete navigable scene paint before asking for private context.
    const timer = window.setTimeout(() => void reload(), 0);
    const refresh = () => {
      if (!document.hidden && !opened.current && !dirty.current) void reload();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    const claimed = () => void reload();
    window.addEventListener('gent-priority-reload', claimed);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
      lock.current = false;
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('gent-priority-reload', claimed);
    };
  }, [reload]);

  async function save() {
    if (lock.current || needsReload || data?.mode !== 'personal' || !draft.trim()) return;
    lock.current = true;
    setBusy(true);
    setSaving(true);
    setProblem('');
    setNotice('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch('/api/world/priority', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: data.ownerId,
          day: data.day,
          version: data.version,
          intention: draft.trim(),
        }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
      });
      const result = await response.json();
      if (abort.signal.aborted) return;
      if (!response.ok)
        throw new Error(
          typeof result.error === 'string' ? result.error : 'The save could not be confirmed.',
        );
      const saved = prioritySnapshot.parse(result);
      if (saved.mode !== 'personal') throw new Error('Sign in again to save your priority.');
      setData(saved);
      setDraft(saved.intention);
      setNotice('Saved to your day.');
    } catch (error) {
      if (!abort.signal.aborted) {
        setProblem(
          error instanceof Error && error.name === 'Error'
            ? error.message
            : 'The save could not be confirmed. Your draft is still here.',
        );
        setNeedsReload(true);
      }
    } finally {
      if (!abort.signal.aborted) {
        lock.current = false;
        setBusy(false);
        setSaving(false);
      }
    }
  }
  function changeDraft(value: string) {
    setDraft(value);
    setNotice('');
  }
  return {
    data,
    draft,
    setDraft: changeDraft,
    busy,
    saving,
    problem,
    notice,
    needsReload,
    reload,
    save,
  };
}
type Controller = ReturnType<typeof useWorldPriority>;

export function WorldPrioritySummary({
  priority,
  onOpen,
}: {
  priority: Controller;
  onOpen: () => void;
}) {
  const data = priority.data;
  if (data?.mode !== 'personal') return null;
  return (
    <section className="gw-saved-priority" aria-label="Your saved priority">
      <div className="gw-priority-label">
        <span className="gw-priority-mark" aria-hidden="true" />
        <p className="gw-kicker">{dayLabel(data.day, true)} / IN YOUR WORDS</p>
      </div>
      <button className="gw-priority-open" onClick={onOpen} aria-haspopup="dialog">
        <span>{data.intention || 'What matters today?'}</span>
        <span aria-hidden="true">↗</span>
      </button>
      <p className="gw-priority-source">
        {priority.problem
          ? 'Refresh needed'
          : data.intention
            ? 'Your saved daily priority'
            : 'Choose one thing to move forward.'}
      </p>
    </section>
  );
}

export function WorldPriorityEditor({ priority }: { priority: Controller }) {
  const { data, draft, setDraft, busy, problem, notice, needsReload, reload, save } = priority;
  if (data?.mode === 'guest') return <GuestDirection />;
  return (
    <div className="gw-priority-editor">
      {data?.mode === 'personal' ? (
        <>
          <p className="gw-kicker">{dayLabel(data.day)} / YOUR DAY</p>
          <h3>
            Make room for
            <br />
            <em>what matters.</em>
          </h3>
          <p>One priority to return to. In your words.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label htmlFor="world-priority">What matters most today?</label>
            <textarea
              id="world-priority"
              rows={3}
              maxLength={160}
              required
              value={draft}
              disabled={busy}
              onChange={(e) => {
                setDraft(e.target.value);
              }}
              placeholder="The one thing I want to move forward…"
              aria-describedby="world-priority-scope"
            />
            <p id="world-priority-scope" className="gw-muted">
              Saved in your daily space. Today in {data.timezone.replaceAll('_', ' ')}.
            </p>
            <button
              type="submit"
              className="gw-action"
              disabled={busy || needsReload || !draft.trim() || draft.trim() === data.intention}
            >
              {busy ? 'Saving…' : 'Save my priority →'}
            </button>
          </form>
          {data.updatedAt && (
            <p className="gw-priority-source">
              Daily record updated{' '}
              {new Intl.DateTimeFormat('en-US', {
                timeZone: data.timezone,
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(data.updatedAt))}{' '}
              · Your account
            </p>
          )}
          {data.nextAction && (
            <div className="gw-priority-next">
              <p className="gw-kicker">NEXT UNFINISHED ACTION</p>
              <p>{data.nextAction}</p>
            </div>
          )}
          <Link className="gw-priority-return" href="/app#daily-actions">
            Continue my day <span aria-hidden="true">↗</span>
          </Link>
        </>
      ) : !problem ? (
        <p role="status">Loading your direction…</p>
      ) : null}
      {problem && (
        <div role="alert" className="gw-priority-error">
          <p>{problem}</p>
          <button disabled={busy} onClick={() => void reload()}>
            {data?.mode === 'personal' ? 'Reload saved priority (discard draft)' : 'Try again'}
          </button>
          <Link href="/enter?next=/experience/world">Member sign in</Link>
        </div>
      )}
      <p role="status" className="gw-confirmation">
        {notice}
      </p>
    </div>
  );
}

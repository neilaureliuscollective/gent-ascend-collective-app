'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { jsonRequest } from '@/components/aurelius/memory-editor';
export function MissionCapture({
  conversationId,
  objective,
  disabled,
}: {
  conversationId: string | null;
  objective: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef<string | null>(null);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (!conversationId || busy || uncertain) return;
    setBusy(true);
    setError('');
    requestId.current ??= crypto.randomUUID();
    try {
      await jsonRequest('/api/missions', 'POST', {
        id: requestId.current,
        conversation_id: conversationId,
        title,
        objective: goal,
        status: 'draft',
        decisions: '',
        open_questions: '',
        next_actions: next,
      });
      dialog.current?.close();
      router.push('/app/missions');
      router.refresh();
    } catch (e) {
      setUncertain(true);
      setError(e instanceof Error ? e.message : 'Mission save was not confirmed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="text-button"
        disabled={disabled || !conversationId}
        onClick={() => {
          setGoal(objective.slice(0, 2000));
          setTitle(objective.slice(0, 120));
          setNext('');
          setError('');
          setUncertain(false);
          requestId.current = null;
          dialog.current?.showModal();
        }}
      >
        Save as Mission
      </button>
      <Link href="/app/missions" className="text-link">
        Missions ↗
      </Link>
      <dialog
        ref={dialog}
        className="council-dialog mission-editor"
        aria-labelledby="mission-create-title"
      >
        <header>
          <h2 id="mission-create-title">Give this work direction.</h2>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </header>
        <p>
          Keep this conversation, its outputs and your next move together. Aethelios resumes here
          when you return.
        </p>
        <label>
          Mission name
          <input
            maxLength={120}
            value={title}
            disabled={busy || uncertain}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Objective
          <textarea
            maxLength={2000}
            rows={3}
            value={goal}
            disabled={busy || uncertain}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <label>
          Next action (optional)
          <textarea
            maxLength={2000}
            rows={2}
            value={next}
            disabled={busy || uncertain}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <p className="council-scope">
          Saved only to your account. This does not add memory, send a model request, or start
          external work.
        </p>
        {error && (
          <p role="alert">
            {error} <Link href="/app/missions">Check saved Missions before retrying ↗</Link>
          </p>
        )}
        <button
          type="button"
          className="button"
          disabled={busy || uncertain || !title.trim() || goal.trim().length < 3}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Create Mission'}
        </button>
      </dialog>
    </>
  );
}

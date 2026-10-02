'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ContextSheet } from '@/components/interaction/context-sheet';

export function UniversalCapture() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [proposal, setProposal] = useState<{ kind: string; reason: string } | null>(null);
  const save = async () => {
    if (!content.trim() || busy) return;
    const captureId = id ?? crypto.randomUUID();
    setId(captureId);
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: captureId, content: content.trim(), kind: 'thought' }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not confirm capture.');
      setSaved(true);
      setActionTitle(content.trim().slice(0, 100));
      setMessage('Saved to your private capture inbox.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Keep your draft and retry.');
    } finally {
      setBusy(false);
    }
  };
  const makeAction = async () => {
    if (!id || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/capture/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId: id,
          action: 'create_today_action',
          title: actionTitle.trim(),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Action was not confirmed.');
      setMessage('Added to today’s actions.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action was not confirmed.');
    } finally {
      setBusy(false);
    }
  };
  const interpret = async () => {
    if (!id || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/capture/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captureId: id, requestId: crypto.randomUUID() }),
        signal: AbortSignal.timeout(16000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Interpretation unavailable.');
      setProposal({ kind: data.kind, reason: data.reason });
      if (data.actionTitle) setActionTitle(data.actionTitle);
      setMessage('Aethelios made a proposal. Review it before taking action.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Interpretation unavailable. Your capture is saved.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="universal-capture">
      <button
        type="button"
        className="capture-trigger"
        aria-label="Capture a thought"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">＋</span>
        <span className="capture-label">Capture</span>
      </button>
      <ContextSheet
        open={open}
        title="Capture a thought"
        busy={busy}
        onClose={() => setOpen(false)}
      >
        <h2>Get it out of your head.</h2>
        <p>Write it in your own words. Decide what it becomes after it is saved.</p>
        <textarea
          aria-label="Your thought"
          rows={3}
          maxLength={2000}
          placeholder="A thought, decision, open loop, or something you need to do…"
          value={content}
          disabled={saved}
          onChange={(event) => {
            setContent(event.target.value);
            setId(null);
          }}
        />
        <p role="status">{message}</p>
        {!saved ? (
          <button className="button" onClick={() => void save()} disabled={busy || !content.trim()}>
            {busy ? 'Saving…' : 'Save capture'}
          </button>
        ) : (
          <div>
            <button onClick={() => void interpret()} disabled={busy}>
              Ask Aethelios to interpret
            </button>
            {proposal && (
              <p className="capture-proposal">
                Suggested: {proposal.kind}. {proposal.reason}
              </p>
            )}
            <label htmlFor="capture-action-title">
              If this is an action, give it a clear next step
            </label>
            <input
              id="capture-action-title"
              maxLength={100}
              value={actionTitle}
              onChange={(event) => setActionTitle(event.target.value)}
            />
            <div className="capture-options">
              <button
                className="button"
                disabled={busy || !actionTitle.trim()}
                onClick={() => void makeAction()}
              >
                Add to today’s actions
              </button>
              <Link href={`/app/aethelios?starter=${encodeURIComponent('capture')}`}>
                Discuss with Aethelios
              </Link>
              <button
                onClick={() => {
                  setContent('');
                  setId(null);
                  setSaved(false);
                  setProposal(null);
                  setMessage('');
                }}
              >
                Capture another
              </button>
            </div>
          </div>
        )}
      </ContextSheet>
    </div>
  );
}

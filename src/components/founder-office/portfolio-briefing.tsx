'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import type { StreamEvent } from '@/domains/intelligence/types';
import { frameText } from '@/components/aurelius/frame-text';
type Receipt = { conversationId: string; requestId: string; missionId: string; text: string };
export function PortfolioBriefing({
  configured,
  onSaved,
}: {
  configured: boolean;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(
    'Show me everything that needs attention across my businesses.',
  );
  const [partial, setPartial] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [saved, setSaved] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function send(recover = false) {
    if (busy || !configured || (!recover && receipt)) return;
    const body = recover
      ? receipt
      : {
          conversationId: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          missionId: crypto.randomUUID(),
          text: draft.trim(),
        };
    if (!body || body.text.length < 3) return;
    setReceipt(body);
    setBusy(true);
    setSaved(false);
    setPartial('');
    setMessage('Reading your saved portfolio and preparing a briefing…');
    const controller = new AbortController();
    active.current = controller;
    const painted = frameText(setPartial);
    let acknowledged = false;
    try {
      const response = await fetch('/api/founder-office/briefing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Portfolio briefing unavailable.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Briefing stream unavailable.');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'delta') painted.append(event.text);
          else if (event.type === 'error') throw new Error(event.message);
          else if (event.type === 'saved') {
            painted.finish();
            setPartial(event.turn.assistant_text);
            acknowledged = true;
            setSaved(true);
          }
        }
        if (done) break;
      }
      if (!acknowledged)
        throw new Error(
          'Briefing save was not confirmed. Recover the exact request or inspect its conversation.',
        );
      setMessage('Briefing and portfolio mission saved. Resume them in Talk or from this office.');
      await onSaved();
    } catch (error) {
      setMessage(
        acknowledged
          ? 'Briefing saved; refresh the office to reload its mission.'
          : controller.signal.aborted
            ? 'Briefing stopped. Check the conversation receipt before another request.'
            : error instanceof Error
              ? error.message
              : 'Briefing unavailable.',
      );
    } finally {
      painted.finish(!acknowledged);
      setBusy(false);
      active.current = null;
    }
  }
  return (
    <section className="panel">
      <h2>Brief my portfolio.</h2>
      <p>
        Review your saved companies and recent missions together. Personal memory and wellness
        context stay outside this briefing. Missing connections remain unknown.
      </p>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="portfolio-request">Portfolio request</label>
        <textarea
          id="portfolio-request"
          rows={3}
          minLength={3}
          maxLength={3000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy || Boolean(receipt)}
        />
        <button className="button" disabled={busy || !configured || Boolean(receipt)}>
          Prepare saved portfolio briefing
        </button>
      </form>
      {busy && <button onClick={() => active.current?.abort()}>Stop briefing</button>}
      {partial && (
        <article className="founder-card">
          <Markdown>{partial}</Markdown>
        </article>
      )}
      {message && <p role="status">{message}</p>}
      {receipt && (
        <div className="io-work-links">
          <Link href={`/app/aethelios?conversation=${receipt.conversationId}`}>
            Inspect or resume saved portfolio conversation ↗
          </Link>
          {!saved && (
            <button disabled={busy || !configured} onClick={() => void send(true)}>
              Recover exact briefing request
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => {
              setReceipt(null);
              setSaved(false);
              setPartial('');
              setMessage('');
            }}
          >
            Start a new briefing
          </button>
        </div>
      )}
    </section>
  );
}

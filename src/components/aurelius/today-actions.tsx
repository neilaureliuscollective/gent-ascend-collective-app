'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { PersonalContext } from '@/domains/intelligence/types';
import { jsonRequest } from './memory-editor';

export function TodayActions({ brief, disabled, onChanged }: {
  brief: PersonalContext['dailyBrief']; disabled: boolean; onChanged: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (!brief) return null;
  async function complete(id: string) {
    if (!brief) return;
    setBusy(true); setNotice('');
    try {
      await jsonRequest('/api/daily/complete','POST',{day:brief.day,actionId:id,version:brief.version});
      setConfirm(null);
      await onChanged();
      setNotice('Action confirmed complete on Command.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Completion was not confirmed. Reload your day.');
    } finally { setBusy(false); }
  }
  const open = brief.actions.filter(action => !action.done);
  return <details className="aethelios-today" aria-label="Today's saved actions">
    <summary>Today’s plan · {open.length} open {open.length === 1 ? 'action' : 'actions'}</summary>
    <div className="aethelios-today-content">
      <p>Saved state for {brief.day}. Refresh the workspace after changes elsewhere. Aethelios receives this only when personal context is on.</p>
      {brief.intention && <p><strong>Your intention:</strong> {brief.intention}</p>}
      {brief.previousReview?.tomorrow && <p><strong>From {brief.previousReview.day}:</strong> {brief.previousReview.tomorrow}</p>}
      {open.length ? <ul>{open.map(action => <li key={action.id}>
        <span>{action.title}</span>
        {confirm === action.id ? <span className="aethelios-today-confirm">
          <button disabled={busy || disabled} onClick={() => void complete(action.id)}>Confirm complete</button>
          <button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
        </span> : <button disabled={busy || disabled} onClick={() => setConfirm(action.id)}>Mark complete</button>}
      </li>)}</ul> : <p>No open actions saved today. <Link href="/">Plan one on Command →</Link></p>}
      {brief.openCaptures > 0 && <p><Link href="/captures">{brief.openCaptures} thoughts waiting in Capture →</Link></p>}
      <Link href="/">Open Command and evening review →</Link>
      {notice && <p role="status">{notice}</p>}
    </div>
  </details>;
}

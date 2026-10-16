'use client';

import { useRef, useEffect, useState } from 'react';
import type { AppActivation } from '@/domains/architect-apps/activation';

export function AppActivationCheck({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<AppActivation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [projectId]);
  async function check() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const response = await fetch(
        `/api/architect-apps?project=${encodeURIComponent(projectId)}&view=activation`,
        { cache: 'no-store', signal: controller.signal },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          'Build readiness could not be checked. Sign in as the project owner and try again.',
        );
      if (!controller.signal.aborted) setReport(data as AppActivation);
    } catch {
      if (!controller.signal.aborted)
        setError(
          'Build readiness could not be checked. Sign in as the project owner and try again.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section aria-label="Application activation">
      <button type="button" disabled={busy} onClick={() => void check()}>
        {busy ? 'Checking build readiness…' : 'Check build readiness'}
      </button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <div role="status">
          <p>
            {report.ready
              ? 'Build prerequisites are ready for a generation request.'
              : 'Your plan is saved; application activation is incomplete.'}
          </p>
          <ul>
            {report.checks.map((check) => (
              <li key={check.name}>
                <strong>
                  {check.name}: {check.ready ? 'ready' : 'not ready'}
                </strong>
                {!check.ready && <> — {check.detail}</>}
              </li>
            ))}
          </ul>
          <p>{report.note}</p>
        </div>
      )}
    </section>
  );
}

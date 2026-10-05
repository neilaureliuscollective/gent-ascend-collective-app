'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProactiveSignal } from '@/domains/intelligence/proactive';

export function ProactiveSignalCard({ signal }: { signal: ProactiveSignal }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'opened' | 'dismissed' | null>(null);
  const [hidden, setHidden] = useState(false);

  async function mark(disposition: 'opened' | 'dismissed') {
    if (busy) return;
    setBusy(disposition);
    try {
      const response = await fetch('/api/aurelius/ahead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalKey: signal.key,
          disposition,
          expiresAt: signal.expiresAt,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Ahead status was not saved.');
      if (disposition === 'opened') router.push(signal.href);
      else setHidden(true);
    } catch {
      if (disposition === 'opened') router.push(signal.href);
    } finally {
      setBusy(null);
    }
  }

  if (hidden) return null;

  return (
    <section className="command-next" aria-label="Ahead">
      <div>
        <span>{signal.eyebrow}</span>
        <h2>{signal.title}</h2>
        <p>{signal.detail}</p>
      </div>
      <div>
        <button className="command-action" disabled={!!busy} onClick={() => void mark('opened')}>
          {busy === 'opened' ? 'Opening…' : signal.action} <span aria-hidden="true">↗</span>
        </button>
        <button className="text-button" disabled={!!busy} onClick={() => void mark('dismissed')}>
          {busy === 'dismissed' ? 'Clearing…' : 'Not needed'}
        </button>
      </div>
    </section>
  );
}

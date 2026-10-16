'use client';
import { useState } from 'react';
import type { LiveController } from '@/domains/live/controller';
export function LiveDiagnostics({ controller }: { controller: LiveController }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function download() {
    setBusy(true);
    setMessage('');
    try {
      const report = await controller.exportDiagnostics();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'aethelios-voice-diagnostics.json';
      link.click();
      // Let browsers begin the download before releasing the temporary URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Diagnostic file prepared locally. Nothing was uploaded.');
    } catch {
      setMessage('Diagnostics could not be prepared. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="live-job" aria-labelledby="live-voice-diagnostics-heading">
      <h3 id="live-voice-diagnostics-heading">Voice diagnostics</h3>
      <p>
        Download timing and connection statistics for testing. Contains no transcript, audio,
        account identifiers or network addresses. Event timings are not measurements of audible
        latency. The file stays on your device unless you share it.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void download();
        }}
      >
        {busy ? 'Preparing diagnostics…' : 'Download voice diagnostics'}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

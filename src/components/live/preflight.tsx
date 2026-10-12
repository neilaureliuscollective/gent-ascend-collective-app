'use client';
import { useState } from 'react';
import type { PreflightReport } from '@/domains/live/preflight';
export function LivePreflight() {
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function inspect(provider: boolean) {
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const response = await fetch(
        '/api/aethelios/live/preflight',
        provider
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkProvider: true }),
              cache: 'no-store',
            }
          : { cache: 'no-store' },
      );
      const value = (await response.json()) as PreflightReport & { error?: string };
      if (!response.ok) throw new Error(value.error ?? 'Preflight unavailable.');
      setReport(value);
    } catch {
      setError('Live preflight could not be verified. Reload your founder session and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Aethelios Live hosted preflight" aria-busy={busy}>
      <p className="eyebrow">AETHELIOS LIVE / PREFLIGHT</p>
      <h2>Verify the deployed voice configuration.</h2>
      <p>
        This checks the current server, using its existing OpenAI credential. Keys stay on the
        server. Checking model metadata does not start voice, run generation, change flags or grant
        launch approval.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void inspect(false);
        }}
      >
        Inspect Live configuration
      </button>{' '}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void inspect(true);
        }}
      >
        Check OpenAI model metadata
      </button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <p role="status">Preflight inspected. Launch acceptance remains unverified.</p>
          <dl>
            <dt>Environment</dt>
            <dd>{report.environment}</dd>
            <dt>Source commit</dt>
            <dd style={{ overflowWrap: 'anywhere' }}>{report.source ?? 'Unavailable'}</dd>
            <dt>OpenAI key configured on this server</dt>
            <dd>{report.keyConfigured ? 'Yes' : 'No'}</dd>
            <dt>Pilot model</dt>
            <dd>{report.model ?? 'Unsupported configuration'}</dd>
            <dt>Live enabled flag</dt>
            <dd>{report.enabled ? 'On' : 'Off'}</dd>
            <dt>Hosting controls declared</dt>
            <dd>{report.controlsDeclared ? 'Yes — declaration only' : 'No'}</dd>
            <dt>Preview database binding</dt>
            <dd>
              {report.previewDatabaseBinding} — configuration only; isolated target acceptance is
              still required.
            </dd>
            <dt>Admission configuration</dt>
            <dd>
              {report.admissionConfigured
                ? 'Configured; runtime acceptance still required'
                : 'Blocked'}
            </dd>
            <dt>Provider metadata</dt>
            <dd>
              {report.provider.status}
              {report.provider.durationMs !== null
                ? ' · ' + report.provider.durationMs + ' ms metadata request'
                : ''}
            </dd>
            <dt>Independent expiry enabled flag</dt>
            <dd>{report.expiry.enabled ? 'On' : 'Off'}</dd>
            <dt>Expiry worker credential configured</dt>
            <dd>{report.expiry.workerCredentialConfigured ? 'Yes' : 'No'}</dd>
            <dt>Scheduler credential configured</dt>
            <dd>{report.expiry.schedulerSecretConfigured ? 'Yes' : 'No'}</dd>
            <dt>Database connection configured</dt>
            <dd>
              {report.expiry.databaseConnectionConfigured
                ? 'Yes — binding still requires verification'
                : 'No'}
            </dd>
            <dt>Schedule and provider cleanup acceptance</dt>
            <dd>Unverified — requires actual scheduled delivery and provider hangup tests.</dd>
          </dl>
          <ul>
            {report.schema.map((item) => (
              <li key={item.name}>
                {item.name}: {item.status}
              </li>
            ))}
          </ul>
          <p>
            Readable schema does not prove RPC migrations or record isolation. Accessible model
            metadata does not prove voice access, quota, audio quality or billed cost. Expiry flags
            and credentials do not prove a running schedule or successful cleanup. Production voice
            admission remains disabled.
          </p>
          <p>
            Next: verify migrations and two-account ownership, independent expiry/hangup, actual
            voice/tool sessions and physical mobile audio using the Phase 5 acceptance procedure.
          </p>
        </>
      )}
    </section>
  );
}

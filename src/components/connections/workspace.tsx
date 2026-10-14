'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { ConnectionProvider, ConnectionView } from '@/domains/connections/schema';

type Board = { github: ConnectionView; vercel: ConnectionView };

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="28" height="28" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 4.58c.68.003 1.36.092 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}
function VercelMark() {
  return (
    <svg viewBox="0 0 76 65" width="24" height="21" aria-hidden="true">
      <path fill="currentColor" d="M37.5274 0L75.0548 65H0L37.5274 0z" />
    </svg>
  );
}

function statusTone(status: ConnectionView['status']) {
  if (status === 'connected') return 'is-connected';
  if (status === 'connecting') return 'is-connecting';
  if (status === 'setup_required' || status === 'disconnected') return 'is-idle';
  return 'is-alert';
}

export function ConnectionsWorkspace({ initial, notice }: { initial: Board; notice?: string }) {
  const [board, setBoard] = useState(initial);
  const [busy, setBusy] = useState<ConnectionProvider | null>(null);
  const [message, setMessage] = useState(notice ?? '');
  const [detail, setDetail] = useState<ConnectionProvider | null>(null);
  const [setup, setSetup] = useState<ConnectionProvider | null>(null);
  const [confirm, setConfirm] = useState<ConnectionProvider | null>(null);
  const alive = useRef(true);
  const titleId = useId();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function refresh() {
    const response = await fetch('/api/connections', { cache: 'no-store' });
    const next = (await response.json()) as Board & { error?: string };
    if (!response.ok) throw new Error(next.error ?? 'Connections could not be loaded.');
    if (alive.current) setBoard(next);
  }
  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const next = (await response.json()) as { error?: string; location?: string };
    if (!response.ok) throw new Error(next.error ?? 'The connection request failed.');
    return next;
  }
  async function connect(provider: ConnectionProvider) {
    if (busy) return;
    setBusy(provider);
    setMessage('');
    try {
      const started = await post(`/api/connections/${provider}/start`, {});
      if (started.location) {
        window.location.assign(started.location);
        return;
      }
      throw new Error('The provider did not return an authorization destination.');
    } catch (error) {
      if (alive.current)
        setMessage(error instanceof Error ? error.message : 'Connection could not start.');
    } finally {
      if (alive.current) setBusy(null);
    }
  }
  async function act(provider: ConnectionProvider, path: string, body: unknown, done: string) {
    if (busy) return;
    setBusy(provider);
    setMessage('');
    try {
      await post(path, body);
      await refresh();
      if (alive.current) setMessage(done);
    } catch (error) {
      if (alive.current)
        setMessage(error instanceof Error ? error.message : 'The connection action failed.');
    } finally {
      if (alive.current) {
        setBusy(null);
        setConfirm(null);
      }
    }
  }
  const providers: ConnectionProvider[] = ['github', 'vercel'];
  return (
    <section className="connections-office" aria-labelledby={titleId}>
      <header className="io-hero io-hero-work">
        <p className="eyebrow">AETHELIOS / CONNECTIONS</p>
        <h1 id={titleId}>Verified service access.</h1>
        <p>
          Connect GitHub and Vercel with read-only, selected-resource authorization. Aethelios never
          marks a service Connected from environment variables or a callback alone.
        </p>
        <nav className="io-work-links" aria-label="Founder destinations">
          <Link className="secondary-button" href="/app/founder">
            Founder Office
          </Link>
          <Link className="secondary-button" href="/app/you">
            Account
          </Link>
          <Link className="secondary-button" href="/app/architect">
            Architect
          </Link>
        </nav>
      </header>
      {message && (
        <p className="connections-status" role="status">
          {message}
        </p>
      )}
      <div className="connections-grid">
        {providers.map((provider) => {
          const view = board[provider];
          const open = detail === provider;
          const showingSetup = setup === provider;
          const asking = confirm === provider;
          const readiness = [
            ['Configuration ready', view.setup.configurationReady],
            ['Webhook ready', view.setup.webhookReady],
            ['Account authorization completed', view.setup.accountAuthorized],
            ['Selected resource verified', view.setup.resourceVerified],
          ] as const;
          return (
            <article
              className={`connections-card founder-card ${statusTone(view.status)}`}
              key={provider}
            >
              <header className="connections-card-head">
                <span className="connections-mark" aria-hidden="true">
                  {provider === 'github' ? <GitHubMark /> : <VercelMark />}
                </span>
                <div>
                  <h2>{view.label}</h2>
                  <p className="connections-purpose">{view.purpose}</p>
                </div>
                <p className={`connections-pill ${statusTone(view.status)}`}>
                  {view.status.replace('_', ' ')}
                </p>
              </header>
              <p>{view.summary}</p>
              <dl className="connections-meta">
                <div>
                  <dt>Account</dt>
                  <dd>{view.accountLogin ?? 'Not linked'}</dd>
                </div>
                <div>
                  <dt>{provider === 'github' ? 'Repository' : 'Project'}</dt>
                  <dd>{view.selectedName ?? 'Not selected'}</dd>
                </div>
                <div>
                  <dt>Last verified</dt>
                  <dd>
                    {view.lastVerifiedAt ? new Date(view.lastVerifiedAt).toLocaleString() : 'Never'}
                  </dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>{view.accessMode === 'read-only' ? 'Read-only' : 'None'}</dd>
                </div>
              </dl>
              {asking && (
                <div
                  className="connections-permissions"
                  role="region"
                  aria-label="Permission summary"
                >
                  <h3>Before leaving for {view.label}</h3>
                  <ul>
                    {view.capabilities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>You will review and confirm access with {view.label}, then return here.</p>
                  <div className="connections-actions">
                    <button
                      className="button"
                      disabled={Boolean(busy)}
                      onClick={() => void connect(provider)}
                    >
                      Continue to {view.label}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={Boolean(busy)}
                      onClick={() => setConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="connections-actions">
                {(view.status === 'disconnected' ||
                  view.status === 'setup_required' ||
                  view.status === 'expired' ||
                  view.status === 'revoked' ||
                  view.status === 'verification_failed') &&
                  !asking && (
                    <button
                      className="button"
                      disabled={Boolean(busy) || view.setupRequired}
                      onClick={() => setConfirm(provider)}
                    >
                      {view.setupRequired
                        ? 'Setup required'
                        : view.status === 'expired' || view.status === 'revoked'
                          ? 'Connect again'
                          : 'Connect'}
                    </button>
                  )}
                {view.status === 'connecting' && view.resources.length > 0 && (
                  <label>
                    Select {provider === 'github' ? 'repository' : 'project'}
                    <select
                      disabled={Boolean(busy)}
                      defaultValue=""
                      onChange={(event) => {
                        if (!event.target.value) return;
                        void act(
                          provider,
                          '/api/connections/select',
                          { provider, resourceId: event.target.value },
                          'Selection verified.',
                        );
                      }}
                    >
                      <option value="">Choose…</option>
                      {view.resources.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(view.status === 'connected' ||
                  view.status === 'degraded' ||
                  view.status === 'verification_failed') && (
                  <button
                    className="secondary-button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void act(
                        provider,
                        '/api/connections/verify',
                        { provider },
                        'Verification repeated against the provider.',
                      )
                    }
                  >
                    Verify again
                  </button>
                )}
                {view.status !== 'disconnected' && view.status !== 'setup_required' && (
                  <button
                    className="secondary-button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void act(
                        provider,
                        '/api/connections/disconnect',
                        { provider },
                        view.installationRemainsHint,
                      )
                    }
                  >
                    Disconnect
                  </button>
                )}
                <button
                  className="secondary-button"
                  disabled={Boolean(busy)}
                  aria-expanded={showingSetup}
                  onClick={() => setSetup(showingSetup ? null : provider)}
                >
                  {showingSetup ? 'Hide setup' : 'View setup'}
                </button>
                <button
                  className="secondary-button"
                  disabled={Boolean(busy)}
                  aria-expanded={open}
                  onClick={() => setDetail(open ? null : provider)}
                >
                  {open ? 'Hide detail' : 'What Aethelios can do'}
                </button>
              </div>
              {showingSetup && (
                <div
                  className="connections-detail"
                  role="region"
                  aria-label={`${view.label} setup`}
                >
                  <h3>Setup</h3>
                  <dl className="connections-meta">
                    {readiness.map(([label, ready]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{ready ? 'Ready' : 'Not ready'}</dd>
                      </div>
                    ))}
                  </dl>
                  {view.setup.missing.length > 0 && (
                    <>
                      <h4>Missing settings</h4>
                      <ul>
                        {view.setup.missing.map((name) => (
                          <li key={name}>
                            <code>{name}</code>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {view.setup.invalid.length > 0 && (
                    <>
                      <h4>Invalid settings</h4>
                      <ul>
                        {view.setup.invalid.map((name) => (
                          <li key={name}>
                            <code>{name}</code>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p>
                    Connect stays disabled until configuration is ready. Webhook readiness, an
                    enabled button, or a successful deploy is not a connected account.
                  </p>
                </div>
              )}
              {open && (
                <div className="connections-detail">
                  <h3>Current capability</h3>
                  <ul>
                    {view.capabilities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>{view.installationRemainsHint}</p>
                  {view.lastError && <p role="alert">{view.lastError}</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

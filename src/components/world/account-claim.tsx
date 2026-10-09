'use client';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { EnergyOrb } from './energy-orb';
import { BrowserEntryNotice } from '@/components/browser-entry-notice';
import { clearDraft, readDraft, writeDraft } from '@/domains/onboarding/draft';
import {
  claimReceipt,
  claimReturn,
  focuses,
  type DirectionDraft,
} from '@/domains/onboarding/model';
import { track } from '@/domains/onboarding/track';

type Config = {
  authenticated: boolean;
  ready: boolean;
  recoveryReady?: boolean;
  google: boolean;
  siteKey: string;
  captchaRequired: boolean;
};
type Captcha = {
  render: (
    node: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
const captcha = () => (window as Window & { turnstile?: Captcha }).turnstile;

export function AccountClaim({
  standalone = false,
  recovery = false,
}: { standalone?: boolean; recovery?: boolean } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [config, setConfig] = useState<Config | null>(null),
    [draft, setDraft] = useState<DirectionDraft | null>(null);
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState('');
  const [receipt, setReceipt] = useState<ReturnType<typeof claimReceipt.parse> | null>(null),
    [saved, setSaved] = useState(false);
  const [scriptReady, setScriptReady] = useState(false),
    [token, setToken] = useState(''),
    [resendAt, setResendAt] = useState(0);
  const node = useRef<HTMLDivElement>(null),
    widget = useRef<string | null>(null),
    lock = useRef(false);
  async function load() {
    try {
      const response = await fetch('/api/account/auth', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const result: Config = await response.json();
      setConfig(result);
      return result;
    } catch {
      setProblem('Account access could not load. Retry when you’re ready.');
      return null;
    }
  }
  useEffect(() => {
    const show = () => {
      setDraft(readDraft());
      setOpen(true);
      setSaved(false);
      setReceipt(null);
      setProblem('');
      track('claim_exposed');
      void load();
    };
    const sync = () => setDraft(readDraft());
    window.addEventListener('gent-direction-change', sync);
    window.addEventListener('storage', sync);
    if (standalone || params.get('claim') === '1') show();
    return () => {
      window.removeEventListener('gent-direction-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [params, standalone]);
  useEffect(() => {
    if (!open || !scriptReady || !config?.siteKey || !node.current || !captcha()) return;
    widget.current = captcha()!.render(node.current, {
      sitekey: config.siteKey,
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => {
        setToken('');
        setProblem('The security check could not load. Retry shortly.');
      },
    });
    return () => {
      if (widget.current) captcha()?.remove(widget.current);
      widget.current = null;
    };
  }, [open, scriptReady, config?.siteKey]);
  async function auth(action: 'google' | 'send' | 'verify') {
    if (lock.current) return;
    if (action === 'google' && draft) {
      const retained = writeDraft(draft);
      if (!retained) {
        setProblem('Device storage is unavailable. Use email here to keep your draft in this tab.');
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setProblem('');
    if (action !== 'verify') {
      try {
        sessionStorage.setItem('gent-claim-method', action === 'google' ? 'google' : 'email');
      } catch {}
      track('auth_started', action === 'google' ? 'google' : 'email');
    }
    try {
      const response = await fetch('/api/account/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'google'
            ? { action, entry: standalone ? (recovery ? 'recover' : 'account') : 'claim' }
            : action === 'send'
              ? {
                  action,
                  email,
                  captchaToken: token,
                  entry: standalone ? (recovery ? 'recover' : 'account') : 'claim',
                }
              : {
                  action,
                  email,
                  code,
                  entry: standalone ? (recovery ? 'recover' : 'account') : 'claim',
                },
        ),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Account access could not be confirmed.');
      if (action === 'google') window.location.assign(result.url);
      if (action === 'send') {
        setSent(true);
        setResendAt(Date.now() + 60000);
      }
      if (action === 'verify') {
        setConfig((value) => (value ? { ...value, authenticated: true } : value));
        router.replace(standalone ? result.destination : claimReturn);
        router.refresh();
      }
    } catch (error) {
      setProblem(
        error instanceof Error && error.name === 'Error'
          ? error.message
          : 'Account access could not be confirmed. Your draft is still here. Retry.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
      setToken('');
      if (widget.current) captcha()?.reset(widget.current);
    }
  }
  async function keep(replace = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setProblem('');
    let current = draft;
    if (!current) {
      current = {
        version: 1,
        id: crypto.randomUUID(),
        focus: 'body',
        intention: '',
        createdAt: Date.now(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      writeDraft(current);
      setDraft(current);
    }
    try {
      const response = await fetch('/api/account/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: current,
          replace,
          expectedVersion: receipt?.version ?? 0,
          ...(receipt ? { day: receipt.day } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Your direction could not be saved.');
      const confirmed = claimReceipt.parse(result);
      setReceipt(confirmed);
      if (confirmed.status === 'saved') {
        clearDraft(current.id);
        setDraft(current);
        setSaved(true);
        track('draft_imported');
        track('onboarding_completed');
        window.dispatchEvent(new Event('gent-priority-reload'));
        router.replace(`/experience/world?world=${focuses[current.focus].world}`);
        router.refresh();
      }
    } catch (error) {
      setProblem(
        error instanceof Error && error.name === 'Error'
          ? error.message
          : 'The save could not be confirmed. Your draft is still here. Retry.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const completed = useRef(false);
  useEffect(() => {
    if (
      standalone ||
      !open ||
      !config?.authenticated ||
      saved ||
      completed.current ||
      receipt ||
      problem
    )
      return;
    completed.current = true;
    let method: 'google' | 'email' | 'existing' = 'existing';
    try {
      const stored = sessionStorage.getItem('gent-claim-method');
      if (stored === 'google' || stored === 'email') method = stored;
      sessionStorage.removeItem('gent-claim-method');
    } catch {}
    track('auth_completed', method);
    void keep();
  });
  function close() {
    setOpen(false);
    completed.current = false;
    if (params.get('claim')) router.replace('/experience/world');
  }
  const content = (
    <div className="gw-account-claim" data-saved={saved}>
      <BrowserEntryNotice />
      {!standalone && <EnergyOrb moving={false} />}
      <p className="gw-kicker">
        {recovery
          ? 'RETURN TO YOUR ACCOUNT'
          : saved
            ? 'YOUR FIRST CHAPTER'
            : 'YOUR DIRECTION. YOUR WORLD.'}
      </p>
      {draft?.intention && <blockquote>{draft.intention}</blockquote>}
      {saved ? (
        <>
          <h3>{draft?.intention ? 'Your direction is saved.' : 'Your free account is ready.'}</h3>
          <p>Choose a practical next move and save it to Command.</p>
          <Link className="gw-action" href="/app/welcome" onClick={() => setOpen(false)}>
            Begin my first session →
          </Link>
          <Link
            className="gw-action"
            href={focuses[draft?.focus ?? 'body'].href}
            onClick={() => setOpen(false)}
          >
            Continue to{' '}
            {draft?.focus === 'presence'
              ? 'Grooming'
              : draft?.focus === 'focus'
                ? 'your day'
                : 'Performance'}{' '}
            ↗
          </Link>
          <button onClick={close}>Return to my world</button>
        </>
      ) : standalone && config?.authenticated ? (
        <Link className="gw-action" href="/app/welcome">
          Open Aethelios →
        </Link>
      ) : config?.authenticated ? (
        <>
          {receipt?.status === 'conflict' ? (
            <>
              <h3>You already have a direction for today.</h3>
              <p>Your saved priority: {receipt.intention}</p>
              <button className="gw-action" disabled={busy} onClick={() => void keep(true)}>
                Replace it with this direction
              </button>
              <button
                onClick={() => {
                  clearDraft(draft?.id);
                  close();
                }}
              >
                Keep my saved priority
              </button>
            </>
          ) : receipt?.status === 'day_changed' ? (
            <>
              <p>A new day has begun. Save this direction for {receipt.day}?</p>
              <button className="gw-action" disabled={busy} onClick={() => void keep()}>
                Save for today
              </button>
            </>
          ) : (
            <>
              <p>
                {busy
                  ? 'Keeping your direction…'
                  : 'Your account is connected. Keep your direction here.'}
              </p>
              <button className="gw-action" disabled={busy} onClick={() => void keep()}>
                {busy ? 'Saving…' : 'Save my direction'}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <p>
            {draft?.intention
              ? 'Keep your direction and build from here.'
              : recovery
                ? 'Use a code sent to your existing account email. No password required.'
                : 'Your personal intelligence, conversations, and reviewed saved work.'}
          </p>
          <p className="gw-muted">
            No payment required to create an account. Intelligence access requires an eligible beta
            grant or membership.
          </p>
          {!config ? (
            <button
              className="gw-action"
              onClick={() => {
                setProblem('');
                void load();
              }}
            >
              Load account options
            </button>
          ) : !(recovery ? config.recoveryReady : config.ready) ? (
            <>
              <p>Account entry is being prepared. Your draft stays on this device.</p>
              <Link href={standalone ? '/enter' : '/enter?entry=claim'}>
                Already have an account? Sign in ↗
              </Link>
              {standalone && !recovery && config.recoveryReady && (
                <Link href="/enter?entry=recover">Use an email code ↗</Link>
              )}
            </>
          ) : (
            <>
              {config.google && (
                <button
                  className="gw-action gw-google"
                  disabled={busy}
                  onClick={() => void auth('google')}
                >
                  Continue with Google
                </button>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void auth(sent ? 'verify' : 'send');
                }}
              >
                <label htmlFor="claim-email">Email</label>
                <input
                  id="claim-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  disabled={busy || sent}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {sent && (
                  <>
                    <p>Enter the code sent to {email}. Return here to complete sign-in.</p>
                    <label htmlFor="claim-code">Verification code</label>
                    <input
                      id="claim-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6,10}"
                      minLength={6}
                      maxLength={10}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </>
                )}
                {config.siteKey && (
                  <>
                    <Script
                      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                      onReady={() => setScriptReady(true)}
                      onError={() =>
                        setProblem('The security check could not load. Retry shortly.')
                      }
                    />
                    <div ref={node} />
                  </>
                )}
                <button
                  className="gw-action"
                  disabled={busy || (!sent && config.captchaRequired && !token)}
                >
                  {busy ? 'Connecting…' : sent ? 'Enter Aethelios' : 'Continue with email'}
                </button>
              </form>
              {sent && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setSent(false);
                      setCode('');
                      setProblem('');
                    }}
                  >
                    Use a different email
                  </button>
                  <button
                    disabled={busy || (config.captchaRequired && !token)}
                    onClick={() => {
                      if (Date.now() < resendAt) {
                        setProblem('Wait a minute before requesting another code.');
                        return;
                      }
                      void auth('send');
                    }}
                  >
                    Send a new code
                  </button>
                </>
              )}
              <Link href={standalone ? '/enter' : '/enter?entry=claim'}>
                Use my existing password ↗
              </Link>
            </>
          )}
        </>
      )}
      {problem && <p role="alert">{problem}</p>}
      {!standalone && !saved && (
        <button disabled={busy} onClick={close}>
          Keep exploring
        </button>
      )}
    </div>
  );
  return standalone ? (
    content
  ) : (
    <ContextSheet
      open={open}
      title={saved ? 'Your world is ready.' : 'Make this yours.'}
      busy={busy}
      onClose={close}
    >
      {content}
    </ContextSheet>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

type Turnstile = {
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
const captcha = () => (window as Window & { turnstile?: Turnstile }).turnstile;
export function MembershipRegistration({
  siteKey,
  captchaRequired,
}: {
  siteKey: string;
  captchaRequired: boolean;
}) {
  const node = useRef<HTMLDivElement>(null),
    widget = useRef<string | null>(null);
  const [ready, setReady] = useState(false),
    [token, setToken] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!ready || !siteKey || !node.current || !captcha()) return;
    widget.current = captcha()!.render(node.current, {
      sitekey: siteKey,
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => {
        setToken('');
        setMessage('The security check could not load. Please retry.');
      },
    });
    return () => {
      if (widget.current) captcha()?.remove(widget.current);
      widget.current = null;
    };
  }, [ready, siteKey]);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage('');
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch('/api/membership/registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: data.get('email'),
              password: data.get('password'),
              captchaToken: token,
            }),
          });
          const result = await response.json();
          setMessage(
            response.ok
              ? result.message
              : (result.error ?? 'Registration is temporarily unavailable.'),
          );
        } catch {
          setMessage('Registration is temporarily unavailable. Please retry.');
        } finally {
          setBusy(false);
          setToken('');
          if (widget.current) captcha()?.reset(widget.current);
        }
      }}
    >
      <label htmlFor="join-email">Email</label>
      <input
        id="join-email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
      />
      <label htmlFor="join-password">Password</label>
      <input
        id="join-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
      />
      <p>Use at least 12 characters. Confirm your email before choosing a paid plan.</p>
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onLoad={() => setReady(true)}
            onError={() => setMessage('The security check could not load. Please retry.')}
          />
          <div ref={node} />
        </>
      )}
      <button className="button" disabled={busy || (captchaRequired && !token)}>
        {busy ? 'Creating your account…' : 'Create my account →'}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}

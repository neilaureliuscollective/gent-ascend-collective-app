import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from '@/app/auth/actions';
import { currentPerson } from '@/domains/person/current';
import { BrowserEntryNotice } from '@/components/browser-entry-notice';
import { currentIdentity } from '@/domains/identity/current';
import { parseEnvironment } from '@/platform/environment';
import { brand } from '@/platform/brand';
import './entrance.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Enter Aethelios',
  robots: { index: false, follow: false },
};

const errors: Record<string, string> = {
  invalid: 'Enter a valid email and password.',
  credentials:
    'That email and password were not accepted. Check the password saved for Aethelios.',
  service:
    'The account service could not complete sign-in. Your account is intact; try again shortly.',
  unavailable: 'The account service is unavailable here. Try again shortly.',
};

export default async function Enter({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; entry?: string }>;
}) {
  const [identity, params] = await Promise.all([currentIdentity(), searchParams]);
  const person = identity ? await currentPerson() : null;
  const destination = person?.onboarding_completed || person?.priority ? '/app' : '/app/welcome';
  const connected = Boolean(parseEnvironment(process.env).NEXT_PUBLIC_SUPABASE_URL);

  return (
    <main id="world-main" className="entrance-world">
      <section className="entrance-stage" aria-labelledby="entrance-title">
        <div className="entrance-depth" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="entrance-copy">
          <p className="entrance-kicker">GENT ASCEND COLLECTIVE / THE PERSONAL WORLD</p>
          <div className="entrance-emblem">
            <Image src={brand.crest} alt="" width={172} height={172} preload />
          </div>
          <h1 id="entrance-title">
            {identity ? (
              <>
                The door is <em>yours.</em>
              </>
            ) : (
              <>
                The world becomes <em>yours.</em>
              </>
            )}
          </h1>
          <p className="entrance-statement">
            {identity
              ? 'Your place inside Aethelios is ready when you are.'
              : 'Create your own direction, daily practice and personal space.'}
          </p>
          <div className="entrance-threads" aria-hidden="true">
            <span>YOUR DIRECTION</span>
            <span>YOUR PRACTICE</span>
            <span>YOUR INTELLIGENCE</span>
          </div>
        </div>
        <div className="entrance-panel">
          <BrowserEntryNotice />
          {identity ? (
            <>
              <p className="entrance-kicker">YOUR PERSONAL SPACE</p>
              <h2>Continue your ascent.</h2>
              <p>Your work and records stay connected to your account.</p>
              <Link className="entrance-primary" href={destination}>
                Open my space <span aria-hidden="true">↗</span>
              </Link>
            </>
          ) : connected ? (
            <>
              <p className="entrance-kicker">YOUR ACCOUNT</p>
              <h2>Return to your space.</h2>
              <p>Sign in with your existing email and password.</p>
              <form action={signIn} className="entrance-form">
                <input type="hidden" name="entry" value="world" />
                {params.entry === 'claim' && <input type="hidden" name="claim" value="1" />}
                {params.error && (
                  <p className="entrance-error" role="alert">
                    {errors[params.error] ?? errors.invalid}
                  </p>
                )}
                <label htmlFor="entrance-email">Email</label>
                <input
                  id="entrance-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
                <label htmlFor="entrance-password">Password</label>
                <input
                  id="entrance-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <button className="entrance-primary" type="submit">
                  Enter Aethelios <span aria-hidden="true">↗</span>
                </button>
              </form>
              <p className="entrance-note">
                New here or forgot your password?{' '}
                <Link href="/experience/world?claim=1">Create an account or use an email code</Link>
                . Free access requires no invitation.
              </p>
            </>
          ) : (
            <>
              <p className="entrance-kicker">PERSONAL SPACE PREVIEW</p>
              <h2>The entrance is being prepared.</h2>
              <p>Personal accounts are not connected in this preview environment.</p>
              <p className="entrance-note">
                The public world and collection remain open to explore.
              </p>
            </>
          )}
          <div className="entrance-exits">
            <Link href="/shop">Explore the collection ↗</Link>
            <Link href="/">Return to the journey ↗</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

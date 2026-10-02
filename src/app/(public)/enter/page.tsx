import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from '@/app/auth/actions';
import { savedWorld } from '@/domains/onboarding/service';
import { currentIdentity } from '@/domains/identity/current';
import { readPilot } from '@/domains/pilot/service';
import { parseEnvironment } from '@/platform/environment';
import { brand } from '@/platform/brand';
import './entrance.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Enter Gent Ascend',
  robots: { index: false, follow: false },
};

const errors: Record<string, string> = {
  invalid: 'Enter a valid email and password.',
  credentials:
    'That email and password were not accepted. Check the password saved for Gent Ascend.',
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
  const pilot = identity ? await readPilot() : null;
  const claimed = identity ? await savedWorld() : null;
  const destination = claimed
    ? '/experience/world'
    : pilot?.beta || pilot?.founder
      ? pilot.person.priority
        ? '/app'
        : '/app/welcome'
      : '/app/welcome';
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
            <Image src={brand.crest} alt="" width={172} height={172} priority />
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
              ? claimed || pilot?.beta || pilot?.founder
                ? 'Your place inside Gent Ascend is ready when you are.'
                : 'Your account is recognized. Confirm your invitation to continue inside.'
              : 'Return to your saved direction, training, and personal space.'}
          </p>
          <div className="entrance-threads" aria-hidden="true">
            <span>YOUR DIRECTION</span>
            <span>YOUR PRACTICE</span>
            <span>YOUR INTELLIGENCE</span>
          </div>
        </div>
        <div className="entrance-panel">
          {identity ? (
            <>
              <p className="entrance-kicker">YOUR PERSONAL SPACE</p>
              <h2>
                {claimed || pilot?.beta || pilot?.founder
                  ? 'Continue your ascent.'
                  : 'Confirm your place.'}
              </h2>
              <p>
                {claimed || pilot?.beta || pilot?.founder
                  ? 'Step into your own space. Your work and records stay connected to your account.'
                  : 'Your account is recognized. Founding member access is confirmed through your invitation.'}
              </p>
              <Link className="entrance-primary" href={destination}>
                {claimed || pilot?.beta || pilot?.founder
                  ? 'Open my space'
                  : 'Continue to invitation'}{' '}
                <span aria-hidden="true">↗</span>
              </Link>
            </>
          ) : connected ? (
            <>
              <p className="entrance-kicker">PRIVATE MEMBER ENTRANCE</p>
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
                  Enter Gent Ascend <span aria-hidden="true">↗</span>
                </button>
              </form>
              <p className="entrance-note">
                New here? <Link href="/experience/world?claim=1">Create a free account</Link>.
                Existing invitations remain supported.
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

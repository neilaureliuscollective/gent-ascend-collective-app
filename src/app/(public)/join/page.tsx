import Link from 'next/link';
import { signIn } from '@/app/auth/actions';
import { currentIdentity } from '@/domains/identity/current';
import { AccountClaim } from '@/components/world/account-claim';
import '@/app/(experience)/experience/world.css';

import '../founding-launch.css';
export const dynamic = 'force-dynamic';
export default async function Join({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const identity = await currentIdentity(),
    params = await searchParams;
  return (
    <main id="world-main" className="founding-world">
      <header className="world-page-intro founding-intro">
        <p className="world-kicker">Public Aethelios / Your account</p>
        <h1>
          Your chapter
          <br />
          <em>starts here.</em>
        </h1>
        <p>
          Confirm your email and make a place for your intelligence and saved work. Creating an
          account does not subscribe you, charge you, or grant AI access.
        </p>
      </header>
      <section className="world-section membership-arrival">
        {identity ? (
          <>
            <h2>Your account is ready.</h2>
            <Link className="world-button" href="/app/welcome">
              Open Aethelios →
            </Link>
          </>
        ) : (
          <>
            <div>
              <h2>Create an account</h2>
              <AccountClaim standalone />
            </div>
            <div>
              <h2>Already here?</h2>
              <form action={signIn}>
                <input type="hidden" name="entry" value="membership" />
                {(params.error || params.status === 'auth') && (
                  <p role="alert">
                    Sign-in could not be completed. Check your details or try again shortly.
                  </p>
                )}
                <label htmlFor="member-email">Email</label>
                <input id="member-email" name="email" type="email" autoComplete="email" required />
                <label htmlFor="member-password">Password</label>
                <input
                  id="member-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <button className="world-button">Sign in →</button>
              </form>
              <Link className="world-text-link" href="/enter?entry=recover">
                Forgot your password? Use an email code →
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

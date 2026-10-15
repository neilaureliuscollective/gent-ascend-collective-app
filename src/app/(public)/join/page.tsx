import Link from 'next/link';
import { signIn } from '@/app/auth/actions';
import { currentIdentity } from '@/domains/identity/current';
import { registrationConfig } from '@/domains/identity/registration-config';
import { MembershipRegistration } from '@/components/membership-registration';
import { presentationPlan } from '@/domains/ecosystem/presentation-catalog';
import '../founding-launch.css';
export const dynamic = 'force-dynamic';
export default async function Join({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const config = registrationConfig(process.env),
    identity = await currentIdentity(),
    params = await searchParams;
  return (
    <main id="world-main" className="founding-world">
      <header className="world-page-intro founding-intro">
        <p className="world-kicker">Aethelios / Your account</p>
        <h1>
          Your chapter
          <br />
          <em>starts here.</em>
        </h1>
        <p>
          Create your account, confirm your email, then review the founding offer. Creating an
          account does not subscribe you or charge you.
        </p>
        {params.from === 'ecosystem' && presentationPlan(params.plan) ? (
          <p className="founding-disclosure">
            You arrived from Ecosystem with {presentationPlan(params.plan)!.name} selected as a
            preview direction. That name is not a live product. If registration is closed, sign in
            only if you already have access.
          </p>
        ) : null}
      </header>
      <section className="world-section membership-arrival">
        {identity ? (
          <>
            <h2>Your account is ready.</h2>
            <Link className="world-button" href="/app/membership">
              Your membership →
            </Link>
          </>
        ) : (
          <>
            <div>
              <h2>Create an account</h2>
              {config ? (
                <MembershipRegistration
                  siteKey={config.siteKey}
                  captchaRequired={config.captchaRequired}
                />
              ) : (
                <p>
                  Public account registration is not open yet. Existing invited members can sign in.
                </p>
              )}
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
            </div>
          </>
        )}
      </section>
    </main>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/platform/brand';
import { currentPerson } from '@/domains/person/current';
import { currentFounderAccess } from '@/domains/access/founder';
import { parseEnvironment } from '@/platform/environment';
import { signIn, signOut } from '@/app/auth/actions';
import { ProfileEditor } from '@/components/profile-editor';
import { saveProfileAction } from './actions';
export default async function You({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [person, params, founder] = await Promise.all([
    currentPerson(), searchParams, currentFounderAccess(),
  ]);
  const env = parseEnvironment(process.env);
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Gent Ascend / Your identity</p>
          <h1>Your foundation.</h1>
        </div>
        {person && (
          <Link className="text-link" href="/goals">
            Your goals →
          </Link>
        )}
      </div>
      {person ? (
        <div className="personal-grid">
          <section className="panel">
            <h2>Your standards start here.</h2>
            <p className="form-intro">
              Start with what matters now. You can refine this whenever life changes.
            </p>
            <ProfileEditor person={person} action={saveProfileAction} />
          </section>
          <aside className="panel perspective-panel">
            {founder && <p className="eyebrow">Founder access verified</p>}
            <Image
              className="identity-crest"
              src={brand.crest}
              alt={brand.crestAlt}
              width={160}
              height={160}
              sizes="160px"
            />
            <span className="eyebrow">Your personal space</span>
            <h2>
              Built around
              <br />
              your life.
            </h2>
            <p>
              Your priority gives you a clear reference point. Your timezone keeps your records
              aligned with your day.
            </p>
            <p>These details are private to your account.</p>
            <form action={signOut}>
              <button className="secondary-button">Sign out</button>
            </form>
          </aside>
        </div>
      ) : (
        <div className="account-arrival">
          <aside className="account-brand">
            <Image
              src={brand.lockup}
              alt="Gent Ascend Collective — official crest and wordmark"
              width={960}
              height={960}
              sizes="(max-width: 600px) 230px, 420px"
              preload
            />
            <p className="eyebrow">CHARACTER · DISCIPLINE · ASCENSION · LEGACY</p>
          </aside>
          <section className="panel profile-panel">
            <p className="eyebrow">YOUR GENT ASCEND ACCOUNT</p>
            <h2>
              Build the man
              <br />
              <em>behind the life.</em>
            </h2>
            <p className="account-intro">
              Your direction, daily practice, and personal intelligence. One space to build a better
              standard.
            </p>
            {env.NEXT_PUBLIC_SUPABASE_URL ? (
              <form action={signIn}>
                {params.error && (
                  <p role="alert">
                    Sign-in could not be completed. Check your details and try again.
                  </p>
                )}
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" required />
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <button className="button">Sign in</button>
              </form>
            ) : (
              <>
                <p>
                  You’re exploring the foundation preview. Personal profiles are not connected in
                  this environment.
                </p>
                <p>Your records stay private when you sign in to your own workspace.</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

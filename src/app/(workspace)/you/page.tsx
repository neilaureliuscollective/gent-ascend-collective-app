import Link from 'next/link';
import { currentPerson } from '@/domains/person/current';
import { parseEnvironment } from '@/platform/environment';
import { signIn, signOut } from '@/app/auth/actions';
import { ProfileEditor } from '@/components/profile-editor';
import { saveProfileAction } from './actions';
export default async function You({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [person, params] = await Promise.all([currentPerson(), searchParams]);
  const env = parseEnvironment(process.env);
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">At the center</p>
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
            <h2>A little more you.</h2>
            <p className="form-intro">
              Start with what matters now. You can refine this whenever life changes.
            </p>
            <ProfileEditor person={person} action={saveProfileAction} />
          </section>
          <aside className="panel perspective-panel">
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
        <section className="panel profile-panel">
          <h2>A space of your own.</h2>
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
                You’re exploring the foundation preview. Personal profiles are not connected in this
                environment.
              </p>
              <p>Your records stay private when you sign in to your own workspace.</p>
            </>
          )}
        </section>
      )}
    </>
  );
}

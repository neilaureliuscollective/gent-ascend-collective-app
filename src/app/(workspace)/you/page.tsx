import { currentPerson } from '@/domains/person/current';
import { currentAccess } from '@/domains/access/current';
import { parseEnvironment } from '@/platform/environment';
import { signIn, signOut } from '@/app/auth/actions';
export default async function You({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [person, params] = await Promise.all([currentPerson(), searchParams]);
  const env = parseEnvironment(process.env);
  const access = person ? await currentAccess() : null;
  return (
    <>
      <p className="eyebrow">At the center</p>
      <h1>
        Your world.
        <br />
        <em>Your foundation.</em>
      </h1>
      <section className="panel profile-panel">
        <h2>{person?.display_name ?? 'A space of your own.'}</h2>
        {person ? (
          <>
            <dl>
              <dt>Timezone</dt>
              <dd>{person.timezone}</dd>
              <dt>Profile</dt>
              <dd>{person.onboarding_completed ? 'Onboarding complete' : 'Ready to begin'}</dd>
              <dt>Membership access</dt>
              <dd>{access?.has('aurelius.context') ? 'Aurelius enabled' : 'Core workspace'}</dd>
            </dl>
            <p>Profile editing arrives in the next stage.</p>
            <form action={signOut}>
              <button className="button">Sign out</button>
            </form>
          </>
        ) : env.NEXT_PUBLIC_SUPABASE_URL ? (
          <form action={signIn}>
            {params.error && (
              <p role="alert">Sign-in could not be completed. Check your details and try again.</p>
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
    </>
  );
}

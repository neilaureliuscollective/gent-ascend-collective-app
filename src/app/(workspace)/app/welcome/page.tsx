import Link from 'next/link';
import Image from 'next/image';
import { InstallGuide } from '@/components/install-guide';
import { currentAccess } from '@/domains/access/current';
import { readPilot } from '@/domains/pilot/service';
import { brand } from '@/platform/brand';
import { claimPilotAction, setPilotPassword, submitFeedbackAction } from './actions';
import './welcome-entry.css';

const notices: Record<string, string> = {
  claimed: 'Your invitation access is active.',
  unlisted: 'No invitation benefit was found for this email. Your free account remains available.',
  error: 'We could not confirm invitation access. Please try again.',
  auth: 'That email link was not accepted. Sign in or request a new email code.',
  'password-invalid': 'Use a password of at least 12 characters.',
  'password-error': 'Password could not be saved. Try again.',
  'password-saved': 'Password saved. You can sign in with this email and password next time.',
  'feedback-invalid': 'Choose a category and write 10–1500 characters.',
  'feedback-error': 'Feedback could not be saved. Please try again.',
  'feedback-saved': 'Feedback saved. Thank you.',
};
export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [pilot, params] = await Promise.all([readPilot(), searchParams]);
  const access = pilot ? await currentAccess() : new Set<string>();
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Aethelios / Your first useful result</p>
          <h1>Welcome to Aethelios.</h1>
        </div>
      </div>
      {params.status && notices[params.status] && (
        <p role="status" className="panel">
          {notices[params.status]}
        </p>
      )}
      {!pilot ? (
        <section className="panel pilot-section">
          <h2>Your own space begins here.</h2>
          <p>Create a free account or sign in to keep your conversations and work connected.</p>
          <Link className="button" href="/enter">
            Create an account or sign in →
          </Link>
        </section>
      ) : (
        <>
          <section className="pilot-entry" aria-label="Your Aethelios space">
            <Image src={brand.crest} alt="" width={90} height={90} preload />
            <div>
              <p className="eyebrow">YOUR DIRECTION. YOUR WORLD.</p>
              <h2>Begin with one clear move.</h2>
              <p>Start where it matters today. Your profile can develop as you use your space.</p>
            </div>
          </section>
          <section className="pilot-section">
            <h2>What are you working on?</h2>
            <p>
              Bring one idea, decision or project. Aethelios helps you reach a useful first result,
              then brings in a specialist when it helps.
            </p>
            <Link className="button" href="/app/aethelios">
              Start with Aethelios →
            </Link>
            {!access.has('aurelius.context') && (
              <p>
                Your account is ready. Model access may require an active plan or beta invitation;
                saved work remains yours.
              </p>
            )}
          </section>
          <InstallGuide />
          <details className="panel pilot-section">
            <summary>Save a password for future sign-in</summary>
            <p>
              If you use an email code or invitation, you can also save a password. Use at least 12
              characters.
            </p>
            <form action={setPilotPassword}>
              <label htmlFor="pilot-password">New password</label>
              <input
                id="pilot-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
              <button className="secondary-button">Save password</button>
            </form>
          </details>
          {!pilot.beta && !pilot.founder && (
            <details className="panel pilot-section">
              <summary>Have an invitation benefit?</summary>
              <p>
                Your free account does not require an invitation. If you were offered additional
                access, confirm the invitation tied to your verified email.
              </p>
              <form action={claimPilotAction}>
                <button className="secondary-button">Confirm invitation benefit</button>
              </form>
            </details>
          )}
          {(pilot.beta || pilot.founder) && (
            <details className="panel pilot-section">
              <summary>Share feedback</summary>
              <p>The founder sees this note, not your private records.</p>
              <form action={submitFeedbackAction}>
                <label htmlFor="pilot-category">Type</label>
                <select id="pilot-category" name="category">
                  <option value="friction">Something got in the way</option>
                  <option value="idea">An idea</option>
                  <option value="working">Something worked</option>
                </select>
                <label htmlFor="pilot-message">Your note</label>
                <textarea
                  id="pilot-message"
                  name="message"
                  minLength={10}
                  maxLength={1500}
                  required
                  rows={4}
                />
                <button className="button">Send feedback</button>
              </form>
            </details>
          )}
        </>
      )}
    </>
  );
}

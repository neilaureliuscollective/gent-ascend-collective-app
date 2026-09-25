import Link from 'next/link';
import { readPilot } from '@/domains/pilot/service';
import { claimPilotAction, setPilotPassword, submitFeedbackAction } from './actions';

const notices: Record<string,string> = {
  claimed: 'Your pilot access is active.', unlisted: 'This verified email is not on the pilot list. Ask the person who invited you to check the address.',
  error: 'We could not confirm access. Please try again.', auth: 'That invitation link was not accepted. It may have expired; ask for a new Auth invitation.',
  'password-invalid': 'Use a password of at least 12 characters.', 'password-error': 'Password could not be saved. Try again.', 'password-saved': 'Password saved. You can sign in with this email and password next time.',
  'feedback-invalid': 'Choose a category and write 10–1500 characters.', 'feedback-error': 'Feedback could not be saved. Please try again.', 'feedback-saved': 'Feedback saved. Thank you for helping shape the pilot.',
};
export default async function Welcome({ searchParams }: {searchParams: Promise<{status?: string}>}) {
  const [pilot, params] = await Promise.all([readPilot(), searchParams]);
  return <>
    <div className="page-heading compact-heading"><div><p className="eyebrow">Gent Ascend / Founding members</p><h1>Welcome to your ascent.</h1></div></div>
    {params.status && notices[params.status] && <p role="status" className="panel">{notices[params.status]}</p>}
    {!pilot ? <section className="panel pilot-section"><h2>Accept your invitation</h2><p>Open the invitation sent to your email. If you already have an account, sign in with that email to continue.</p><Link className="button" href="/you">Go to sign in</Link></section> : <>
      {!pilot.beta && !pilot.founder ? <section className="panel pilot-section"><h2>Confirm your place</h2><p>Your invitation is tied to your verified email. Confirm it here to open the founding member experience.</p><form action={claimPilotAction}><button className="button">Confirm my access</button></form></section> : <>
        <div className="personal-grid"><section className="panel"><p className="eyebrow">Your first session</p><h2>Begin with one clear step.</h2><ol className="pilot-steps">
          <li><Link href="/you">Set your priority</Link><p>Name what matters now and set your timezone.</p></li>
          <li><Link href="/ascend-profile">Build your baseline</Link><p>Keep only the facts you choose to confirm.</p></li>
          <li><Link href="/goals">Choose one goal</Link><p>Give it a next action you can actually take.</p></li>
          <li><Link href="/">Use Command today</Link><p>Write your intention, act, then return for an evening review.</p></li>
        </ol><Link className="button" href="/">Open Command</Link></section>
        <aside className="panel perspective-panel"><p className="eyebrow">Your personal intelligence</p><h2>Talk it through.</h2><p>Aethelios can help you think, plan and reflect. Your private work remains yours; a proposal only changes your daily plan when you confirm it.</p><Link className="text-link" href="/aethelios">Meet Aethelios →</Link></aside></div>
        <section className="panel pilot-section"><h2>Set a sign-in password</h2><p>If you arrived through an email invitation, save a password for your next visit. Use at least 12 characters.</p><form action={setPilotPassword}><label htmlFor="pilot-password">New password</label><input id="pilot-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><button className="secondary-button">Save password</button></form></section>
        <section className="panel pilot-section"><h2>Tell us what happened</h2><p>Share a sticking point, an idea or something that worked. The founder sees this message, not your private records.</p><form action={submitFeedbackAction}><label htmlFor="pilot-category">Type</label><select id="pilot-category" name="category"><option value="friction">Something got in the way</option><option value="idea">An idea</option><option value="working">Something worked</option></select><label htmlFor="pilot-message">Your note</label><textarea id="pilot-message" name="message" minLength={10} maxLength={1500} required rows={4}/><button className="button">Send feedback</button></form></section>
      </>}
    </>}
  </>;
}

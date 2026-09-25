import Link from 'next/link';
import { readPilotCohort } from '@/domains/pilot/service';
import { reservePilotAction } from './actions';
export default async function PilotConsole({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const cohort = await readPilotCohort();
  if (!cohort) return <section className="panel pilot-section"><p className="eyebrow">Private founder space</p><h1>Founder access required.</h1><p>Sign in with your founder account to manage the pilot.</p><Link className="button" href="/you">Go to your account</Link></section>;
  const { status } = await searchParams;
  return <>
    <div className="page-heading compact-heading"><div><p className="eyebrow">Founder / Private pilot</p><h1>Founding members.</h1></div><Link className="text-link" href="/welcome">View arrival →</Link></div>
    <div className="personal-grid">
      <section className="panel">
        <h2>Reserve an address</h2>
        <p className="form-intro">This records approval for one verified email. It does not send an invitation. Send the Auth invitation from the Supabase Dashboard after reserving it.</p>
        {status && <p role="status">{status === 'reserved' ? 'Address reserved. Send the Auth invitation from the Dashboard.' : status === 'invalid' ? 'Enter a valid email address.' : 'Could not reserve that address. Check whether it is already listed.'}</p>}
        <form action={reservePilotAction}><label htmlFor="pilot-email">Member email</label><input id="pilot-email" type="email" name="email" autoComplete="email" required maxLength={254}/><button className="button">Reserve access</button></form>
      </section>
      <aside className="panel perspective-panel"><p className="eyebrow">First cohort</p><h2>A small, useful circle.</h2><p>Start with Blair and 3–5 of Katie’s clients. Give each person the private arrival link, then ask them to run their own day and send feedback here.</p><p>Only voluntary feedback appears below. Their goals, daily records and conversations remain private.</p></aside>
    </div>
    <section className="panel pilot-section"><h2>Reserved accounts</h2>
      {cohort.invitations.length ? <ul className="pilot-list">{cohort.invitations.map(item => <li key={item.id}><strong>{item.email}</strong><span>{item.status}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('en-US',{dateStyle:'medium'})}</time></li>)}</ul> : <p>No addresses reserved yet.</p>}
    </section>
    <section className="panel pilot-section"><h2>Member feedback</h2>
      {cohort.feedback.length ? <ul className="pilot-list">{cohort.feedback.map(item => <li key={item.id}><div><span className="eyebrow">{item.category} · {cohort.invitations.find(invitation => invitation.person_id === item.person_id)?.email ?? 'Member'}</span><p>{item.message}</p></div><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('en-US',{dateStyle:'medium'})}</time></li>)}</ul> : <p>No feedback submitted yet.</p>}
    </section>
  </>;
}

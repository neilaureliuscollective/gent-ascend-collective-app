import Link from 'next/link';
import { ongoingOverview } from '@/domains/workspace/overview';
import { OngoingActions } from '@/components/workspace/ongoing-actions';
export const metadata = { title: 'Ongoing' };
export default async function Ongoing() {
  const { daily, goals, projects } = await ongoingOverview();
  return <div className="intelligence-overview">
    <header><p className="eyebrow">AETHELIOS / ONGOING</p><h1>Carry it forward.</h1><p>Your saved actions, goals and creative projects. Open the source to continue.</p></header>
    <section><h2>Actions</h2>{daily.status === 'ready' ? <OngoingActions daily={daily.data} /> : <p role="status">{daily.status === 'locked' ? 'Sign in to see your saved actions.' : 'Actions are unavailable. Reload to try again.'}</p>}<Link href="/app/daily">Plan or review your day →</Link></section>
    <section><h2>Goals</h2>{goals.status === 'ready' ? <><p className="muted">Up to 100 saved goals; active goals shown here.</p><ul className="intelligence-records">{goals.data.filter(goal => goal.status === 'active').map(goal => <li key={goal.id}><Link href="/app/goals">{goal.title} →</Link><p>{goal.next_step}</p>{goal.target_date && <time>{goal.target_date}</time>}</li>)}</ul>{!goals.data.some(goal => goal.status === 'active') && <p>No active goal saved.</p>}</> : <p role="status">Goals {goals.status === 'locked' ? 'require sign-in.' : 'are unavailable.'}</p>}<Link href="/app/goals">Manage goals →</Link></section>
    <section><h2>Projects</h2>{projects.status === 'ready' ? <><p className="muted">Up to 100 recent Studio projects.</p><ul className="intelligence-records">{projects.data.map(project => <li key={project.id}><Link href={`/app/studio?project=${project.id}`}>{project.title} →</Link><small>Studio · {project.creative_type}</small><time dateTime={project.updated_at}>{project.updated_at.slice(0,10)}</time></li>)}</ul>{!projects.data.length && <p>No creative projects saved yet.</p>}</> : <p role="status">Projects are unavailable or Studio access is not enabled. Check your account or reopen Studio.</p>}<Link href="/app/studio">Open Studio →</Link></section>
  </div>;
}

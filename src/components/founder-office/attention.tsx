import Link from 'next/link';
// Keep this read-only view independent of server services and personal account fields.
export type AttentionMission = {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  status: string;
  approvals: { id: string; title: string; status: string }[];
  readiness: { state: string }[];
  gaps: string[];
};

/** A read-only index of the current saved company snapshot, never an execution queue. */
export function FounderAttention({ data }: { data: { missions: AttentionMission[] } }) {
  const pending = data.missions.flatMap((mission) =>
    mission.approvals.filter((item) => item.status === 'pending').map((item) => ({
      id: `${mission.id}:${item.id}`,
      title: item.title,
      detail: mission.companyName,
      href: `/app/companies/${mission.companyId}/work/${mission.id}`,
    })),
  );
  const ready = data.missions.filter((mission) =>
    mission.status === 'prepared' ||
    mission.readiness.some((task) => task.state === 'ready'),
  );
  const waiting = data.missions.filter((mission) =>
    mission.status === 'approved_awaiting_executor' ||
    mission.gaps.length > 0 ||
    mission.readiness.some((task) => task.state === 'blocked'),
  );
  const review = data.missions.filter((mission) =>
    mission.status === 'needs_review' ||
    mission.status === 'interrupted' ||
    mission.status === 'history_unavailable' ||
    mission.readiness.some((task) => task.state === 'needs_review' || task.state === 'invalid_plan'),
  );
  const missionItems = (missions: typeof data.missions) => missions.map((mission) => ({
    id: mission.id,
    title: mission.title,
    detail: `${mission.companyName} · ${mission.status.replaceAll('_', ' ')}`,
    href: `/app/companies/${mission.companyId}/work/${mission.id}`,
  }));
  const groups = [
    { title: 'Decisions to review', items: pending, empty: 'No pending company approval requests in this snapshot.' },
    { title: 'Work to advance', items: missionItems(ready), empty: 'No prepared missions or ready assigned tasks recorded.' },
    { title: 'Input & dependencies', items: missionItems(waiting), empty: 'No recorded evidence gaps or blocked dependencies.' },
    { title: 'Mission review', items: missionItems(review), empty: 'No drafts awaiting review or interrupted work recorded.' },
  ];
  return (
    <section className="founder-attention" aria-labelledby="founder-briefing-title">
      <header>
        <div>
          <p className="eyebrow">Your saved company snapshot</p>
          <h2 id="founder-briefing-title">What needs your attention?</h2>
        </div>
        <a className="secondary-button" href="#founder-command-title">Prepare work ↓</a>
      </header>
      <p className="founder-attention-note">
        Latest {data.missions.length} saved company missions. Groups may overlap. Review each
        mission before advancing it; external actions retain their approval requirements.
      </p>
      <div className="founder-attention-grid">
        {groups.map((group) => (
          <section className="founder-attention-group" key={group.title} aria-label={group.title}>
            <h3>{group.title}<span>{group.items.length}</span></h3>
            {group.items.length ? (
              <ul>
                {group.items.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href}><span>{item.title}</span><small>{item.detail}</small></Link>
                  </li>
                ))}
              </ul>
            ) : <p>{group.empty}</p>}
            {group.items.length > 3 && <a href="#founder-attention">View all saved missions ↓</a>}
          </section>
        ))}
      </div>
    </section>
  );
}

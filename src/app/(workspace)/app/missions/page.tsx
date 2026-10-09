import Link from 'next/link';
import '@/components/aurelius/talk.css';
import { z } from 'zod';
import { readMissions, missionParticipants } from '@/domains/missions/service';
import { MissionWorkspace } from '@/components/missions/mission-workspace';
export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (id && !z.uuid().safeParse(id).success)
    return (
      <p>
        Invalid Mission link. <Link href="/app/missions">Open Missions</Link>
      </p>
    );
  let missions;
  try {
    missions = await readMissions();
  } catch {
    return (
      <section>
        <h1>Missions</h1><Link href="/app/missions/deliverables">Saved deliverables ↗</Link>
        <p>Missions could not be loaded. Your saved conversations remain in Talk.</p>
        <Link href="/app/aethelios">Return to Aethelios ↗</Link>
      </section>
    );
  }
  const selected = missions.find((m) => m.id === id);
  if (id && !selected)
    return (
      <p>
        Mission not found in this account. <Link href="/app/missions">Open Missions</Link>
      </p>
    );
  if (selected) {
    let participants;
    try {
      participants = await missionParticipants(selected.conversation_id);
    } catch {
      return <p>Contributor receipts could not be loaded. Reload before continuing.</p>;
    }
    return (
      <>
        <Link href="/app/missions">← Missions</Link>
        <MissionWorkspace
          key={`${selected.id}:${selected.revision}`}
          initial={selected}
          participants={participants}
        />
      </>
    );
  }
  return (
    <section className="mission-list">
      <p className="eyebrow">Aethelios · Ongoing work</p>
      <h1>Missions</h1><Link href="/app/missions/deliverables">Saved deliverables ↗</Link>
      <p>Meaningful conversations with an objective and a next move. Your work stays with you.</p>
      <Link className="button" href="/app/aethelios">
        Start with Aethelios ↗
      </Link>
      {missions.length === 0 ? (
        <p>
          Start a conversation about something you want to accomplish. When there’s work worth
          continuing, choose Save as Mission in Talk.
        </p>
      ) : (
        <div>
          {missions.map((m) => (
            <article key={m.id}>
              <Link href={`/app/missions?id=${m.id}`}>
                <h2>{m.title}</h2>
              </Link>
              <p>{m.objective}</p>
              <span className="eyebrow">{m.status.replace('_', ' ')}</span>
              <p>{m.next_actions || 'Choose the next action when you resume.'}</p>
              <Link href={`/app/aethelios?conversation=${m.conversation_id}`}>
                Resume conversation ↗
              </Link>
            </article>
          ))}
        </div>
      )}
      <p>
        Conversation outputs remain in Library inside Talk. Missions are private records; no
        background agent runs here.
      </p>
      <Link href="/app/ongoing">Your other ongoing work ↗</Link>
    </section>
  );
}

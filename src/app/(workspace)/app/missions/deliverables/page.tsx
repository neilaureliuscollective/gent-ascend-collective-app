import Link from 'next/link';
import { z } from 'zod';
import '@/components/aurelius/talk.css';
import { readDeliverable, readDeliverables } from '@/domains/missions/deliverables';
import { DeliverableWorkspace } from '@/components/missions/deliverable-workspace';
export const metadata = { title: 'Saved deliverables' };
export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (id && !z.uuid().safeParse(id).success)
    return (
      <p>
        Invalid deliverable link. <Link href="/app/missions/deliverables">Saved deliverables</Link>
      </p>
    );
  let selected: Awaited<ReturnType<typeof readDeliverable>> | null = null;
  let docs: Awaited<ReturnType<typeof readDeliverables>> = [];
  try {
    if (id) selected = await readDeliverable(id);
    else docs = await readDeliverables();
  } catch {
    return (
      <section>
        <h1>Saved work unavailable</h1>
        <p>Check your account and reload. No saved work has been changed.</p>
        <Link href="/app/missions">Return to Missions</Link>
      </section>
    );
  }
  if (selected) return <DeliverableWorkspace key={id} initial={selected} />;
  return (
    <section className="mission-list">
      <Link href="/app/missions">← Missions</Link>
      <h1>Saved deliverables</h1>
      <p>Work products from your Missions, with saved versions and your review notes.</p>
      {!docs.length && <p>Open a Mission and choose “Create deliverable” on a saved reply.</p>}
      {docs.map((d) => (
        <article key={d.id}>
          <Link href={`/app/missions/deliverables?id=${d.id}`}>
            {d.title} · saved {new Date(d.created_at).toLocaleDateString('en-US')} ↗
          </Link>
          <p>
            Version {d.revision} · {d.reviewed ? 'Reviewed by you' : 'Draft'} ·{' '}
            {d.mission_id ? 'Linked to a Mission' : 'Retained after Mission removal'}
          </p>
        </article>
      ))}
    </section>
  );
}

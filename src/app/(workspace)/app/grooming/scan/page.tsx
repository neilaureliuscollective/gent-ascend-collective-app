import Link from 'next/link';
import { GuidedScan } from '@/components/grooming/guided-scan';
import { scanWorkspace } from '@/domains/grooming/scan';
import { currentPerson } from '@/domains/person/current';
import { deleteScanAction } from './actions';
import '../grooming.css';
export const metadata = { title: 'Ascend Mirror | Gent Ascend' };
export default async function Scan({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const person = await currentPerson();
  if (!person)
    return (
      <main className="grooming">
        <h1>Sign in for Ascend Scan.</h1>
        <Link href="/enter">Sign in →</Link>
      </main>
    );
  const [data, params] = await Promise.all([scanWorkspace(), searchParams]);
  return (
    <main className="grooming mirror-page">
      <Link className="mirror-back" href="/app/presence">
        ← Presence
      </Link>
      <GuidedScan />
      {params.result && (
        <p role="status" className="groom-notice">
          {params.result === 'error'
            ? 'The scan could not be deleted.'
            : params.result === 'saved'
              ? 'Assessment saved.'
              : 'Scan removed.'}
        </p>
      )}
      <section className="groom-section" id="history">
        <p className="eyebrow">Your private history</p>
        <h2 id="scan-history-title" tabIndex={-1}>
          Your scan history.
        </h2>
        {data.scans.map((s) => (
          <article className="groom-panel groom-wide" key={s.id}>
            <small>
              {new Date(s.created_at).toLocaleDateString()} · {s.status}
            </small>
            <h3>
              {s.status === 'complete'
                ? s.summary
                : s.status === 'rejected'
                  ? 'Retake recommended'
                  : 'Assessment interrupted'}
            </h3>
            <p>{s.quality_note}</p>
            {data.observations
              .filter((o) => o.scan_id === s.id)
              .map((o) => (
                <p key={o.id}>
                  <strong>
                    {o.area} · {o.confidence} confidence
                  </strong>{' '}
                  — {o.description}
                </p>
              ))}
            {s.next_step && (
              <p>
                <strong>Next move:</strong> {s.next_step}
              </p>
            )}
            <Link href="/app/aethelios?starter=grooming-scan">Discuss this with Aethelios →</Link>
            <form action={deleteScanAction}>
              <input type="hidden" name="id" value={s.id} />
              <button className="secondary-button">Delete scan and photos</button>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}

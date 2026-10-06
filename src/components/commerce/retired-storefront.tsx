import Link from 'next/link';
import { legacyReserveDestination } from '@/platform/ecosystem';
export function RetiredStorefront() {
  const destination = legacyReserveDestination(process.env.LEGACY_RESERVE_PUBLIC_URL);
  return (
    <section className="panel" style={{ maxWidth: 720, margin: '40px auto', padding: 32 }}>
      <span className="eyebrow">LEGACY RESERVE</span>
      <h1>A separate destination.</h1>
      <p>
        Aethelios helps you build and operate companies. Legacy Reserve products and physical
        experiences belong in Legacy Reserve.
      </p>
      {destination ? (
        <a className="button" href={destination} target="_blank" rel="noopener noreferrer">
          Visit Legacy Reserve ↗
        </a>
      ) : (
        <p>The Legacy Reserve destination will be linked here when it is ready.</p>
      )}
      <p>
        <Link href="/app/aethelios">Open Aethelios ↗</Link>
      </p>
      <p>
        <Link href="/app/collection/orders">Earlier order history</Link> ·{' '}
        <Link href="/app/collection/cabinet">Saved product records</Link>
      </p>
    </section>
  );
}

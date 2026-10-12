import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentIdentity } from '@/domains/identity/current';
import { currentFounderAccess } from '@/domains/access/founder';
import { readFounderOffice } from '@/domains/founder-office/service';
import { FounderOffice } from '@/components/founder-office/office';
import { IntelligenceError } from '@/domains/intelligence/service';
import '../work/work.css';
import './office.css';
export const metadata = { title: 'Founder Office · Aethelios' };
export default async function FounderOfficePage() {
  if (!(await currentIdentity()))
    return (
      <section className="panel">
        <h1>Founder Office</h1>
        <p>Sign in with your authorized founder account.</p>
        <Link href="/enter">Sign in ↗</Link>
      </section>
    );
  if (!(await currentFounderAccess())) notFound();
  let initial: Awaited<ReturnType<typeof readFounderOffice>> | undefined;
  let message = 'Founder access or records could not be verified. Please reload.';
  try {
    initial = await readFounderOffice();
  } catch (error) {
    if (error instanceof IntelligenceError) message = error.message;
  }
  if (initial) return <FounderOffice key={initial.ownerId} initial={initial} />;
  return (
    <section className="panel">
      <h1>Founder records unavailable</h1>
      <p>{message}</p>
      <Link href="/app/work">Open existing company work ↗</Link>
    </section>
  );
}

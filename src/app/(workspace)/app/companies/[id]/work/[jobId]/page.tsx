import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { readWork } from '@/domains/company-work/service';
import { readCompanyTalk } from '@/domains/companies/service';
import { IntelligenceError } from '@/domains/intelligence/service';
import { CompanyRoom } from '@/components/companies/company-room';
import '../../../../work/work.css';
export const metadata = { title: 'Company work' };
export default async function CompanyWorkPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id, jobId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(jobId).success) notFound();
  let work: Awaited<ReturnType<typeof readWork>> | undefined;
  let initial: Awaited<ReturnType<typeof readCompanyTalk>> | undefined;
  let message = '';
  try {
    work = await readWork(id, jobId);
    initial = await readCompanyTalk(id, work.job.conversation_id);
  } catch (error) {
    if (error instanceof IntelligenceError && error.status === 404) notFound();
    message = error instanceof IntelligenceError ? error.message : 'Please try again later.';
  }
  if (!work || !initial)
    return (
      <section className="company-work">
        <h1>Company work unavailable</h1>
        <p>{message}</p>
        <Link href={`/app/companies/${id}`}>Return to company room</Link>
      </section>
    );
  return (
    <CompanyRoom
      key={jobId}
      initial={initial}
      initialConversation={work.job.conversation_id}
      initialWork={work}
    />
  );
}

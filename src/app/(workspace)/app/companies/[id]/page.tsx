import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { workForConversation, readWork } from '@/domains/company-work/service';
import { readCompanyTalk } from '@/domains/companies/service';
import { IntelligenceError } from '@/domains/intelligence/service';
import { CompanyRoom } from '@/components/companies/company-room';
import '../../work/work.css';
export const metadata = { title: 'Company room' };
export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { id } = await params;
  const { conversation } = await searchParams;
  if (
    !z.uuid().safeParse(id).success ||
    (conversation && !z.uuid().safeParse(conversation).success)
  )
    notFound();
  let initial: Awaited<ReturnType<typeof readCompanyTalk>> | undefined;
  let message = '';
  let work: Awaited<ReturnType<typeof readWork>> | undefined;
  try {
    initial = await readCompanyTalk(id, conversation);
    if (conversation) work = (await workForConversation(id, conversation)) ?? undefined;
  } catch (error) {
    if (error instanceof IntelligenceError && error.status === 404) notFound();
    message = error instanceof IntelligenceError ? error.message : 'Please try again later.';
  }
  if (!initial)
    return (
      <section className="company-work">
        <h1>Company room unavailable</h1>
        <p>{message}</p>
        <Link href="/app/work">Return to company work ↗</Link>
      </section>
    );
  return (
    <CompanyRoom
      key={`${id}:${conversation ?? ''}`}
      initial={initial}
      initialConversation={conversation}
      initialWork={work}
    />
  );
}

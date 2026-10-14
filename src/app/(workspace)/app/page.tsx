import { currentIdentity } from '@/domains/identity/current';
import { currentFounderAccess } from '@/domains/access/founder';
import { IntelligenceError } from '@/domains/intelligence/service';
import { readCommandHome } from '@/domains/command-home/service';
import { CommandHome } from '@/components/command-home/workspace';
import './command-home.css';

export const metadata = { title: 'Command' };

export default async function CommandPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [identity, founderOffice, params] = await Promise.all([
    currentIdentity(),
    currentFounderAccess().catch(() => false),
    searchParams,
  ]);
  if (!identity) {
    return <CommandHome signedOut founderOffice={false} />;
  }
  let initial;
  let message: string | undefined;
  try {
    initial = await readCommandHome(params.focus);
  } catch (error) {
    if (error instanceof IntelligenceError && error.status === 401) {
      return <CommandHome signedOut founderOffice={false} />;
    }
    message =
      error instanceof IntelligenceError
        ? error.message
        : 'Command could not load your saved work.';
  }
  return <CommandHome founderOffice={founderOffice} initial={initial} message={message} />;
}

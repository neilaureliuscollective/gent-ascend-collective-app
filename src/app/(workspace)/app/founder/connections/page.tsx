import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentIdentity } from '@/domains/identity/current';
import { currentFounderAccess } from '@/domains/access/founder';
import { readConnectionsBoard } from '@/domains/connections/service';
import { ConnectionsWorkspace } from '@/components/connections/workspace';
import { ConnectionError } from '@/domains/connections/errors';
import '../../work/work.css';
import '../office.css';
import './connections.css';

export const metadata = { title: 'Connections · Aethelios' };
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!(await currentIdentity()))
    return (
      <section className="panel">
        <h1>Connections</h1>
        <p>Sign in with your authorized founder account.</p>
        <Link href="/enter">Sign in ↗</Link>
      </section>
    );
  if (!(await currentFounderAccess())) notFound();
  const params = await searchParams;
  let board: Awaited<ReturnType<typeof readConnectionsBoard>> | undefined;
  let message = 'Connection records could not be verified. Please reload.';
  try {
    board = await readConnectionsBoard();
  } catch (error) {
    if (error instanceof ConnectionError) message = error.message;
  }
  if (!board)
    return (
      <section className="panel">
        <h1>Connections unavailable</h1>
        <p>{message}</p>
        <Link href="/app/founder">Open Founder Office ↗</Link>
      </section>
    );
  const notice =
    params.github === 'failed' || params.vercel === 'failed'
      ? 'Authorization did not complete. Nothing was marked connected.'
      : params.github === 'select' || params.vercel === 'select'
        ? 'Authorization succeeded. Select the exact repository or project to verify access.'
        : params.github === 'connected' || params.vercel === 'connected'
          ? 'Access was verified against the provider. Connecting does not start Architect or any AI operation.'
          : undefined;
  return <ConnectionsWorkspace initial={board} notice={notice} />;
}

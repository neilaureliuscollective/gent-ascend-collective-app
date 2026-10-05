import { MemberContinuity } from '@/components/member-continuity';
import { readContinuity } from '@/domains/continuity/service';
import { Suspense } from 'react';
import { DailyDashboard } from '@/components/dashboard/daily-dashboard';
import { readCommand } from '@/domains/command/service';
import { readCommand as readDailyCommand } from '@/domains/daily-command/service';
import { readProactiveReceipts } from '@/domains/intelligence/proactive-receipts';
export default async function Command() {
  const [snapshot, dailyCommand, proactiveReceipts] = await Promise.all([
    readCommand(),
    readDailyCommand().catch(() => null),
    readProactiveReceipts().catch(() => []),
  ]);
  return (
    <>
      <DailyDashboard
        initial={snapshot.data}
        opening={snapshot.opening}
        asOf={snapshot.asOf}
        dailyCommand={dailyCommand}
        handledProactiveKeys={proactiveReceipts.map((receipt) => receipt.signal_key)}
      />
      <Suspense fallback={null}>
        <Continuation />
      </Suspense>
    </>
  );
}

async function Continuation() {
  const data = await readContinuity().catch(() => null);
  return data ? <MemberContinuity data={data} compact /> : null;
}

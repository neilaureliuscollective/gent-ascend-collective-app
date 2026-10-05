import { MemberContinuity } from '@/components/member-continuity';
import { readContinuity } from '@/domains/continuity/service';
import { Suspense } from 'react';
import { DailyDashboard } from '@/components/dashboard/daily-dashboard';
import { readCommand } from '@/domains/command/service';
import { readCommand as readDailyCommand } from '@/domains/daily-command/service';
import { readPresence } from '@/domains/presence/service';
export default async function Command() {
  const [snapshot, dailyCommand, presence] = await Promise.all([
    readCommand(),
    readDailyCommand().catch(() => null),
    readPresence().catch(() => null),
  ]);
  return (
    <>
      <DailyDashboard
        initial={snapshot.data}
        opening={snapshot.opening}
        asOf={snapshot.asOf}
        dailyCommand={dailyCommand}
        presence={presence}
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

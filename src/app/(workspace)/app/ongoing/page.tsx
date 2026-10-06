import Link from 'next/link';
import { MemberContinuity } from '@/components/member-continuity';
import { readContinuity } from '@/domains/continuity/service';
import { Suspense } from 'react';
import { DailyDashboard } from '@/components/dashboard/daily-dashboard';
import { readCommand } from '@/domains/command/service';
import { readCommand as readDailyCommand } from '@/domains/daily-command/service';
import { readProactiveReceipts } from '@/domains/intelligence/proactive-receipts';
import { readGoals } from '@/domains/goals/service';
export default async function Command() {
  const [snapshot, dailyCommand, proactiveReceipts, goals] = await Promise.all([
    readCommand(),
    readDailyCommand().catch(() => null),
    readProactiveReceipts().catch(() => []),
    readGoals().catch(() => null),
  ]);
  const activeGoal = goals?.find((goal) => goal.status === 'active') ?? null;
  return (
    <>
      <p>
        <Link href="/app/missions">Resume your Missions ↗</Link> · Meaningful work, saved direction
        and next actions.
      </p>
      <DailyDashboard
        initial={snapshot.data}
        opening={snapshot.opening}
        asOf={snapshot.asOf}
        dailyCommand={dailyCommand}
        handledProactiveKeys={proactiveReceipts.map((receipt) => receipt.signal_key)}
        activeGoal={
          activeGoal
            ? {
                id: activeGoal.id,
                title: activeGoal.title,
                targetDate: activeGoal.target_date,
                nextStep: activeGoal.next_step,
                today: snapshot.data.today,
              }
            : null
        }
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

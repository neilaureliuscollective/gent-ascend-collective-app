import { DailyDashboard } from '@/components/dashboard/daily-dashboard';
import { DailyCommandWorkspace } from '@/components/daily-command/workspace';
import { readDaily } from '@/domains/daily/service';
import { readCommand } from '@/domains/daily-command/service';
export default async function Command() {
  const command = await readCommand().catch(() => null);
  if (command?.mode === 'personal') return <DailyCommandWorkspace initial={command} />;
  if (!command)
    return (
      <DailyCommandWorkspace
        initial={{
          mode: 'personal',
          snapshot: null,
          arrival: {
            sleepMinutes: null,
            energy: null,
            soreness: null,
            bandwidth: null,
            minutes: null,
          },
          record: null,
          yesterday: null,
          error: 'Your command could not connect. Refresh when you are online.',
        }}
      />
    );
  return <DailyDashboard initial={await readDaily()} />;
}

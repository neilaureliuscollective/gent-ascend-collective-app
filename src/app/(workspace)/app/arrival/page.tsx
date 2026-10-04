import { DailyCommandWorkspace } from '@/components/daily-command/workspace';
import { readCommand } from '@/domains/daily-command/service';
export default async function Arrival() {
  return <DailyCommandWorkspace initial={await readCommand()} />;
}

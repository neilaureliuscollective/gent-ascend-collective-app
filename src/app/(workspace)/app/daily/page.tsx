import { DailyDashboard } from '@/components/dashboard/daily-dashboard';
import { readDaily } from '@/domains/daily/service';
export default async function Command() {
  return <DailyDashboard initial={await readDaily()} />;
}

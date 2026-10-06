'use client';
import { useRouter } from 'next/navigation';
import { TodayActions } from '@/components/aurelius/today-actions';
import type { DailyData } from '@/domains/daily/model';
export function OngoingActions({ daily }: { daily: DailyData }) {
  const router = useRouter();
  const today = daily.entries.find(entry => entry.day === daily.today);
  const brief = { asOf: new Date().toISOString(), day: daily.today, version: today?.version ?? 0, intention: today?.intention ?? '', actions: today?.actions ?? [], openCaptures: daily.openCaptures ?? 0, previousReview: null };
  return <><TodayActions key={`${daily.today}-${today?.version ?? 0}`} brief={brief} disabled={false} onChanged={async () => router.refresh()} /><p className="muted">Today’s saved actions are separate from goals and project status. Earlier daily records remain in your day history.</p></>;
}

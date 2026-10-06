import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { readGoals } from '@/domains/goals/service';
import { readDaily } from '@/domains/daily/service';
import { studioSession } from '@/domains/studio/service';
import { intelligenceSession } from '@/domains/intelligence/service';
import type { Conversation, Memory } from '@/domains/intelligence/types';
export type OverviewResult<T> = { status: 'ready'; data: T } | { status: 'unavailable' | 'locked'; data: null };
async function safely<T>(read: () => Promise<T | null>): Promise<OverviewResult<T>> {
  try { const data = await read(); return data === null ? { status: 'locked', data: null } : { status: 'ready', data }; }
  catch { return { status: 'unavailable', data: null }; }
}
export async function projectSummaries() {
  const { client, person } = await studioSession();
  const result = await client.from('ai_studio_projects').select('id,title,updated_at,creative_type').eq('person_id', person.id).order('updated_at', { ascending: false }).limit(100);
  if (result.error) throw new Error('Projects unavailable');
  return result.data ?? [];
}
export async function ongoingOverview() {
  const [daily, goals, projects] = await Promise.all([
    safely(async () => { const context = await authorizedPerson('daily.read'); return context ? readDaily(context) : null; }),
    safely(readGoals), safely(projectSummaries),
  ]);
  return { daily, goals, projects };
}
export async function libraryOverview() {
  const [conversations, memories, projects] = await Promise.all([
    safely(async () => { const { client, person } = await intelligenceSession(); const result = await client.from('ai_conversations').select('*').eq('person_id', person.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(40); if (result.error) throw new Error('History unavailable'); return result.data as Conversation[]; }),
    safely(async () => { const { client, person } = await intelligenceSession(); const result = await client.from('ai_memories').select('*').eq('person_id', person.id).order('confirmed_at', { ascending: false }).limit(24); if (result.error) throw new Error('Memory unavailable'); return result.data as Memory[]; }),
    safely(projectSummaries),
  ]);
  return { conversations, memories, projects };
}

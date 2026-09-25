import { z } from 'zod';
import { authorizedPerson } from '@/domains/access/authorize';
import { localDay, emptyDay } from '@/domains/daily/model';
import { saveDaily } from '@/domains/daily/service';
import { mutationBody } from '@/domains/intelligence/http';

// A narrow typed action: only a confirmed capture can become today's action.
const inputSchema = z.object({ captureId: z.uuid(), action: z.literal('create_today_action'), title: z.string().trim().min(1).max(100) }).strict();
export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await mutationBody(request));
    const owner = await authorizedPerson('daily.write');
    if (!owner) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const capture = await owner.client.from('life_captures').select('*').eq('id', input.captureId).eq('person_id', owner.person.id).single();
    if (capture.error || !capture.data) return Response.json({ error: 'Capture not found.' }, { status: 404 });
    const today = localDay(new Date(), owner.person.timezone);
    const entry = await owner.client.from('daily_entries').select('day,timezone,energy,sleep_minutes,intention,reflection,version,updated_at,actions:daily_actions(id,title,done,position)')
      .eq('person_id', owner.person.id).eq('day', today).maybeSingle();
    if (entry.error) throw new Error('Daily record unavailable');
    const current = entry.data ?? emptyDay(today, owner.person.timezone);
    if (current.actions.some((action) => action.id === input.captureId))
      return Response.json({ saved: true, alreadyApplied: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    if (current.actions.length >= 5) return Response.json({ error: 'Today already has five actions.' }, { status: 409 });
    await saveDaily({
      day: today, version: current.version, energy: current.energy, sleep_minutes: current.sleep_minutes,
      intention: current.intention, reflection: current.reflection,
      actions: [...current.actions.map(({ id, title, done }) => ({id,title,done})),
        { id: input.captureId, title: input.title, done: false }],
    });
    const updated = await owner.client.from('life_captures').update({ status: 'acted', updated_at: new Date().toISOString() })
      .eq('id', input.captureId).eq('person_id', owner.person.id);
    return Response.json({ saved: true, captureStatus: updated.error ? 'inbox' : 'acted' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Action was not confirmed. Reload Command to check its saved state before retrying.' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

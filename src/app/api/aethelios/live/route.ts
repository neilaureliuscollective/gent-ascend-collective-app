import { IntelligenceError } from '@/domains/intelligence/service';
import { after } from 'next/server';
import { mutationBody, privateJson, apiError } from '@/domains/intelligence/http';
import { liveAdmission, liveEnd, liveReview } from '@/domains/live/contract';
import { intelligenceSession } from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { z } from 'zod';
import { admitLive, endLive } from '@/domains/live/service';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const parsed = liveAdmission.safeParse(await mutationBody(request));
    if (!parsed.success) throw new IntelligenceError('Invalid voice admission request.');
    const input = parsed.data;
    const session = await admitLive(input);
    after(session.monitor);
    return privateJson({
      answer: session.answer,
      expiresAt: session.expiresAt,
      model: session.model,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const parsed = liveEnd.safeParse(await mutationBody(request));
    if (!parsed.success) throw new IntelligenceError('Invalid voice cleanup request.');
    const input = parsed.data;
    await endLive(input.sessionId);
    return privateJson({ ended: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const id = z.uuid().parse(new URL(request.url).searchParams.get('sessionId'));
    const { client, person } = await intelligenceSession();
    const jobs = await client
      .from('ai_live_jobs')
      .select('id,task,coworker,status,result,duration_ms')
      .eq('session_id', id)
      .eq('person_id', person.id)
      .order('created_at');
    if (jobs.error) throw new IntelligenceError('Background work status unavailable.', 503);
    return privateJson({ jobs: jobs.data });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const parsed = liveReview.safeParse(await mutationBody(request, 1024));
    if (!parsed.success) throw new IntelligenceError('Invalid background work review.');
    const { client, person } = await intelligenceSession();
    if (!(await currentAccess()).has('voice.use'))
      throw new IntelligenceError('Voice access unavailable.', 403);
    const job = await client
      .from('ai_live_jobs')
      .select('id')
      .eq('id', parsed.data.jobId)
      .eq('session_id', parsed.data.sessionId)
      .eq('person_id', person.id)
      .maybeSingle();
    if (job.error || !job.data) throw new IntelligenceError('Background request unavailable.', 404);
    const reviewed = await client.rpc('ai_live_review_job', {
      p_id: parsed.data.jobId,
      p_approve: parsed.data.approve,
    });
    if (reviewed.error || !reviewed.data)
      throw new IntelligenceError('Background review was not confirmed.', 409);
    return privateJson({ reviewed: true });
  } catch (error) {
    return apiError(error);
  }
}

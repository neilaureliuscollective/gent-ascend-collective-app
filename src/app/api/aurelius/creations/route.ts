import { after } from 'next/server';
import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { artifactReview } from '@/domains/artifacts/contract';
import {
  handoffInput,
  importOriginInput,
  saveCreationInput,
  selectCreationInput,
} from '@/domains/talk-creation/schema';
import {
  importArchitectHandoff,
  prepareArchitectHandoff,
  proposeTalkImage,
  readCreationLineage,
  readTalkCreations,
  reviewArchitectImport,
  reviewTalkImage,
  saveTalkCreation,
  selectTalkCreation,
} from '@/domains/talk-creation/service';
import { imageProposal } from '@/domains/artifacts/contract';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const lineage = params.get('lineage');
    if (lineage) {
      if (!z.uuid().safeParse(lineage).success) throw new IntelligenceError('Invalid lineage.');
      return privateJson({ versions: await readCreationLineage(lineage) });
    }
    const handoff = params.get('handoff');
    if (handoff) {
      if (!z.uuid().safeParse(handoff).success) throw new IntelligenceError('Invalid package.');
      return privateJson(await reviewArchitectImport(handoff));
    }
    const id = z.uuid().safeParse(params.get('conversationId'));
    if (!id.success) throw new IntelligenceError('Invalid conversation.');
    return privateJson(await readTalkCreations(id.data));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await mutationBody(request, 24000);
    if (importOriginInput.safeParse(body).success)
      return privateJson(await importArchitectHandoff(body), 201);
    if (handoffInput.safeParse(body).success)
      return privateJson(await prepareArchitectHandoff(body), 201);
    if (imageProposal.safeParse(body).success)
      return privateJson(await proposeTalkImage(body), 201);
    if (!saveCreationInput.safeParse(body).success)
      throw new IntelligenceError('Check the brief, plan, palette or image request.');
    return privateJson(await saveTalkCreation(body), 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await mutationBody(request, 2048);
    const review = artifactReview.safeParse(body);
    if (review.success) {
      const job = await reviewTalkImage(review.data.id, review.data.approve);
      if (job.run) after(job.run);
      return privateJson({ approved: review.data.approve, reserved: review.data.approve });
    }
    if (!selectCreationInput.safeParse(body).success)
      throw new IntelligenceError('Choose saved work to keep.');
    await selectTalkCreation(body);
    return privateJson({ selected: true });
  } catch (error) {
    return apiError(error);
  }
}

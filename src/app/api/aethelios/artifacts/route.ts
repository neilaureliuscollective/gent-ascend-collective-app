import { coworkerProposal } from '@/domains/artifacts/coworker';
import { after } from 'next/server';
import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import {
  artifactReview,
  artifactSelection,
  artifactScenario,
  visualProposal,
} from '@/domains/artifacts/contract';
import {
  proposeImage,
  proposeCoworker,
  proposeVisual,
  readArtifacts,
  reviewArtifact,
  selectArtifact,
  selectScenario,
} from '@/domains/artifacts/service';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const id = z.uuid().safeParse(new URL(request.url).searchParams.get('conversationId'));
    if (!id.success) throw new IntelligenceError('Invalid conversation.');
    return privateJson(await readArtifacts(id.data));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request, 16000);
    return privateJson(
      await (coworkerProposal.safeParse(body).success
        ? proposeCoworker(body)
        : visualProposal.safeParse(body).success
          ? proposeVisual(body)
          : proposeImage(body)),
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const body = await mutationBody(request, 1024);
    const scenario = artifactScenario.safeParse(body);
    if (scenario.success) {
      await selectScenario(
        scenario.data.conversationId,
        scenario.data.artifactId,
        scenario.data.scenarioPercent,
      );
      return privateJson({ selected: true });
    }
    const selected = artifactSelection.safeParse(body);
    if (selected.success) {
      await selectArtifact(
        selected.data.conversationId,
        selected.data.artifactId,
        selected.data.partId,
      );
      return privateJson({ selected: true });
    }
    const input = artifactReview.safeParse(body);
    if (!input.success) throw new IntelligenceError('Review the image request and cost consent.');
    const job = await reviewArtifact(input.data.id, input.data.approve);
    if (job.run) after(job.run);
    return privateJson({ approved: input.data.approve, reserved: input.data.approve });
  } catch (error) {
    return apiError(error);
  }
}

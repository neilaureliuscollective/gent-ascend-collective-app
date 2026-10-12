import { expect, it } from 'vitest';
import {
  artifactReview,
  imageProposal,
  canEditArtifact,
  type Artifact,
} from '@/domains/artifacts/contract';
it('requires paid-operation consent and prevents caller-selected edit version or owner', () => {
  const input = {
    id: crypto.randomUUID(),
    conversationId: crypto.randomUUID(),
    operation: 'image.edit',
    prompt: 'Taller buildings',
  };
  expect(imageProposal.safeParse(input).success).toBe(true);
  expect(imageProposal.safeParse({ ...input, baseVersionId: crypto.randomUUID() }).success).toBe(
    false,
  );
  expect(imageProposal.safeParse({ ...input, personId: crypto.randomUUID() }).success).toBe(false);
  expect(artifactReview.safeParse({ id: input.id, approve: true }).success).toBe(false);
});
it('only offers revision for a completed backed image', () => {
  const image = {
    status: 'running',
    project_id: crypto.randomUUID(),
    version_id: crypto.randomUUID(),
  } as Artifact;
  expect(canEditArtifact(image)).toBe(false);
  expect(canEditArtifact({ ...image, status: 'complete' })).toBe(true);
});

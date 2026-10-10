import { z } from 'zod';
export const buildCommand = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('queue'), id: z.uuid(), projectId: z.uuid(), versionId: z.uuid() })
    .strict(),
  z.object({ action: z.literal('resume'), id: z.uuid() }).strict(),
]);
export type Build = {
  id: string;
  person_id: string;
  project_id: string;
  version_id: string;
  template: 'service-business-export-v1';
  status: 'queued' | 'running' | 'ready';
  lease: string | null;
  lease_until: string | null;
  attempts: number;
  html: string | null;
  sha256: string | null;
  checks: ReturnType<typeof import('./artifact').checkArtifact> | null;
  created_at: string;
  finished_at: string | null;
};
export type BuildSummary = Omit<Build, 'html' | 'person_id' | 'lease'>;

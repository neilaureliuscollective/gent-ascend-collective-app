import { z } from 'zod';
export const releaseCommand = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('approve'),
      id: z.uuid(),
      buildId: z.uuid(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      consent: z.literal(true),
    })
    .strict(),
  z.object({ action: z.literal('revoke'), id: z.uuid() }).strict(),
]);
export type WebsiteRelease = {
  id: string;
  person_id: string;
  project_id: string;
  version_id: string;
  build_id: string;
  revision: number;
  sha256: string;
  approved_at: string;
  revoked_at: string | null;
};

import { z } from 'zod';
export const imageRefSchema = z
  .object({
    assetId: z.uuid(),
    alt: z
      .string()
      .trim()
      .min(3)
      .max(160)
      .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), 'Use a single-line image description.'),
  })
  .strict();
export const imageCommand = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    expected: z.number().int().positive(),
    sourceId: z.uuid(),
    kind: z.enum(['reference', 'version']),
    consent: z.literal(true),
  })
  .strict();
export const imageDataSchema = z
  .string()
  .max(133359)
  .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/);
export type WebsiteImage = {
  id: string;
  person_id: string;
  project_id: string;
  source_id: string;
  source_kind: 'reference' | 'version';
  status: 'running' | 'failed' | 'ready';
  lease: string | null;
  lease_until: string | null;
  attempts: number;
  data_url: string | null;
  sha256: string | null;
  created_at: string;
};
export const imagePolicy = {
  inputBytes: 10485760,
  inputPixels: 16000000,
  outputBytes: 100000,
  width: 1000,
  seconds: 8,
} as const;
export type RenderImage = { assetId: string; dataUrl: string };

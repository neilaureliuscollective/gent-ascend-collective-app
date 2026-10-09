import { z } from 'zod';
export const websiteCopySchema = z
  .object({
    headline: z.string().trim().min(1).max(120),
    about: z.string().trim().min(1).max(1200),
  })
  .strict();
export const websiteSourceSchema = z
  .object({
    version: z.literal(1),
    source: z.literal('Legacy Reserve'),
    websiteId: z.literal('fix-it-shop'),
    providerId: z.string().max(80),
    path: z.literal('/fix-it-shop'),
    revision: z.number().int().positive(),
    content: websiteCopySchema,
    services: z
      .array(
        z
          .object({
            id: z.string().max(100),
            name: z.string().max(200),
            description: z.string().max(600),
            revision: z.number().int().positive(),
          })
          .strict(),
      )
      .max(10),
    proposals: z
      .array(
        z
          .object({
            id: z.uuid(),
            state: z.enum(['review', 'approved', 'rejected']),
            created_at: z.string(),
          })
          .strict(),
      )
      .max(20),
    fetchedAt: z.iso.datetime(),
  })
  .strict();
export type WebsiteSource = z.infer<typeof websiteSourceSchema>;
export const websiteInputSchema = z
  .object({
    connectionId: z.uuid(),
    requestId: z.uuid(),
    websiteId: z.literal('fix-it-shop'),
    baseRevision: z.number().int().positive(),
    content: websiteCopySchema,
    serviceChanges: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            baseRevision: z.number().int().positive(),
            description: z.string().trim().min(1).max(600),
          })
          .strict(),
      )
      .max(10),
  })
  .strict()
  .refine(
    (v) => new Set(v.serviceChanges.map((s) => s.id)).size === v.serviceChanges.length,
    'Duplicate service',
  );
export const websiteAskSchema = z
  .object({
    connectionId: z.uuid(),
    conversationId: z.uuid(),
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(3000),
    consent: z.literal(true),
  })
  .strict();

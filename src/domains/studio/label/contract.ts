import { z } from 'zod';
import { brandKitSchema } from '../brand';

const box = z
  .object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();
const provenance = z
  .object({
    source: z.string().trim().min(3).max(500),
    revision: z.string().trim().min(1).max(100),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
// Coordinates are millimetres from trim top-left. Media includes the supplied bleed exactly once.
export const supplierProfileSchema = z
  .object({
    schema: z.literal('studio-supplier-profile/v1'),
    supplier: z.literal('Supliful'),
    sku: z.string().trim().min(1).max(100),
    category: z.enum(['supplement', 'personal-care', 'other']),
    fixture: z.boolean(),
    template: provenance,
    facts: provenance,
    trim: z
      .object({ width: z.number().positive().max(1000), height: z.number().positive().max(1000) })
      .strict(),
    bleed: z
      .object({
        top: z.number().min(0).max(20),
        right: z.number().min(0).max(20),
        bottom: z.number().min(0).max(20),
        left: z.number().min(0).max(20),
      })
      .strict(),
    safe: box,
    artwork: box,
    matrix: box,
    protected: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string().min(1).max(60),
            box,
            format: z.enum(['text', 'svg']).default('text'),
            content: z.string().max(4000).default(''),
            markup: z.string().max(65536).optional(),
            fontSize: z.number().min(4).max(30),
          })
          .strict()
          .superRefine((region, ctx) => {
            if (region.format === 'text' && (!region.content.trim() || region.markup))
              ctx.addIssue({ code: 'custom', message: 'Text regions need exact copy and no SVG.' });
            if (region.format === 'svg' && (!region.markup || region.content))
              ctx.addIssue({
                code: 'custom',
                message: 'Vector regions need supplier SVG artwork and no replacement copy.',
              });
          }),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((profile, ctx) => {
    const within = (a: z.infer<typeof box>, b: z.infer<typeof box>) =>
      a.x >= b.x &&
      a.y >= b.y &&
      a.x + a.width <= b.x + b.width &&
      a.y + a.height <= b.y + b.height;
    const trim = { x: 0, y: 0, ...profile.trim };
    for (const region of [
      profile.safe,
      profile.artwork,
      profile.matrix,
      ...profile.protected.map((p) => p.box),
    ]) {
      if (!within(region, trim))
        ctx.addIssue({ code: 'custom', message: 'All profile regions must fit inside trim.' });
    }
    if (!within(profile.artwork, profile.safe))
      ctx.addIssue({ code: 'custom', message: 'Artwork must fit inside the exact safe area.' });
    const regions = [profile.artwork, profile.matrix, ...profile.protected.map((p) => p.box)];
    regions.forEach((a, i) =>
      regions.slice(i + 1).forEach((b) => {
        if (overlaps(a, b))
          ctx.addIssue({
            code: 'custom',
            message: 'Artwork, required copy and matrix regions must not overlap.',
          });
      }),
    );
    if (new Set(profile.protected.map((p) => p.id)).size !== profile.protected.length)
      ctx.addIssue({ code: 'custom', message: 'Protected region IDs must be unique.' });
    if (profile.protected.some((p) => !within(p.box, profile.safe)))
      ctx.addIssue({ code: 'custom', message: 'Required copy must fit in the safe area.' });
  });

export const labelBriefSchema = z
  .object({
    schema: z.literal('studio-label-brief/v1'),
    productName: z.string().trim().min(1).max(80),
    direction: z.string().trim().min(3).max(1500),
    source: z
      .object({
        kind: z.enum(['manual', 'talk']),
        reference: z.string().max(200),
        revision: z.string().max(100),
      })
      .strict(),
  })
  .strict();
export const labelLayoutSchema = z
  .object({
    alignment: z.enum(['left', 'center']),
    titleSize: z.number().min(10).max(32),
    logoFraction: z.number().min(0.15).max(0.45),
    accent: z.enum(['rule', 'none']),
  })
  .strict();
export const labelMetadataSchema = z
  .object({
    profile: supplierProfileSchema,
    brief: labelBriefSchema,
    brand: brandKitSchema,
    generation: z.enum(['deterministic', 'model']),
    layout: labelLayoutSchema,
  })
  .strict();
export type SupplierProfile = z.infer<typeof supplierProfileSchema>;
export type LabelBrief = z.infer<typeof labelBriefSchema>;
export type LabelLayout = z.infer<typeof labelLayoutSchema>;
export function overlaps(a: z.infer<typeof box>, b: z.infer<typeof box>) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function parseSupplierProfile(value: unknown) {
  if (JSON.stringify(value).length > 100000) throw new Error('Supplier profile exceeds 100 KB.');
  return supplierProfileSchema.parse(value);
}

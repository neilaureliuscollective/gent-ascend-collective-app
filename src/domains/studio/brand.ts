import { z } from 'zod';
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const brandKitSchema = z
  .object({
    name: z.string().trim().max(60).default(''),
    voice: z.string().trim().max(300).default(''),
    background: color.default('#080A0B'),
    foreground: color.default('#E6E7E2'),
    accent: color.default('#C4912F'),
    typography: z.enum(['editorial', 'modern']).default('editorial'),
    logoReferenceId: z.uuid().nullable().default(null),
  })
  .strict();
export type BrandKit = z.infer<typeof brandKitSchema>;
export const defaultBrandKit: BrandKit = brandKitSchema.parse({});
export function readBrandKit(value: unknown): BrandKit {
  const result = brandKitSchema.safeParse(value);
  return result.success ? result.data : { ...defaultBrandKit };
}
export function brandDirection(brand?: BrandKit) {
  if (!brand) return '';
  return [
    brand.name && `Brand: ${brand.name}`,
    brand.voice && `Brand voice: ${brand.voice}`,
    `Brand palette: ${brand.background}, ${brand.foreground}, ${brand.accent}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export type StudioBrief = {
  referenceId?: string | null;
  purpose: string;
  audience: string;
  direction: string;
  palette: string;
  avoid: string;
  brand?: BrandKit;
};

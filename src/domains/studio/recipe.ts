import { z } from 'zod';
import { brandKitSchema } from './brand';
export const layoutRecipeSchema = z
  .object({
    version: z.literal(1),
    sourceVersionId: z.uuid(),
    brand: brandKitSchema,
    layout: z
      .object({
        format: z.enum(['square', 'portrait', 'landscape']),
        treatment: z.enum(['editorial', 'centered', 'quiet']),
        brand: z.string().max(60),
        headline: z.string().max(120),
        supporting: z.string().max(180),
        footer: z.string().max(80),
        focal_x: z.number().int().min(0).max(100),
        focal_y: z.number().int().min(0).max(100),
      })
      .strict(),
  })
  .strict();
export function readLayoutRecipe(text: string, availableIds: string[]) {
  if (new TextEncoder().encode(text).length > 32768)
    throw new Error('This layout recipe is too large.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Choose an exported Studio layout recipe.');
  }
  const parsed = layoutRecipeSchema.safeParse(value);
  if (!parsed.success) throw new Error('Choose an exported Studio layout recipe.');
  if (!availableIds.includes(parsed.data.sourceVersionId))
    throw new Error('Open the project containing this recipe’s original image.');
  return parsed.data;
}

import { z } from 'zod';

const copy = z.string().trim().min(1).max(1200);
const short = z.string().trim().min(1).max(180);
const fact = z.object({ label: short, value: short }).strict();
/** Merchant-approved editorial facts only. Never a price or entitlement source. */
export const productStorySchema = z
  .object({
    version: z.literal(1),
    status: z.literal('approved'),
    mediaApproved: z.boolean().default(false),
    size: short.optional(),
    fit: copy.optional(),
    benefit: copy.optional(),
    texture: copy.optional(),
    scent: z.array(fact).max(6).default([]),
    highlights: z
      .array(z.object({ name: short, role: copy }).strict())
      .max(8)
      .default([]),
    steps: z
      .array(z.object({ title: short, detail: copy }).strict())
      .max(5)
      .default([]),
    cautions: copy.optional(),
    quality: copy.optional(),
    faq: z
      .array(z.object({ question: short, answer: copy }).strict())
      .max(8)
      .default([]),
    shipping: copy.optional(),
    cancellation: copy.optional(),
    payment: copy.optional(),
    factsLabel: z.enum(['Ingredients', 'Supplement Facts']).default('Ingredients'),
  })
  .strict();
export type ProductStory = z.infer<typeof productStorySchema>;

export function readProductStory(raw?: { value: string } | null): ProductStory | null {
  if (!raw?.value || raw.value.length > 20000) return null;
  try {
    const parsed = productStorySchema.safeParse(JSON.parse(raw.value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function productForm(kind: string) {
  if (/balm|cream|creme|creatine|electrolyte|supplement|powder|gumm/i.test(kind)) return 'jar';
  if (/wash|shampoo|conditioner|lotion|cleanse/i.test(kind)) return 'pump';
  return 'oil';
}

export function shopifyMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'cdn.shopify.com' &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

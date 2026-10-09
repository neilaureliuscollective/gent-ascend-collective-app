import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max);
export const bookingUrl = text(500).refine((value) => {
  if (!value) return true;
  try {
    const u = new URL(value);
    return (
      !/\s/.test(value) &&
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !/^(localhost|127\.|0\.|\[|.*\.local$)/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}, 'Use a public HTTPS booking link without credentials.');
export const designSchema = z
  .object({
    palette: z.enum(['petrol', 'ivory', 'slate']),
    hero: z.enum(['editorial', 'centered', 'split']),
    typography: z.enum(['serif', 'sans']),
    spacing: z.enum(['spacious', 'compact']),
    audience: text(200),
    goal: text(200),
    rationale: text(500),
    cta: text(60).min(2),
    request: text(1000),
  })
  .strict();
export const defaultDesign: z.infer<typeof designSchema> = {
  palette: 'petrol',
  hero: 'editorial',
  typography: 'serif',
  spacing: 'spacious',
  audience: '',
  goal: '',
  rationale: '',
  cta: 'Explore services',
  request: '',
};
export const briefSchema = z
  .object({
    name: text(100).min(2),
    industry: z.enum(['grooming-beauty', 'professional-services']),
    vision: text(2000).min(10),
    headline: text(150).min(3),
    about: text(2000).min(10),
    services: z
      .array(z.object({ name: text(100).min(2), description: text(500), price: text(50) }).strict())
      .min(1)
      .max(12),
    hours: text(500),
    contact: text(500),
    bookingUrl,
    design: designSchema.optional(),
  })
  .strict();
export type Brief = z.infer<typeof briefSchema>;
export const commandSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      id: z.uuid(),
      versionId: z.uuid(),
      brief: briefSchema,
      missionId: z.uuid().nullable(),
      missionRevision: z.number().int().positive().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('save'),
      id: z.uuid(),
      versionId: z.uuid(),
      expected: z.number().int().positive(),
      brief: briefSchema,
    })
    .strict(),
  z.object({ action: z.literal('review'), id: z.uuid(), versionId: z.uuid() }).strict(),
  z
    .object({
      action: z.literal('generate'),
      id: z.uuid(),
      runId: z.uuid(),
      expected: z.number().int().positive(),
      consent: z.literal(true),
      instruction: text(1000).min(3).optional(),
      sourceTurnId: z.uuid().optional(),
    })
    .strict(),
]);
export type Project = {
  conversation_id?: string | null;
  id: string;
  person_id: string;
  mission_id: string | null;
  mission_revision: number | null;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type Version = {
  id: string;
  person_id: string;
  project_id: string;
  revision: number;
  brief: Brief;
  template_version: 'service-business-v1';
  reviewed_at: string | null;
  created_at: string;
};
export type Run = {
  id: string;
  person_id: string;
  project_id: string;
  source_revision: number;
  status: 'reserved' | 'succeeded' | 'uncertain';
  reserved_micros: number;
  actual_micros: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};
export type Workspace = {
  projects: Project[];
  versions: Version[];
  runs: Run[];
  canCreate: boolean;
  generationAvailable: boolean;
  remainingMicros: number;
  mission: { id: string; revision: number; title: string; objective: string } | null;
};
export const initialBrief: Brief = {
  name: '',
  industry: 'grooming-beauty',
  vision: '',
  headline: '',
  about: '',
  services: [{ name: '', description: '', price: '' }],
  hours: '',
  contact: '',
  bookingUrl: '',
};
export const generationPolicy = {
  model: 'gpt-6.1-sol',
  maxOutputTokens: 4000,
  maxInputBytes: 14000,
  reservationMicros: 1_000_000,
  monthlyMicros: 10_000_000,
} as const;
export function usageMicros(input: number, output: number) {
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output) || input < 0 || output < 0)
    throw new Error('Unknown provider usage');
  return input * 2 + output * 10;
}

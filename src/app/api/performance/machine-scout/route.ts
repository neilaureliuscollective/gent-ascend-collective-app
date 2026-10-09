import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { createOpenAI } from '@/platform/openai/provider';
import { authorizedPerson } from '@/domains/access/authorize';
import { aiConfigSchema } from '@/domains/intelligence/validation';

const requestSchema = z.object({
  image: z.string().max(3_600_000),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

const candidateSchema = z.object({
  name: z.string().min(1).max(80),
  equipment: z.string().min(1).max(80),
  movementPattern: z.string().min(1).max(80),
});

const machineResultSchema = z.object({
  name: z.string().min(1).max(80),
  equipment: z.string().min(1).max(80),
  movementPattern: z.string().min(1).max(80),
  primaryMuscles: z.array(z.string().min(1).max(40)).min(1).max(4),
  secondaryMuscles: z.array(z.string().min(1).max(40)).max(6),
  setupCue: z.string().min(1).max(220),
  confidence: z.enum(['high', 'medium', 'low']),
  uncertainty: z.string().max(220),
  alternatives: z.array(candidateSchema).max(3).default([]),
});

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^\`\`\`json\s*/i, '').replace(/\`\`\`$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object returned.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function POST(request: Request) {
  const ctx = await authorizedPerson('performance.read');
  if (!ctx) return NextResponse.json({ error: 'Sign in to use Machine Scout.' }, { status: 401 });

  try {
    const input = requestSchema.parse(await request.json());
    const config = aiConfigSchema.parse(process.env);
    if (!config.OPENAI_API_KEY) return NextResponse.json({ error: 'Aethelios vision is not connected.' }, { status: 503 });

    const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1' });
    const result = await generateText({
      model: openai.responses(config.AURELIUS_AI_MODEL),
      instructions:
        'You are Aethelios Machine Scout inside a strength-training app. Inspect only visible gym equipment. Identify the most likely machine or exercise station using common gym language. Use geometry and visible features such as bench angle, pads, handles, plate horns, cables, lever arms, foot plates and movement path. Never invent certainty. If confidence is medium or low, provide 1-3 plausible alternatives instead of failing. Return ONLY valid JSON with keys: name, equipment, movementPattern, primaryMuscles, secondaryMuscles, setupCue, confidence, uncertainty, alternatives. Each alternative has name, equipment, movementPattern. setupCue is one brief neutral setup cue, not medical advice.',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Identify this gym machine or station so I can add it to the workout. If the exact model is unclear, identify the exercise category and give likely alternatives.' },
          { type: 'image', image: input.image, mediaType: input.mediaType },
        ],
      }],
      maxOutputTokens: 600,
      maxRetries: 1,
      timeout: { totalMs: 24000 },
      providerOptions: { openai: { store: false } },
    });

    const parsed = machineResultSchema.parse(extractJson(result.text));
    return NextResponse.json(parsed, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'That image could not be read. Try a clearer photo of the full machine.'
        : error instanceof Error && /JSON|parse/i.test(error.message)
          ? 'Aethelios could not read that result cleanly. Try the photo again.'
          : 'Machine Scout could not inspect that image right now. Try another angle.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

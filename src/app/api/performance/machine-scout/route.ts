import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { authorizedPerson } from '@/domains/access/authorize';
import { aiConfigSchema } from '@/domains/intelligence/validation';

const requestSchema = z.object({
  image: z.string().max(2_800_000),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
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
    if (!config.OPENAI_API_KEY)
      return NextResponse.json({ error: 'Aethelios vision is not connected.' }, { status: 503 });

    const openai = createOpenAI({
      apiKey: config.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
    });

    const result = await generateText({
      model: openai.responses(config.AURELIUS_AI_MODEL),
      instructions:
        'You are Aethelios Machine Scout inside a strength-training app. Analyze only the visible gym equipment. Identify the most likely exercise/machine category conservatively. Never pretend certainty from an ambiguous image. Do not diagnose injury or prescribe a medical exercise. Return ONLY valid JSON with keys: name, equipment, movementPattern, primaryMuscles, secondaryMuscles, setupCue, confidence, uncertainty. setupCue should be one brief neutral setup cue, not a full technique prescription. If uncertain, use a generic descriptive name and say what visual detail is missing in uncertainty.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identify this gym machine or exercise station so I can add the movement to my live workout. Use common gym language.',
            },
            { type: 'image', image: input.image, mediaType: input.mediaType },
          ],
        },
      ],
      maxOutputTokens: 350,
      maxRetries: 0,
      timeout: { totalMs: 18000 },
      providerOptions: { openai: { store: false } },
    });

    const parsed = machineResultSchema.parse(extractJson(result.text));
    return NextResponse.json(parsed, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'That image could not be read. Try a clearer photo of the full machine.'
        : error instanceof Error && error.message.includes('JSON')
          ? 'Machine Scout could not identify that confidently. Try another angle.'
          : 'Machine Scout could not inspect that image right now.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

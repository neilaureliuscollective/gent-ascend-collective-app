import { z } from 'zod';

export const MAX_COMPOSITION_MS = 60_000;
export const MAX_SCENES = 12;
export const compositionAspects = ['landscape', 'portrait', 'square'] as const;
export type CompositionAspect = (typeof compositionAspects)[number];

export const compositionFrames = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

const crop = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine((value) => value.x + value.width <= 1.0001 && value.y + value.height <= 1.0001);

const placement = z
  .object({
    x: z.number().min(0).max(1).default(0),
    y: z.number().min(0).max(1).default(0),
    width: z.number().positive().max(1).default(1),
    height: z.number().positive().max(1).default(1),
  })
  .strict();

export const compositionSceneSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(['image', 'video']),
    assetId: z.uuid(),
    assetKind: z.enum(['version', 'reference', 'footage']),
    name: z.string().trim().min(1).max(80),
    inMs: z.number().int().min(0).max(MAX_COMPOSITION_MS),
    outMs: z.number().int().min(1).max(MAX_COMPOSITION_MS),
    durationMs: z.number().int().min(200).max(MAX_COMPOSITION_MS),
    crop: crop.default({ x: 0, y: 0, width: 1, height: 1 }),
    placement: placement.default({ x: 0, y: 0, width: 1, height: 1 }),
    transition: z.enum(['cut', 'dissolve']).default('cut'),
    stillMotion: z.enum(['none', 'slow-zoom']).default('none'),
  })
  .strict()
  .superRefine((scene, ctx) => {
    if (scene.outMs <= scene.inMs)
      ctx.addIssue({ code: 'custom', message: 'Clip out point must be after the in point.' });
    if (scene.kind === 'image' && scene.assetKind === 'footage')
      ctx.addIssue({ code: 'custom', message: 'Still scenes cannot use footage clips.' });
    if (scene.kind === 'video' && scene.assetKind !== 'footage')
      ctx.addIssue({ code: 'custom', message: 'Video scenes must reference owned footage.' });
  });

export const captionCueSchema = z
  .object({
    id: z.uuid(),
    startMs: z.number().int().min(0).max(MAX_COMPOSITION_MS),
    endMs: z.number().int().min(1).max(MAX_COMPOSITION_MS),
    text: z.string().trim().min(1).max(200),
  })
  .strict()
  .refine((cue) => cue.endMs > cue.startMs, { message: 'Caption end must be after its start.' });

export const titleCardSchema = z
  .object({
    id: z.uuid(),
    startMs: z.number().int().min(0).max(MAX_COMPOSITION_MS),
    endMs: z.number().int().min(1).max(MAX_COMPOSITION_MS),
    text: z.string().trim().min(1).max(80),
    fontId: z.enum(['inter', 'sora', 'dejavu']).default('inter'),
  })
  .strict();

export const audioTrackSchema = z
  .object({
    assetId: z.uuid(),
    assetKind: z.enum(['narration', 'music']),
    gainDb: z.number().min(-24).max(6).default(0),
    fadeInMs: z.number().int().min(0).max(4000).default(0),
    fadeOutMs: z.number().int().min(0).max(4000).default(0),
  })
  .strict();

export const compositionDocumentSchema = z
  .object({
    schema: z.literal('studio-composition/v1'),
    id: z.uuid(),
    title: z.string().trim().min(1).max(80),
    aspect: z.enum(compositionAspects),
    fps: z.literal(24),
    scenes: z.array(compositionSceneSchema).min(1).max(MAX_SCENES),
    titles: z.array(titleCardSchema).max(8).default([]),
    captions: z.array(captionCueSchema).max(40).default([]),
    narration: audioTrackSchema.nullable().default(null),
    music: audioTrackSchema.nullable().default(null),
  })
  .strict()
  .superRefine((document, ctx) => {
    const ids = new Set<string>();
    let total = 0;
    for (const scene of document.scenes) {
      if (ids.has(scene.id)) ctx.addIssue({ code: 'custom', message: 'Scene IDs must be unique.' });
      ids.add(scene.id);
      total += scene.durationMs;
    }
    if (total > MAX_COMPOSITION_MS)
      ctx.addIssue({
        code: 'custom',
        message: 'A Studio film is limited to 60 seconds in this profile.',
      });
    if (total < 1000)
      ctx.addIssue({ code: 'custom', message: 'A Studio film must be at least one second.' });
  });

export type CompositionDocument = z.infer<typeof compositionDocumentSchema>;
export type CompositionScene = z.infer<typeof compositionSceneSchema>;
export const MAX_COMPOSITION_BYTES = 262_144;

export function parseComposition(value: unknown): CompositionDocument {
  const encoded = new TextEncoder().encode(JSON.stringify(value)).length;
  if (encoded > MAX_COMPOSITION_BYTES) throw new Error('This composition is too large to save.');
  return compositionDocumentSchema.parse(value);
}

export function compositionDuration(document: CompositionDocument) {
  return document.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
}

export function compositionFrame(aspect: CompositionAspect) {
  return compositionFrames[aspect];
}

export function emptyComposition(input: {
  id: string;
  title: string;
  aspect: CompositionAspect;
  scene: CompositionScene;
}): CompositionDocument {
  return parseComposition({
    schema: 'studio-composition/v1',
    id: input.id,
    title: input.title,
    aspect: input.aspect,
    fps: 24,
    scenes: [input.scene],
    titles: [],
    captions: [],
    narration: null,
    music: null,
  });
}

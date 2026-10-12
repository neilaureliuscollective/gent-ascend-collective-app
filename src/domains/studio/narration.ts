import { z } from 'zod';
export const narrationModel = 'gpt-audio-1.5';
export const narrationInput = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(80),
    script: z.string().trim().min(3).max(600),
    voice: z.enum(['alloy', 'ash', 'coral']),
    tone: z.enum(['clear', 'calm', 'confident']),
    approved: z.literal(true),
  })
  .strict();
export type NarrationInput = z.infer<typeof narrationInput>;
export type NarrationRecord = {
  id: string;
  person_id: string;
  project_id: string;
  title: string;
  script: string;
  voice: string;
  tone: string;
  model: string;
  status: 'pending' | 'complete' | 'failed';
  storage_key: string | null;
  duration: number | null;
  created_at: string;
  failure_code: string | null;
};
export function spokenWords(text: string) {
  return (
    text
      .normalize('NFKC')
      .toLocaleLowerCase('en')
      .match(/[\p{L}\p{N}]+/gu)
      ?.join(' ') ?? ''
  );
}
// Parse actual PCM WAV bytes, rather than trusting a provider MIME or reported duration.
export function narrationWave(bytes: Uint8Array) {
  if (bytes.length < 44 || bytes.length > 3_000_000)
    throw new Error('The narration file is outside the supported limit.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('The narration is not a WAV file.');
  let rate = 0,
    channels = 0,
    block = 0,
    data = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true),
      start = offset + 8;
    if (start + size > bytes.length) throw new Error('The narration file is incomplete.');
    if (tag(offset) === 'fmt ') {
      if (size < 16 || view.getUint16(start, true) !== 1 || view.getUint16(start + 14, true) !== 16)
        throw new Error('Choose a PCM 16-bit narration.');
      channels = view.getUint16(start + 2, true);
      rate = view.getUint32(start + 4, true);
      block = view.getUint16(start + 12, true);
      if (
        ![1, 2].includes(channels) ||
        rate < 8000 ||
        rate > 48000 ||
        block !== channels * 2 ||
        view.getUint32(start + 8, true) !== rate * block
      )
        throw new Error('The narration audio format is unsupported.');
    }
    if (tag(offset) === 'data') data += size;
    offset = start + size + (size % 2);
  }
  const duration = data / (rate * block);
  if (!Number.isFinite(duration) || duration < 0.1 || duration > 60 || data % block !== 0)
    throw new Error('Narration must be no longer than one minute.');
  return { duration, channels, rate };
}
export function sceneSubtitles(
  scenes: { position: number; title: string; message: string }[],
  seconds: 2 | 4 | 6,
  format: 'vtt' | 'srt',
) {
  if (!scenes.length || scenes.length > 8 || ![2, 4, 6].includes(seconds))
    throw new Error('Choose one to eight timed scenes.');
  const clock = (value: number) =>
    `00:00:${String(value).padStart(2, '0')}${format === 'vtt' ? '.' : ','}000`;
  return (
    (format === 'vtt'
      ? 'WEBVTT\n\nNOTE Scene-caption timing; not speech alignment. Review before publishing.\n\n'
      : '') +
    [...scenes]
      .sort((a, b) => a.position - b.position)
      .map(
        (scene, i) =>
          `${i + 1}\n${clock(i * seconds)} --> ${clock((i + 1) * seconds)}\n${(
            scene.message || scene.title
          )
            .replace(/-->|[<>]/g, '')
            .replace(/[\r\n]+/g, ' ')
            .trim()}\n`,
      )
      .join('\n')
  );
}

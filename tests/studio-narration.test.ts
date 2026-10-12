import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  narrationInput,
  narrationWave,
  sceneSubtitles,
  spokenWords,
} from '../src/domains/studio/narration';
import { renderNarration } from '../src/platform/openai/narration';
function wave(seconds = 1) {
  const bytes = Buffer.alloc(44 + 8000 * 2 * seconds);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}
const input = {
  id: '10000000-0000-4000-8000-000000000001',
  projectId: '10000000-0000-4000-8000-000000000002',
  title: 'Narration',
  script: 'Made with intention.',
  voice: 'alloy' as const,
  tone: 'clear' as const,
  approved: true as const,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('Narration and caption contracts', () => {
  it('requires explicit approval, a curated voice, bounded script and no extra settings', () => {
    expect(narrationInput.parse(input)).toEqual(input);
    for (const extra of [
      { approved: false },
      { voice: 'custom-voice' },
      { script: 'x'.repeat(601) },
      { model: 'sora-2' },
      { projectId: 'foreign' },
    ])
      expect(narrationInput.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it('parses actual WAV duration and refuses malformed, oversized or unsupported audio', () => {
    expect(narrationWave(wave(2))).toEqual({ duration: 2, channels: 1, rate: 8000 });
    expect(() => narrationWave(new Uint8Array(44))).toThrow();
    expect(() => narrationWave(wave(61))).toThrow('one minute');
    const corrupt = wave();
    corrupt.writeUInt32LE(99999999, 40);
    expect(() => narrationWave(corrupt)).toThrow('incomplete');
    const float = wave();
    float.writeUInt16LE(3, 20);
    expect(() => narrationWave(float)).toThrow('PCM');
  });
  it('uses reviewed scene order and exact film timing without pretending to align speech', () => {
    const scenes = [
      { position: 2, title: 'B', message: 'End' },
      { position: 1, title: 'A', message: '<Opening> --> now\nhi' },
    ];
    const vtt = sceneSubtitles(scenes, 4, 'vtt');
    expect(vtt).toContain('not speech alignment');
    expect(vtt).toContain('00:00:00.000 --> 00:00:04.000\nOpening  now hi');
    expect(vtt).toContain('00:00:04.000 --> 00:00:08.000\nEnd');
    expect(sceneSubtitles(scenes, 6, 'srt')).toContain('00:00:06,000 --> 00:00:12,000');
    expect(() => sceneSubtitles([], 4, 'vtt')).toThrow();
    expect(spokenWords('Made, with intention!')).toBe(spokenWords(input.script));
  });
  it('calls the active audio model once, saves no provider conversation, and returns verified bytes', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          choices: [
            {
              finish_reason: 'stop',
              message: { audio: { data: wave().toString('base64'), transcript: input.script } },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetch);
    expect((await renderNarration(input)).duration).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body).toMatchObject({
      model: 'gpt-audio-1.5',
      store: false,
      modalities: ['text', 'audio'],
      audio: { voice: 'alloy', format: 'wav' },
      max_completion_tokens: 4096,
    });
    expect(body.messages[1].content).toBe(JSON.stringify({ script: input.script }));
  });
  it.each(['changed', 'truncated', 'bad-wave', '403'])(
    'rejects %s output without automatic retries or raw provider details',
    async (mode) => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const fetch = vi
        .fn()
        .mockResolvedValue(
          mode === '403'
            ? new Response('private upstream payload', { status: 403 })
            : Response.json({
                choices: [
                  {
                    finish_reason: mode === 'truncated' ? 'length' : 'stop',
                    message: {
                      audio: {
                        data:
                          mode === 'bad-wave'
                            ? Buffer.alloc(44).toString('base64')
                            : wave().toString('base64'),
                        transcript:
                          mode === 'changed' ? 'Made with invented claims.' : input.script,
                      },
                    },
                  },
                ],
              }),
        );
      vi.stubGlobal('fetch', fetch);
      await expect(renderNarration(input)).rejects.toThrow(
        mode === '403' ? 'not enabled' : mode === 'bad-wave' ? 'safely' : 'complete script',
      );
      expect(fetch).toHaveBeenCalledOnce();
    },
  );
});

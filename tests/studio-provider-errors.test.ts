import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
import { renderImage, ImageGenerationError } from '../src/platform/openai/image';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('Studio provider error boundaries', () => {
  it.each([401, 403])(
    'explains missing provider access for HTTP %s without exposing payloads',
    async (status) => {
      vi.stubEnv('OPENAI_API_KEY', 'test-secret');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('sensitive upstream details', { status })),
      );
      const error = await renderImage('Synthetic image', 'gpt-image-2.5-flare', '1024x1024').catch(
        (e) => e,
      );
      expect(error).toBeInstanceOf(ImageGenerationError);
      expect(error.status).toBe(503);
      expect(error.message).toContain('not enabled');
      expect(error.message).not.toContain('sensitive');
      expect(error.message).not.toContain('test-secret');
    },
  );
  it('keeps prompt rejection distinct from provider authorization failure', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 400 })));
    const error = await renderImage('Synthetic image', 'gpt-image-2.5-flare', '1024x1024').catch(
      (e) => e,
    );
    expect(error.status).toBe(422);
    expect(error.message).toContain('different prompt');
  });
});

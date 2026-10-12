import { expect, it, vi } from 'vitest';
import { readImageStream } from '@/platform/openai/image-stream';
const bytes = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(100)]);
function stream(events: unknown[]) {
  const text = events.map((event) => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join('');
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < encoded.length; i += 13) controller.enqueue(encoded.slice(i, i + 13));
      controller.close();
    },
  });
}
const partial = {
  type: 'response.image_generation_call.partial_image',
  partial_image_index: 0,
  partial_image_b64: bytes.toString('base64'),
};
const done = {
  type: 'response.completed',
  response: {
    status: 'completed',
    output: [{ type: 'image_generation_call', result: bytes.toString('base64') }],
  },
};
it('handles fragmented SSE and repeated previews, requiring a separate final completion', async () => {
  const preview = vi.fn().mockResolvedValue(undefined);
  expect(Buffer.from(await readImageStream(stream([partial, partial, done]), preview))).toEqual(
    bytes,
  );
  expect(preview).toHaveBeenCalledOnce();
});
it('never substitutes a provisional image for an incomplete or disconnected final result', async () => {
  await expect(readImageStream(stream([partial]), async () => {})).rejects.toThrow(/finalization/);
  await expect(
    readImageStream(
      stream([
        partial,
        {
          type: 'response.completed',
          response: { status: 'incomplete', output: done.response.output },
        },
      ]),
      async () => {},
    ),
  ).rejects.toThrow(/Incomplete/);
});

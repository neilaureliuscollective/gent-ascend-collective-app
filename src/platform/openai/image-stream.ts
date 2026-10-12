export function imageBytes(encoded: string) {
  const bytes = Buffer.from(encoded, 'base64');
  if (
    bytes.length < 100 ||
    bytes.length > 10485760 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('Invalid image bytes');
  return bytes;
}
/** Bounded SSE decoder; previews never stand in for a completed provider response. */
export async function readImageStream(
  body: ReadableStream<Uint8Array>,
  preview: (bytes: Uint8Array, index: number) => Promise<void>,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    total = 0,
    final: Buffer | undefined,
    completed = false;
  const seen = new Set<number>();
  async function frame(text: string) {
    const data = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;
    const event = JSON.parse(data) as {
      type?: string;
      partial_image_index?: number;
      partial_image_b64?: string;
      response?: { status?: string; output?: { type: string; result?: string }[] };
    };
    if (
      event.type === 'error' ||
      event.type === 'response.failed' ||
      event.type === 'response.incomplete'
    )
      throw new Error('Image response failed');
    if (
      event.type === 'response.image_generation_call.partial_image' &&
      typeof event.partial_image_index === 'number' &&
      Number.isInteger(event.partial_image_index) &&
      event.partial_image_index >= 0 &&
      event.partial_image_index < 3 &&
      !seen.has(event.partial_image_index) &&
      typeof event.partial_image_b64 === 'string'
    ) {
      seen.add(event.partial_image_index);
      await preview(imageBytes(event.partial_image_b64), event.partial_image_index);
    }
    if (event.type === 'response.completed') {
      if (event.response?.status !== 'completed') throw new Error('Incomplete image response');
      const encoded = event.response.output?.find(
        (item) => item.type === 'image_generation_call',
      )?.result;
      if (typeof encoded !== 'string') throw new Error('No final image');
      final = imageBytes(encoded);
      completed = true;
    }
  }
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 83886080) throw new Error('Image stream too large');
      buffer += decoder.decode(part.value, { stream: true });
      buffer = buffer.replaceAll('\r\n', '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const text = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        await frame(text);
      }
      if (buffer.length > 20971520) throw new Error('Image frame too large');
    }
    buffer += decoder.decode();
    if (buffer.trim()) await frame(buffer);
    if (!completed || !final) throw new Error('Image finalization unconfirmed');
    return final;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

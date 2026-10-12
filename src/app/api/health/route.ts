import { z } from 'zod';
import { mutationSchema } from '@/domains/health/schema';
import {
  verifyHealthOwner,
  mutateHealth,
  readHealth,
  uploadRecord,
} from '@/domains/health/service';
import { apiError, mutationBody, privateJson, verifyOrigin } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const data = await readHealth();
    return data.owner ? privateJson(data) : privateJson({ error: 'Sign in to open Health.' }, 401);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      verifyOrigin(request);
      await verifyHealthOwner(request);
      // Read bounded bytes before parsing multipart; Content-Length is not trusted.
      const reader = request.body?.getReader();
      if (!reader) throw new IntelligenceError('File required.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8 * 1024 * 1024 + 32768) {
          await reader.cancel();
          throw new IntelligenceError('Upload exceeds 8 MB.', 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const form = await new Response(bytes, {
        headers: { 'Content-Type': request.headers.get('content-type')! },
      }).formData();
      const file = form.get('file');
      const fields = z
        .object({ request: z.uuid(), id: z.uuid(), title: z.string().trim().min(1).max(120) })
        .parse(Object.fromEntries(['request', 'id', 'title'].map((k) => [k, form.get(k)])));
      if (!(file instanceof File)) throw new IntelligenceError('Choose an original report.');
      await uploadRecord(file, fields.request, fields.id, fields.title);
      return privateJson(await readHealth());
    }
    const input = mutationSchema.safeParse(await mutationBody(request, 250000));
    if (!input.success || input.data.kind === 'export')
      throw new IntelligenceError('Review the Health request before saving.');
    await verifyHealthOwner(request);
    return privateJson(await mutateHealth(input.data));
  } catch (error) {
    return apiError(error);
  }
}

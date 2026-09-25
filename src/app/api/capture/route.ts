import { captureSchema } from '@/domains/capture/schema';
import { CaptureError, listCaptures, saveCapture } from '@/domains/capture/service';
import { mutationBody } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const failed = (error: unknown) => json({ error: error instanceof CaptureError || error instanceof IntelligenceError ? error.message : 'Capture could not be completed.' }, error instanceof CaptureError || error instanceof IntelligenceError ? error.status : 503);

export async function GET() {
  try { return json(await listCaptures()); } catch (error) { return failed(error); }
}
export async function POST(request: Request) {
  try {
    const result = captureSchema.safeParse(await mutationBody(request));
    if (!result.success) throw new CaptureError('Enter a thought up to 2,000 characters.');
    return json(await saveCapture(result.data), 201);
  } catch (error) { return failed(error); }
}

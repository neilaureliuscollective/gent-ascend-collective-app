import { creationRuntime } from '@/domains/technology/runtime';
export async function GET() {
  try {
    const binding = creationRuntime({
      ...process.env,
      CREATION_BUILD_COMMIT: process.env.CREATION_BUILD_COMMIT,
    });
    if (!binding) return new Response(null, { status: 404 });
    // Non-secret deployment metadata only; never grants a session or mutation authority.
    return Response.json(binding, {
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

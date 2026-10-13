import { NextResponse } from 'next/server';
import { apiError, mutationBody } from '@/domains/intelligence/http';
import { asIntelligence, startGithubConnection } from '@/domains/connections/service';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    await mutationBody(request, 16);
    const started = await startGithubConnection();
    const response = NextResponse.json(
      { location: started.location, state: started.state },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    response.cookies.set(started.cookie.name, started.state, started.cookie.options);
    return response;
  } catch (error) {
    return apiError(asIntelligence(error));
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST to start a GitHub connection.' }, { status: 405 });
}

import { completeConnection } from '@/domains/business-connections/service';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    await completeConnection(new URL(req.url));
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/app/business-connections',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/app/business-connections?connection=failed',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }
}

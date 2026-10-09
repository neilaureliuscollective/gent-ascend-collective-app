import { z } from 'zod';
import {
  listConnections,
  beginConnection,
  disconnectConnection,
} from '@/domains/business-connections/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return privateJson(await listConnections());
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const input = z
      .object({ companyId: z.uuid() })
      .strict()
      .parse(await mutationBody(req, 2000));
    return privateJson({ redirect: await beginConnection(input.companyId) });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const input = z
      .object({ id: z.uuid() })
      .strict()
      .parse(await mutationBody(req, 2000));
    return privateJson(await disconnectConnection(input.id));
  } catch (e) {
    return apiError(e);
  }
}

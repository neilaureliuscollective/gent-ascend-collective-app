import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { createSupplierLabel, labelCreateSchema, labelPreflight, labelPreflightSchema } from '@/domains/studio/label/service';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request: Request) {
  try {
    const body=await mutationBody(request,524288);
    const preflight=labelPreflightSchema.safeParse(body);
    return privateJson(preflight.success ? await labelPreflight(preflight.data) : await createSupplierLabel(labelCreateSchema.parse(body)));
  } catch(error) { return apiError(error); }
}

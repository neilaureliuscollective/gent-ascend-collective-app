import { z } from 'zod';
import {
  createWorkInput,
  generateWorkInput,
  saveWorkInput,
  reviewWorkInput,
} from '@/domains/company-work/schema';
import {
  createWork,
  generateWork,
  listWork,
  readWork,
  reviewWork,
  saveWork,
} from '@/domains/company-work/service';
import { presentationLayout, presentationPdf } from '@/domains/company-work/presentation';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export const runtime = 'nodejs';
export const maxDuration = 120;
const querySchema = z
  .object({
    companyId: z.uuid(),
    jobId: z.uuid().optional(),
    versionId: z.uuid().optional(),
    format: z.enum(['pdf', 'preview']).optional(),
  })
  .strict();
export async function GET(request: Request) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new IntelligenceError('Choose a company and job.');
    const { companyId, jobId, versionId, format } = parsed.data;
    if (!jobId) {
      if (format || versionId) throw new IntelligenceError('Choose a job.');
      return privateJson({ jobs: await listWork(companyId) });
    }
    const work = await readWork(companyId, jobId);
    if (!format) return privateJson(work);
    const version = work.versions.find((v) => v.id === versionId);
    if (!version) throw new IntelligenceError('Version not found.', 404);
    const label = `${work.job.company_name} · v${version.revision}`;
    if (format === 'preview')
      return privateJson({
        slides: await presentationLayout(version.content, work.job.scope, label),
      });
    if (!version.reviewed_at)
      throw new IntelligenceError('Review this saved version before export.', 409);
    const pdf = await presentationPdf(version.content, work.job.scope, label, version.reviewed_at);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="aethelios-presentation-v${version.revision}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request, 65536);
    const created = createWorkInput.safeParse(body);
    if (created.success) return privateJson(await createWork(created.data), 201);
    const generated = generateWorkInput.safeParse(body);
    if (generated.success)
      return privateJson(await generateWork(generated.data, request.signal), 201);
    throw new IntelligenceError('Check the job scope or generation request.');
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const input = saveWorkInput.safeParse(await mutationBody(request, 65536));
    if (!input.success) throw new IntelligenceError('Check the brief and slides.');
    const { companyId, jobId, versionId, expected, content } = input.data;
    return privateJson(await saveWork(companyId, jobId, versionId, expected, content));
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const input = reviewWorkInput.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Choose a saved version.');
    const { companyId, jobId, versionId } = input.data;
    const work = await readWork(companyId, jobId);
    const v = work.versions.find((v) => v.id === versionId);
    if (!v) throw new IntelligenceError('Version not found.', 404);
    // Review is allowed only after this precise snapshot is renderable.
    await presentationLayout(
      v.content,
      work.job.scope,
      `${work.job.company_name} · v${v.revision}`,
    );
    return privateJson(await reviewWork(companyId, jobId, versionId));
  } catch (error) {
    return apiError(error);
  }
}

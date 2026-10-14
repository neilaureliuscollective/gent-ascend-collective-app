import { z } from 'zod';
import { readArchitectApp } from '@/domains/architect-apps/service';
import { denyForeignPreview } from '@/domains/architect-apps/preview';
import { apiError } from '@/domains/intelligence/http';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const project = params.get('project');
    const revision = params.get('revision');
    if (!project || !z.uuid().safeParse(project).success) throw new IntelligenceError('Invalid project.');
    if (revision && !z.uuid().safeParse(revision).success) throw new IntelligenceError('Invalid revision.');
    const { person } = await intelligenceSession();
    const library = await readArchitectApp(project);
    const current = library.current;
    if (!current || denyForeignPreview(person.id, project, { personId: current.person_id, projectId: current.project_id }))
      throw new IntelligenceError('Preview unavailable.', 404);
    if (revision && current.id !== revision && library.working?.id !== revision)
      throw new IntelligenceError('Foreign or stale preview revision.', 403);
    if (!library.preview)
      throw new IntelligenceError('Compiled preview is not ready. The last working application stays available when one exists.', 409);
    return new Response(library.preview.srcDoc, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': library.preview.csp,
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

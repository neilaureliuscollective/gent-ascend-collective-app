import { z } from 'zod';
import { readArchitectApp } from '@/domains/architect-apps/service';
import { denyForeignPreview, previewDocumentHeaders, revisionAllowsPreview } from '@/domains/architect-apps/preview';
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
    const selectedNumber = params.get('selected');
    const library = await readArchitectApp(
      project,
      selectedNumber && /^\d+$/.test(selectedNumber) ? Number(selectedNumber) : undefined,
    );
    const target = revision
      ? library.revisions.find((row) => row.id === revision) ?? null
      : library.selected ?? library.current;
    if (!target || denyForeignPreview(person.id, project, { personId: target.person_id, projectId: target.project_id }))
      throw new IntelligenceError('Preview unavailable.', 404);
    if (!revisionAllowsPreview(target))
      throw new IntelligenceError('Compiled preview is authorized only for a ready or last-working revision.', 403);
    if (revision && library.preview?.revisionId !== revision && library.working?.id !== revision && target.id !== revision)
      throw new IntelligenceError('Foreign or stale preview revision.', 403);
    if (!library.preview)
      throw new IntelligenceError('Compiled preview is not ready. The last working application stays available when one exists.', 409);
    return new Response(library.preview.srcDoc, {
      status: 200,
      headers: previewDocumentHeaders(library.preview.csp),
    });
  } catch (error) {
    return apiError(error);
  }
}

import 'server-only';
import { readBrandKit } from './brand';
import { assertLabelRevision, protectedLabelErrors } from './label/document';
import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { studioSession, verifyStudioProject } from './service';
import { parseDesignDocument, type DesignDocument } from './design/document';
import { presetDocument, finishLayoutPreset } from './design/presets';
import { renderWorkerRequested } from './render/ffmpeg';
import {
  designExportNeedsFfmpeg,
  renderDesignBytes,
  runDesignExportJob,
} from './render/design-job';

export { designExportNeedsFfmpeg, renderDesignBytes };

export const designSaveInput = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(80),
    document: z.unknown(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    revision: z.number().int().min(0),
    freeze: z.boolean().optional(),
  })
  .strict();

export const designCreateInput = z
  .object({
    projectId: z.uuid(),
    presetId: z.string().min(1).max(40),
    title: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const designExportInput = z
  .object({
    projectId: z.uuid(),
    designId: z.uuid(),
    revisionId: z.uuid(),
    format: z.enum(['png', 'svg', 'pdf']),
    fontMode: z.enum(['embed', 'outline']).default('embed'),
    id: z.uuid(),
    idempotencyKey: z.uuid(),
  })
  .strict();

type SaveRow = { id: string; revision: number; updated_at: string; revision_id: string };

export async function createDesign(input: z.infer<typeof designCreateInput>) {
  await verifyStudioProject(input.projectId);
  if (input.presetId === 'unconfirmed-label')
    throw new IntelligenceError(
      'Import the exact supplier template profile to create a product label.',
      422,
    );
  const { client, person } = await studioSession();
  const project = await client
    .from('ai_studio_projects')
    .select('brief')
    .eq('id', input.projectId)
    .eq('person_id', person.id)
    .single();
  if (project.error) throw new IntelligenceError('Brand kit could not be loaded.', 503);
  const brief = project.data.brief as { brand?: unknown };
  const document = presetDocument(input.presetId, crypto.randomUUID(), readBrandKit(brief.brand));
  if (input.title) document.title = input.title;
  return saveDesign({
    id: document.id,
    projectId: input.projectId,
    title: document.title,
    document,
    updatedAt: null,
    revision: 0,
  });
}

export async function saveDesign(input: z.infer<typeof designSaveInput>) {
  await verifyStudioProject(input.projectId);
  const document = parseDesignDocument(input.document);
  if (document.id !== input.id) throw new IntelligenceError('Design identity does not match.', 422);
  const { client } = await studioSession();
  const existing = await client
    .from('ai_studio_designs')
    .select('document')
    .eq('id', input.id)
    .maybeSingle();
  if (existing.error) throw new IntelligenceError('Current design could not be verified.', 503);
  if (existing.data) assertLabelRevision(parseDesignDocument(existing.data.document), document);
  const protectedErrors = protectedLabelErrors(document);
  if (protectedErrors.length) throw new IntelligenceError(protectedErrors[0]!, 422);
  const result = await client.rpc('ai_studio_design_save', {
    p_id: input.id,
    p_project: input.projectId,
    p_title: input.title,
    p_document: document,
    p_updated: input.updatedAt,
    p_expected: input.revision,
    p_freeze: input.freeze ?? false,
  });
  if (result.error) {
    if (result.error.message.includes('DESIGN_CONFLICT'))
      throw new IntelligenceError('This design changed elsewhere. Refresh it before saving.', 409);
    throw new IntelligenceError(
      result.error.message.replace(/^.*ERROR:\s*/i, '') || 'Design could not be saved.',
      422,
    );
  }
  const row = Array.isArray(result.data)
    ? (result.data[0] as SaveRow | undefined)
    : (result.data as SaveRow | null);
  if (!row) throw new IntelligenceError('Design could not be saved.', 503);
  return { ...row, document };
}

export async function freezeDesign(designId: string, expectedRevision: number) {
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_design_freeze', {
    p_id: designId,
    p_expected: expectedRevision,
  });
  if (result.error || !result.data) {
    if (result.error?.message.includes('STALE_DESIGN_REVISION'))
      throw new IntelligenceError(
        'That design revision is no longer the selected freeze target.',
        409,
      );
    throw new IntelligenceError('The design revision could not be frozen.', 409);
  }
  return { revisionId: result.data as string };
}

export async function designRevision(projectId: string, revisionId: string) {
  await verifyStudioProject(projectId);
  const { client, person } = await studioSession();
  const result = await client
    .from('ai_studio_design_revisions')
    .select('*')
    .eq('id', revisionId)
    .eq('project_id', projectId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (result.error || !result.data) throw new IntelligenceError('Design revision not found.', 404);
  return {
    ...result.data,
    document: parseDesignDocument(result.data.document),
  };
}

export async function startDesignExport(
  input: z.infer<typeof designExportInput>,
  executeLocal = true,
) {
  const revision = await designRevision(input.projectId, input.revisionId);
  if (revision.design_id !== input.designId)
    throw new IntelligenceError('Export must use the selected design revision.', 422);
  const { client } = await studioSession();
  const begun = await client.rpc('ai_studio_design_export_begin', {
    p_id: input.id,
    p_project: input.projectId,
    p_design: input.designId,
    p_revision: input.revisionId,
    p_format: input.format,
    p_font_mode: input.fontMode,
    p_key: input.idempotencyKey,
  });
  if (begun.error)
    throw new IntelligenceError(
      begun.error.message.replace(/^.*ERROR:\s*/i, '') || 'Design export could not start.',
      422,
    );
  const row = (Array.isArray(begun.data) ? begun.data[0] : begun.data) as {
    id: string;
    status: string;
    created: boolean;
    export_id: string | null;
  } | null;
  if (!row?.id) throw new IntelligenceError('Design export could not start.', 503);
  if (row.status === 'complete') {
    return {
      id: row.id,
      status: 'complete' as const,
      exportId: row.export_id,
      format: input.format,
      local: false,
      hosted: false,
      needsFfmpeg: designExportNeedsFfmpeg(revision.document, input.format),
      note: 'Returned the existing finished export for this idempotency key.',
    };
  }
  if (!row.created && row.status !== 'queued') {
    return {
      id: row.id,
      status: row.status === 'running' ? 'existing' : row.status,
      exportId: row.export_id,
      format: input.format,
      local: false,
      hosted: false,
      needsFfmpeg: designExportNeedsFfmpeg(revision.document, input.format),
      note: `Returned the existing ${row.status} design export for this idempotency key.`,
    };
  }
  if (renderWorkerRequested() && !executeLocal) {
    return {
      id: row.id,
      status: row.created ? 'queued' : 'existing',
      exportId: null,
      format: input.format,
      local: false,
      hosted: false,
      needsFfmpeg: designExportNeedsFfmpeg(revision.document, input.format),
      note: 'Hosted rendering is unavailable. The design export is queued for scripts/studio-render-worker.mjs. Commissioning Film jobs alone does not render Design exports.',
    };
  }
  return executeDesignExport(row.id, revision.document, input);
}

export async function cancelDesignExport(id: string) {
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_design_export_cancel', { p_id: id });
  if (result.error) throw new IntelligenceError('The design export could not be cancelled.', 409);
  return { cancelled: Boolean(result.data) };
}

export async function executeDesignExport(
  jobId: string,
  document: DesignDocument,
  input: {
    projectId: string;
    designId: string;
    revisionId: string;
    format: 'png' | 'svg' | 'pdf';
    fontMode: 'embed' | 'outline';
  },
) {
  const { client, person } = await studioSession();
  try {
    const rendered = await runDesignExportJob({
      client,
      personId: person.id,
      jobId,
      document,
      projectId: input.projectId,
      format: input.format,
      fontMode: input.fontMode,
    });
    return {
      ...rendered,
      local: true,
      hosted: false,
      prepress: 'unavailable' as const,
      color: 'rgb' as const,
      note: rendered.needsFfmpeg
        ? 'Rendered the pinned revision through FFmpeg on this host.'
        : 'Rendered the pinned revision in the Node web runtime with bundled static faces. No FFmpeg.',
    };
  } catch (error) {
    throw error instanceof IntelligenceError
      ? error
      : new IntelligenceError(
          error instanceof Error ? error.message : 'The design could not be exported.',
          503,
        );
  }
}

export async function designExportJob(id: string) {
  const { client, person } = await studioSession();
  const row = await client
    .from('ai_studio_design_export_jobs')
    .select('id,design_id,revision_id,format,status,export_id,width,height,ppi,failure_code')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (row.error || !row.data) throw new IntelligenceError('Design export not found.', 404);
  return row.data;
}

export async function designExportBlob(id: string) {
  const { client, person } = await studioSession();
  const row = await client
    .from('ai_studio_design_exports')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (row.error || !row.data) throw new IntelligenceError('Export not found.', 404);
  const file = await client.storage.from('aethelios-studio-designs').download(row.data.storage_key);
  if (file.error || !file.data) throw new IntelligenceError('Export unavailable.', 503);
  return { blob: file.data, format: row.data.format as 'png' | 'svg' | 'pdf' };
}

export function finishAsDesign(
  id: string,
  layout: Parameters<typeof finishLayoutPreset>[1],
  brand?: Parameters<typeof finishLayoutPreset>[2],
) {
  return finishLayoutPreset(id, layout, brand);
}
